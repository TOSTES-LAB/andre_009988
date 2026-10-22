import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";

import {
  clientRegistrationEntry,
  effectiveClientServer,
  parseClientConfiguration,
  serializeClientConfiguration,
} from "../../../src/application/ClientConfigurationDocument.js";
import {
  clientConfigurationAligned,
  configureClientConfiguration,
  inspectClientConfiguration,
} from "../../../src/application/SetupClientConfiguration.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { readClientRegistrationStatuses } from "../../../src/application/ClientRegistrationStatus.js";
import {
  clientRegistrationEnvironmentDetails,
  clientRegistrationEnvironmentDetailsWithBudget,
} from "../../../src/application/ClientRegistrationEnvironment.js";
import { snapshotEnvironment } from "../../../src/process/snapshotEnvironment.js";
import { npxRegistrationCommand } from "../../../src/application/ClientRegistrationIdentity.js";
import { ok } from "../../../src/domain/result.js";
import { MCP_STARTUP_POLICY } from "../../../src/mcpStartupPolicy.js";

it("awaits the owner-parsed provider request budget without changing caller strings", async () => {
  const parsed = parseClientConfiguration(
    JSON.stringify({
      mcpServers: {
        qorvex: {
          command: "qorvex",
          args: ["mcp"],
          env: {
            QORVEX_ANALYSIS_PROVIDER: "ida",
            QORVEX_IDA_MCP_CONFIG: "/tmp/qorvex-registration.json/",
          },
        },
      },
    }),
    "json",
  );
  const details = await clientRegistrationEnvironmentDetailsWithBudget(
    parsed,
    {},
    "effective",
    async (provider) => {
      expect(provider).toBe("ida");
      return ok(17);
    },
  );
  expect(details).toMatchObject({
    ok: true,
    value: {
      values: { QORVEX_IDA_MCP_CONFIG: "/tmp/qorvex-registration.json/" },
      timeoutInputs: { providerRequestTimeoutMs: 17 },
    },
  });
});

