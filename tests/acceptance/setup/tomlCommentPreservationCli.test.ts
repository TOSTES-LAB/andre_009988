import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { expect } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";

const clients = [
  { name: "codex", path: ".codex/config.toml" },
  { name: "grok_build", path: ".grok/config.toml" },
] as const;

/** Parsed values other than QORVEX's registration. */
const unrelatedValues = (text: string) => {
  const document = parseToml(text);
  const servers = document.mcp_servers;
  if (typeof servers === "object" && servers !== null) {
    Reflect.deleteProperty(servers, "qorvex");
    if (Object.keys(servers).length === 0) delete document.mcp_servers;
  }
  return document;
};

const scenarios = [
  {
    name: "a stale QORVEX table between other tables",
    original: [
      "# root explanation",
      'model = "x" # inline model note',
      "",
      "# about qorvex",
      "[mcp_servers.qorvex]",
      "# inside the qorvex table",
      'command = "old"',
      "",
      "# between qorvex and its environment",
      "[mcp_servers.qorvex.env]",
      'OLD = "value"',
      "# after the qorvex environment",
      "",
      "# about the other server",
      "[mcp_servers.other]",
      'command = "other" # other inline note',
      "",
      "# trailing note about the file",
      "",
    ].join("\n"),
    comments: [
      "# root explanation",
      'model = "x" # inline model note',
      "# about qorvex",
      "# inside the qorvex table",
      "# between qorvex and its environment",
      "# after the qorvex environment",
      "# about the other server",
      'command = "other" # other inline note',
      "# trailing note about the file",
    ],
  },
  {
    name: "a leading QORVEX table and a final note without a line break",
    original: [
      "# about qorvex",
      "[mcp_servers.qorvex]",
      'command = "old"',
      "# trailing note without a line break",
    ].join("\n"),
    comments: ["# about qorvex", "# trailing note without a line break"],
  },
] as const;

for (const scenario of scenarios)
  cliTest(
    `TOML client setup and uninstall keep comments around ${scenario.name}`,
    async ({ cli }) => {
      const home = await createTestTempDirectory("qorvex-toml-comments-");
      const paths = clients.map(({ path }) => join(home, path));
      for (const path of paths) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, scenario.original);
      }
      const run = (arguments_: readonly string[]) =>
        cli.run({
          arguments: arguments_,
          cwd: home,
          environment: {
            HOME: home,
            USERPROFILE: home,
            CODEX_HOME: join(home, ".codex"),
            GROK_HOME: join(home, ".grok"),
            XDG_CONFIG_HOME: join(home, ".config"),
            TMPDIR: home,
          },
        });
      const setup = [
        "setup",
        ...clients.flatMap(({ name }) => ["--client", name]),
        "--skill=false",
        "--json",
      ];

      const preview = await run([...setup, "--dry-run"]);
      expect(preview.exitCode, preview.stdout).toBe(0);
      expect(preview.json).toMatchObject({ status: "planned" });
      for (const path of paths)
        expect(await readFile(path, "utf8")).toBe(scenario.original);

      const applied = await run([...setup, "--yes"]);
      expect(applied.exitCode, applied.stdout).toBe(0);
      expect(applied.json).toMatchObject({
        status: "ready",
        clients: {
          codex: { status: "configured" },
          grok_build: { status: "configured" },
        },
      });
      const configured: string[] = [];
      for (const path of paths) {
        const text = await readFile(path, "utf8");
        configured.push(text);
        for (const comment of scenario.comments)
          expect(text, path).toContain(comment);
        expect(text, path).not.toContain('command = "old"');
        expect(unrelatedValues(text), path).toEqual(
          unrelatedValues(scenario.original),
        );
        expect(parseToml(text), path).toHaveProperty("mcp_servers.qorvex.command");
        expect(await readFile(`${path}.qorvex.backup`, "utf8"), path).toBe(
          scenario.original,
        );
      }

      const repeated = await run([...setup, "--yes"]);
      expect(repeated.exitCode, repeated.stdout).toBe(0);
      expect(repeated.json).toMatchObject({
        status: "ready",
        appliedActions: [],
      });
      for (const [index, path] of paths.entries())
        expect(await readFile(path, "utf8"), path).toBe(configured[index]);

      const removed = await run(["uninstall", "--json"]);
      expect(removed.exitCode, removed.stdout).toBe(0);
      expect(removed.json).toMatchObject({ status: "complete" });
      const remaining: string[] = [];
      for (const path of paths) {
        const text = await readFile(path, "utf8");
        remaining.push(text);
        for (const comment of scenario.comments)
          expect(text, path).toContain(comment);
        expect(parseToml(text), path).not.toHaveProperty("mcp_servers.qorvex");
        expect(unrelatedValues(text), path).toEqual(
          unrelatedValues(scenario.original),
        );
        // Setup ended the file with QORVEX's table; removing it keeps that break.
        expect(text.endsWith("\n"), path).toBe(true);
      }
      // Both TOML clients share one editor, so their text matches.
      expect(remaining[1]).toBe(remaining[0]);
    },
  );
