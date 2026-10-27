import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => ({
  afterDiscovery: undefined as undefined | (() => Promise<void>),
}));

vi.mock(
  "../../src/application/ClientConfigurationFiles.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../src/application/ClientConfigurationFiles.js")
      >();
    return {
      ...actual,
      readClientConfigurationFiles: async (
        ...args: Parameters<typeof actual.readClientConfigurationFiles>
      ) => {
        const files = await actual.readClientConfigurationFiles(...args);
        const change = refresh.afterDiscovery;
        refresh.afterDiscovery = undefined;
        await change?.();
        return files;
      },
    };
  },
);

import {
  configureClientConfiguration,
  inspectClientConfiguration,
} from "../../src/application/SetupClientConfiguration.js";
import type { SetupClient } from "../../src/application/SupportedClients.js";
import { createTestTempDirectory } from "../fixtures/temporaryDirectory.js";

afterEach(() => {
  refresh.afterDiscovery = undefined;
});

it.each(["inspect", "configure"] as const)(
  "%s uses the authoritative user snapshot after Gemini policy is repaired",
  async (operation) => {
    const home = await createTestTempDirectory("qorvex-setup-policy-snapshot-");
    await mkdir(join(home, ".gemini"));
    const configPath = join(home, ".gemini", "settings.json");
    const client: SetupClient = {
      name: "gemini_cli",
      configPath,
      format: "json",
      geminiSettings: {
        defaultsPath: join(home, "defaults.json"),
        systemPath: join(home, "system.json"),
        workspaceDirectory: home,
        trustedFoldersPath: join(home, "trust.json"),
        platform: process.platform,
      },
    };
    await writeFile(configPath, JSON.stringify({ mcp: { excluded: ["qorvex"] } }));
    const repaired = '{"caller_setting":true}\n';
    refresh.afterDiscovery = () => writeFile(configPath, repaired);
    if (operation === "inspect") {
      expect(
        await inspectClientConfiguration(client, {}, ["qorvex", "mcp"]),
      ).toMatchObject({ status: "update" });
      expect(await readFile(configPath, "utf8")).toBe(repaired);
    } else {
      expect(
        await configureClientConfiguration(client, {}, ["qorvex", "mcp"]),
      ).toMatchObject({ status: "configured" });
      expect(JSON.parse(await readFile(configPath, "utf8"))).toMatchObject({
        caller_setting: true,
        mcpServers: { qorvex: { command: "qorvex", args: ["mcp"] } },
      });
      expect(await readFile(`${configPath}.qorvex.backup`, "utf8")).toBe(repaired);
    }
  },
);

it("rechecks registration ownership after preflight before creating any backup", async () => {
  const home = await createTestTempDirectory("qorvex-setup-ownership-recheck-");
  const configPath = join(home, "settings.json");
  const client: SetupClient = { name: "test", configPath, format: "json" };
  await writeFile(
    configPath,
    '{"mcpServers":{"qorvex":{"command":"qorvex","args":["mcp"]}}}',
  );
  expect(
    await inspectClientConfiguration(client, {}, [
      "npx",
      "-y",
      "qorvex-agents@6.8.0",
      "mcp",
    ]),
  ).toMatchObject({ status: "update" });
  const replacement =
    '{"mcpServers":{"qorvex":{"command":"other","args":["mcp"]}}}';
  // Change after layered discovery, so only the transaction's physical snapshot sees it.
  refresh.afterDiscovery = () => writeFile(configPath, replacement);
  expect(
    await configureClientConfiguration(client, {}, ["qorvex", "mcp"]),
  ).toMatchObject({
    status: "failed",
    reason: "registration_ownership",
    detail: expect.stringContaining("foreign ownership"),
  });
  expect(await readFile(configPath, "utf8")).toBe(replacement);
  await expect(readFile(`${configPath}.qorvex.backup`)).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("blocks an inherited foreign row before planning creation of a missing write target", async () => {
  const home = await createTestTempDirectory("qorvex-setup-inherited-ownership-");
  const lower = join(home, "config.json");
  const configPath = join(home, "opencode.json");
  await writeFile(
    lower,
    '{"mcp":{"qorvex":{"type":"local","command":["other"]}}}',
  );
  const client: SetupClient = {
    name: "opencode",
    format: "opencode",
    configPath,
    configPaths: [lower, configPath],
  };
  expect(
    await inspectClientConfiguration(client, {}, ["qorvex", "mcp"]),
  ).toMatchObject({
    status: "invalid",
    remediation: expect.stringContaining("foreign ownership"),
  });
  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(`${lower}.qorvex.backup`)).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it.each(["other", "qorvex"])(
  "rechecks an inherited %s launcher after preflight for a policy fragment",
  async (command) => {
    const home = await createTestTempDirectory("qorvex-setup-layer-recheck-");
    const lower = join(home, "config.json");
    const configPath = join(home, "opencode.json");
    const client: SetupClient = {
      name: "opencode",
      format: "opencode",
      configPath,
      configPaths: [lower, configPath],
    };
    await writeFile(
      lower,
      '{"mcp":{"qorvex":{"type":"local","command":["qorvex","mcp"]}}}',
    );
    const original = '{"mcp":{"qorvex":{"environment":{"CUSTOM":"keep"}}}}';
    await writeFile(configPath, original);
    expect(
      await inspectClientConfiguration(client, {}, ["qorvex", "mcp"]),
    ).toMatchObject({ status: "update" });
    // The write transaction must use a fresh source discovery after preflight.
    await writeFile(
      lower,
      JSON.stringify({
        mcp: { qorvex: { type: "local", command: [command, "mcp"] } },
      }),
    );
    const result = await configureClientConfiguration(client, {}, [
      "qorvex",
      "mcp",
    ]);
    if (command === "other") {
      expect(result).toMatchObject({
        status: "failed",
        reason: "registration_ownership",
        detail: expect.stringContaining("foreign ownership"),
      });
      expect(await readFile(configPath, "utf8")).toBe(original);
      await expect(readFile(`${configPath}.qorvex.backup`)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } else {
      expect(result).toMatchObject({ status: "configured" });
      expect(await readFile(`${configPath}.qorvex.backup`, "utf8")).toBe(original);
    }
  },
);