it("reuses desired registration facts within a snapshot and revalidates later inspections", async () => {
  const home = await createTestTempDirectory("qorvex-registration-snapshot-");
  const configPath = join(home, "mcp.json");
  const environment = {
    QORVEX_ANALYSIS_PROVIDER: "ida",
    QORVEX_IDA_MCP_CONFIG: "/tmp/qorvex-registration.json/",
    QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact",
  };
  const original = JSON.stringify({
    mcpServers: {
      qorvex: {
        command: "qorvex",
        args: ["mcp"],
        env: environment,
        startupTimeoutMs: MCP_STARTUP_POLICY.kimiStartupTimeoutMs,
        toolTimeoutMs: 450_000,
      },
    },
  });
  await writeFile(configPath, original);
  const client = { name: "kimi", format: "kimi", configPath } as const;
  const observations: string[] = [];
  const resolveBudget = async (
    provider: string,
    observedEnvironment: Readonly<Record<string, string>>,
  ) => {
    expect(observedEnvironment.QORVEX_IDA_MCP_CONFIG).toBe(
      environment.QORVEX_IDA_MCP_CONFIG,
    );
    observations.push(provider);
    return ok(17);
  };

  expect(
    await clientConfigurationAligned(client, {}, ["qorvex", "mcp"], resolveBudget),
  ).toBe(true);
  expect(observations).toEqual(["ida"]);

  expect(
    await inspectClientConfiguration(client, {}, ["qorvex", "mcp"], resolveBudget),
  ).toEqual({ status: "already_current" });
  // Inspection checks both the layered preflight and the freshly read document.
  expect(observations).toEqual(["ida", "ida", "ida"]);
  expect(await readFile(configPath, "utf8")).toBe(original);
  await expect(access(`${configPath}.qorvex.backup`)).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it.each(["win32", "linux"] as const)(
  "uses the selected %s identity when inspecting lowercase registration settings",
  async (platform) => {
    const home = await createTestTempDirectory("qorvex-selected-platform-env-");
    const path = join(home, ".cursor/mcp.json");
    await mkdir(join(home, ".cursor"));
    await writeFile(
      path,
      JSON.stringify({
        mcpServers: {
          qorvex: clientRegistrationEntry(
            "json",
            npxRegistrationCommand(platform),
            { qorvex_analysis_provider: "invalid provider" },
          ),
        },
      }),
    );
    const statuses = await readClientRegistrationStatuses(home, "qorvex", {
      platform,
      environment: {},
    });
    expect(statuses.find(({ client }) => client === "cursor")).toMatchObject({
      state: platform === "win32" ? "invalid" : "aligned",
    });
  },
);

it.skipIf(process.platform !== "win32").each([
  {
    key: "qorvex_analysis_provider",
    override: "QORVEX_ANALYSIS_PROVIDER",
    value: "ghidra",
    duplicate: false,
  },
  { key: "true", override: "TRUE", value: "chosen", duplicate: false },
  { key: '"true"', override: "true", value: "chosen", duplicate: true },
  {
    key: "qorvex_analysis_provider",
    override: "QORVEX_ANALYSIS_PROVIDER",
    value: "ghidra",
    duplicate: true,
  },
])(
  "preserves DSH scalar-key identity and comments when replacing $key",
  async ({ key, override, value, duplicate }) => {
    const root = await createTestTempDirectory("qorvex-dsh-alias-comments-");
    const configPath = join(root, "cordis.patch.yml");
    const source = `- insert:\n    - id: qorvex-mcp\n      name: "@deepseek-ai/dsh-mcp-client"\n      config:\n        serverName: qorvex\n        transport: stdio\n        command: old-qorvex\n        args: [mcp]\n        env:\n          # retain preceding rationale\n          ${key}: "hopper" # retain inline rationale\n${duplicate ? `          ${override}: "ghidra" # retain winning rationale\n` : ""}          CUSTOM: !!js caller.custom\n`;
    await writeFile(configPath, source);
    const client = { name: "dsh", format: "dsh", configPath } as const;
    const result = await configureClientConfiguration(
      client,
      { [override]: value },
      ["qorvex", "mcp"],
    );
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "configured",
    });
    const text = await readFile(configPath, "utf8");
    expect(text).toContain("# retain preceding rationale");
    expect(text).toContain("# retain inline rationale");
    if (duplicate) expect(text).toContain("# retain winning rationale");
    expect(text).toContain("!!js caller.custom");
    const env = clientRegistrationEnvironmentDetails(
      parseClientConfiguration(text, "dsh"),
    );
    expect(env.ok).toBe(true);
    if (!env.ok) throw env.error;
    expect(env.value.values).toHaveProperty(override, value);
    expect(
      Object.keys(env.value.values).filter(
        (name) => name.toUpperCase() === override.toUpperCase(),
      ),
    ).toEqual([override]);
    expect(await readFile(`${configPath}.qorvex.backup`, "utf8")).toBe(source);
    expect(
      await configureClientConfiguration(client, { [override]: value }, [
        "qorvex",
        "mcp",
      ]),
    ).toEqual({ status: "unchanged" });
  },
);

it.skipIf(process.platform !== "win32")(
  "preserves a lowercase explicit Kimi schema profile instead of inserting a conflicting default",
  async () => {
    const home = await createTestTempDirectory("qorvex-kimi-case-");
    await mkdir(join(home, ".kimi-code"));
    const configPath = join(home, ".kimi-code/mcp.json");
    await writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          qorvex: {
            command: "old-qorvex",
            args: ["mcp"],
            env: { qorvex_mcp_input_schema_profile: "full" },
          },
        },
      }),
    );
    const client = { name: "kimi", format: "kimi", configPath } as const;
    expect(
      await configureClientConfiguration(
        client,
        {},
        npxRegistrationCommand(process.platform),
      ),
    ).toMatchObject({ status: "configured" });
    const parsed = parseClientConfiguration(
      await readFile(configPath, "utf8"),
      "kimi",
    );
    expect(effectiveClientServer(parsed, "qorvex")).toHaveProperty("env", {
      qorvex_mcp_input_schema_profile: "full",
    });
    const statuses = await readClientRegistrationStatuses(home, "qorvex", {
      environment: {},
    });
    expect(statuses.find(({ client }) => client === "kimi")).toMatchObject({
      state: "aligned",
    });
  },
);

it
  .skipIf(process.platform !== "win32")
  .each(["hopper", "!!js caller.provider"])(
  "replaces a Windows DSH environment alias without evaluating %s",
  async (stored) => {
    const root = await createTestTempDirectory("qorvex-dsh-case-");
    const configPath = join(root, "cordis.patch.yml");
    const source = `- insert:\n    - id: qorvex-mcp\n      name: "@deepseek-ai/dsh-mcp-client"\n      config:\n        serverName: qorvex\n        transport: stdio\n        command: old-qorvex\n        args: [mcp]\n        env:\n          qorvex_analysis_provider: ${stored}\n          CUSTOM: !!js caller.custom\n`;
    await writeFile(configPath, source);
    const client = { name: "dsh", format: "dsh", configPath } as const;
    const overrides = { QORVEX_ANALYSIS_PROVIDER: "ghidra" };
    const configured = await configureClientConfiguration(client, overrides, [
      "qorvex",
      "mcp",
    ]);
    expect(configured, JSON.stringify(configured)).toMatchObject({
      status: "configured",
    });
    const text = await readFile(configPath, "utf8");
    expect(text).not.toContain("qorvex_analysis_provider:");
    expect(text).toContain("QORVEX_ANALYSIS_PROVIDER: ghidra");
    expect(text).toContain("!!js caller.custom");
    const details = clientRegistrationEnvironmentDetails(
      parseClientConfiguration(text, "dsh"),
    );
    expect(details.ok).toBe(true);
    if (!details.ok) throw details.error;
    expect(details.value.timeoutInputs.analysisProvider).toBe("ghidra");
    expect(
      await configureClientConfiguration(client, overrides, ["qorvex", "mcp"]),
    ).toEqual({ status: "unchanged" });
  },
);

it.skipIf(process.platform !== "win32").each([
  {
    existing: { qorvex_analysis_provider: "hopper" },
    overrides: { QORVEX_ANALYSIS_PROVIDER: "ghidra" },
    expected: "ghidra",
  },
  {
    existing: { QORVEX_ANALYSIS_PROVIDER: "ghidra" },
    overrides: { qorvex_analysis_provider: "hopper" },
    expected: "hopper",
  },
])(
  "keeps Windows override precedence consistent with the launched environment: $expected",
  ({ existing, overrides, expected }) => {
    const parsed = parseClientConfiguration(
      JSON.stringify({
        mcpServers: { qorvex: { command: "qorvex", args: ["mcp"], env: existing } },
      }),
      "json",
    );
    const result = clientRegistrationEnvironmentDetails(parsed, overrides);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.value.timeoutInputs.analysisProvider).toBe(expected);
    expect(snapshotEnvironment(result.value.values).QORVEX_ANALYSIS_PROVIDER).toBe(
      expected,
    );
    expect(Object.keys(result.value.values)).toHaveLength(1);
    const child = spawnSync(
      process.execPath,
      ["-e", "process.stdout.write(process.env.QORVEX_ANALYSIS_PROVIDER ?? '')"],
      {
        env: result.value.values,
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout).toBe(expected);
  },
);

it.skipIf(process.platform !== "win32")(
  "rejects invalid lowercase known settings before writing a Windows registration",
  async () => {
    const root = await createTestTempDirectory(
      "qorvex-invalid-lowercase-environment-",
    );
    const configPath = join(root, "config.json");
    const original = JSON.stringify({
      mcpServers: {
        qorvex: {
          command: "qorvex",
          args: ["mcp"],
          env: { qorvex_analysis_provider: "invalid provider" },
        },
      },
    });
    await writeFile(configPath, original);
    const result = await configureClientConfiguration(
      { name: "cursor", format: "json", configPath },
      {},
      ["qorvex", "mcp"],
    );
    expect(result).toMatchObject({ status: "failed" });
    expect(await readFile(configPath, "utf8")).toBe(original);
    await expect(access(`${configPath}.qorvex.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
);

it.each([
  ["cursor", "json", "mcpServers", "env"],
  ["codex", "toml", "mcp_servers", "env"],
  ["opencode", "opencode", "mcp", "environment"],
  ["hermes", "hermes", "mcp_servers", "env"],
] as const)(
  "preserves %s server environment through command and provider updates",
  async (name, format, serversKey, environmentKey) => {
    const root = await createTestTempDirectory("qorvex-setup-environment-");
    const configPath = join(root, "config");
    const client = { name, format, configPath };
    const custom = {
      QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact",
      QORVEX_MCP_OUTPUT_SCHEMA_PROFILE: "off",
      QORVEX_MCP_MAX_RESPONSE_BYTES: "33554432",
      QORVEX_BROWSER_EXECUTABLE: join(root, "custom-browser"),
      GHIDRA_INSTALL_DIR: join(root, "old-ghidra"),
      HOPPER_LOADER_ARGS_JSON: '["", "--loader", "Mach-O"]',
      QORVEX_REFERENCE_SECRET_PATTERNS_JSON: '["*.private", "local/**"]',
      QORVEX_GHIDRA_LANGUAGE_ID: "x86:LE:32:default",
      QORVEX_GHIDRA_COMPILER_SPEC_ID: "borlandcpp",
      CALLER_SETTING: "preserve exactly",
    };
    const serialized = serializeClientConfiguration(
      {
        [serversKey]: {
          qorvex: clientRegistrationEntry(format, ["qorvex-old", "mcp"], custom),
          other: clientRegistrationEntry(format, ["other"], { OTHER: "keep" }),
        },
      },
      format,
    );
    if (!serialized.ok) throw new Error("fixture serialization failed");
    const original = serialized.value;
    await writeFile(configPath, original);
    const providers = { GHIDRA_INSTALL_DIR: join(root, "new-ghidra") };
    const command = ["qorvex", "mcp"];
    expect(
      await inspectClientConfiguration(client, providers, command),
    ).toMatchObject({ status: "update" });
    expect(
      await configureClientConfiguration(client, providers, command),
    ).toMatchObject({ status: "configured" });
    const configured = await readFile(configPath, "utf8");
    const parsed = parseClientConfiguration(configured, format);
    expect(effectiveClientServer(parsed, "qorvex")).toHaveProperty(
      environmentKey,
      { ...custom, ...providers },
    );
    expect(effectiveClientServer(parsed, "other")).toEqual(
      effectiveClientServer(
        parseClientConfiguration(original, format),
        "other",
      ),
    );
    expect(await readFile(`${configPath}.qorvex.backup`, "utf8")).toBe(original);
    expect(await clientConfigurationAligned(client, providers, command)).toBe(
      true,
    );
    expect(
      await inspectClientConfiguration(client, providers, command),
    ).toEqual({ status: "already_current" });
    expect(
      await configureClientConfiguration(client, providers, command),
    ).toEqual({ status: "unchanged" });
    expect(await readFile(configPath, "utf8")).toBe(configured);
  },
);

it("retains legacy OpenCode environment when migrating into a native server table", async () => {
  const root = await createTestTempDirectory("qorvex-opencode-environment-");
  const configPath = join(root, "opencode.json");
  const client = { name: "opencode", format: "opencode", configPath } as const;
  const custom = { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact" };
  await writeFile(
    configPath,
    JSON.stringify({
      mcp: {
        qorvex: clientRegistrationEntry("opencode", ["old", "mcp"], custom),
        servers: {
          other: clientRegistrationEntry("opencode_v2", ["other"], {}),
        },
      },
    }),
  );
  expect(
    await configureClientConfiguration(client, {}, ["qorvex", "mcp"]),
  ).toMatchObject({ status: "configured" });
  const parsed = parseClientConfiguration(
    await readFile(configPath, "utf8"),
    "opencode",
  );
  expect(parsed.legacyServers).toEqual({});
  expect(parsed.servers.qorvex).toEqual(
    clientRegistrationEntry("opencode_v2", ["qorvex", "mcp"], custom),
  );
  expect(
    await configureClientConfiguration(client, {}, ["qorvex", "mcp"]),
  ).toEqual({ status: "unchanged" });
});

it.each([
  [
    "non-string member",
    { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact", PORT: 8080 },
    "env.PORT",
  ],
  [
    "boolean member",
    { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact", FLAG: true },
    "env.FLAG",
  ],
  [
    "null member",
    { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "compact", VALUE: null },
    "env.VALUE",
  ],
  ["array", [], "env"],
  ["string", "not-a-map", "env"],
  ["null map", null, "env"],
  [
    "empty profile",
    { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "" },
    "QORVEX_MCP_INPUT_SCHEMA_PROFILE",
  ],
  [
    "invalid profile",
    { QORVEX_MCP_INPUT_SCHEMA_PROFILE: "bogus" },
    "QORVEX_MCP_INPUT_SCHEMA_PROFILE",
  ],
  [
    "empty output profile",
    { QORVEX_MCP_OUTPUT_SCHEMA_PROFILE: "" },
    "QORVEX_MCP_OUTPUT_SCHEMA_PROFILE",
  ],
  [
    "invalid output profile",
    { QORVEX_MCP_OUTPUT_SCHEMA_PROFILE: "bogus" },
    "QORVEX_MCP_OUTPUT_SCHEMA_PROFILE",
  ],
  [
    "invalid response budget",
    { QORVEX_MCP_MAX_RESPONSE_BYTES: "1" },
    "QORVEX_MCP_MAX_RESPONSE_BYTES",
  ],
  [
    "ASAR header admission above its maximum",
    { QORVEX_ASAR_MAX_HEADER_BYTES: "268435457" },
    "QORVEX_ASAR_MAX_HEADER_BYTES",
  ],
  [
    "regex matching deadline of zero",
    { QORVEX_REGEX_MATCHING_DEADLINE_MS: "0" },
    "QORVEX_REGEX_MATCHING_DEADLINE_MS",
  ],
  [
    "capture decoder heap below its floor",
    { QORVEX_CAPTURE_DECODER_OLD_GENERATION_MIB: "7" },
    "QORVEX_CAPTURE_DECODER_OLD_GENERATION_MIB",
  ],
  [
    "regex worker heap request below its floor",
    { QORVEX_REGEX_WORKER_HEAP_REQUEST_MIB: "6" },
    "QORVEX_REGEX_WORKER_HEAP_REQUEST_MIB",
  ],
  [
    "MCP initialize budget of zero",
    { QORVEX_MCP_INITIALIZE_BUDGET_MS: "0" },
    "QORVEX_MCP_INITIALIZE_BUDGET_MS",
  ],
  [
    "MCP tools/list budget above its maximum",
    { QORVEX_MCP_TOOLS_LIST_BUDGET_MS: "2147483648" },
    "QORVEX_MCP_TOOLS_LIST_BUDGET_MS",
  ],
  [
    "MCP first-catalog budget with a leading zero",
    { QORVEX_MCP_FIRST_CATALOG_BUDGET_MS: "020000" },
    "QORVEX_MCP_FIRST_CATALOG_BUDGET_MS",
  ],
  [
    "MCP doctor deadline that is not decimal",
    { QORVEX_MCP_DOCTOR_DEADLINE_MS: "30_000" },
    "QORVEX_MCP_DOCTOR_DEADLINE_MS",
  ],
  [
    "malformed loader JSON",
    { HOPPER_LOADER_ARGS_JSON: "{" },
    "HOPPER_LOADER_ARGS_JSON",
  ],
  [
    "non-array loader JSON",
    { HOPPER_LOADER_ARGS_JSON: "{}" },
    "HOPPER_LOADER_ARGS_JSON",
  ],
  [
    "NUL loader argument",
    { HOPPER_LOADER_ARGS_JSON: JSON.stringify(["a\0b"]) },
    "HOPPER_LOADER_ARGS_JSON",
  ],
  [
    "malformed exclusion JSON",
    { QORVEX_REFERENCE_SECRET_PATTERNS_JSON: "{" },
    "QORVEX_REFERENCE_SECRET_PATTERNS_JSON",
  ],
  [
    "empty exclusion pattern",
    { QORVEX_REFERENCE_SECRET_PATTERNS_JSON: '[""]' },
    "QORVEX_REFERENCE_SECRET_PATTERNS_JSON",
  ],
  [
    "unpaired compiler specification",
    { QORVEX_GHIDRA_COMPILER_SPEC_ID: "borlandcpp" },
    "QORVEX_GHIDRA_COMPILER_SPEC_ID",
  ],
] as const)(
  "refuses %s before changing the configuration",
  async (_name, env, setting) => {
    const home = await createTestTempDirectory("qorvex-invalid-environment-");
    const directory = join(home, ".cursor");
    const configPath = join(directory, "mcp.json");
    await mkdir(directory);
    const original = JSON.stringify({
      mcpServers: { qorvex: { command: "qorvex", args: ["mcp"], env } },
    });
    await writeFile(configPath, original);
    const client = { name: "cursor", format: "json", configPath } as const;
    expect(
      await inspectClientConfiguration(client, {}, ["qorvex", "mcp"]),
    ).toMatchObject({
      status: "invalid",
      remediation: expect.stringContaining(setting),
    });
    expect(
      await configureClientConfiguration(client, {}, ["qorvex", "mcp"]),
    ).toEqual({ status: "failed", reason: "readback" });
    expect(await clientConfigurationAligned(client, {}, ["qorvex", "mcp"])).toBe(
      false,
    );
    const statuses = await readClientRegistrationStatuses(home, "qorvex", {
      environment: {},
    });
    expect(statuses.find(({ client }) => client === "cursor")).toMatchObject({
      state: "invalid",
      remediation: expect.stringContaining(setting),
    });
    expect(await readFile(configPath, "utf8")).toBe(original);
    await expect(access(`${configPath}.qorvex.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
);
