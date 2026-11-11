import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cursorMarketplaceInstallLinkIssues,
  cursorPluginBundleIssues,
  inspectCursorPluginBundle,
  syncCursorPluginSkill,
} from "../../scripts/lib/cursor-plugin-bundle.mjs";
import { createTestTempDirectory } from "../fixtures/temporaryDirectory.js";

const repositoryRoot = process.cwd();

const authoredSkill = async (
  root: string,
  files: Readonly<Record<string, string>>,
) => {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, ".agents/skills/reverse-engineer-anything", path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content);
  }
};

describe("Cursor Marketplace plugin", () => {
  it("ships the skill and the pinned npm server from the package version", async () => {
    const inspected = await inspectCursorPluginBundle(repositoryRoot);
    expect(inspected.issues).toEqual([]);
    expect(inspected.packageVersion).toBe(inspected.manifest.version);
    expect(inspected.mcp.mcpServers.qorvex).toEqual({
      command: "npx",
      args: ["-y", `qorvex-agents@${inspected.packageVersion}`, "mcp"],
    });
  });

  it("keeps the committed skill identical to the authored skill", async () => {
    await expect(
      syncCursorPluginSkill({ root: repositoryRoot, check: true }),
    ).resolves.toBeUndefined();
  });

  it("does not publish an MCP-only Cursor install link", async () => {
    const documents = await Promise.all(
      [
        "README.md",
        "docs/getting-started/installation.md",
        ".cursor-plugin/plugin.json",
        "mcp.json",
      ].map(async (path) => ({
        path,
        text: await readFile(join(repositoryRoot, path), "utf8"),
      })),
    );
    expect(cursorMarketplaceInstallLinkIssues(documents)).toEqual([]);
  });

  it("reports each drifted manifest field without accepting a partial server", () => {
    const aligned = {
      manifest: {
        name: "qorvex",
        version: "6.8.0",
        description: "Reverse engineer anything",
        author: { name: "TOSTES-LAB" },
        repository: "https://github.com/TOSTES-LAB/andre_009988",
        license: "MIT",
        keywords: ["qorvex"],
        skills: ".cursor-plugin/skills",
        logo: "assets/qorvex-plugin.png",
      },
      mcp: {
        mcpServers: {
          qorvex: {
            command: "npx",
            args: ["-y", "qorvex-agents@6.8.0", "mcp"],
          },
        },
      },
      packageVersion: "6.8.0",
      logoExists: true,
      skillNames: ["reverse-engineer-anything"],
      skillFrontmatter: {
        name: "reverse-engineer-anything",
        description: "Use QORVEX",
      },
    };
    expect(cursorPluginBundleIssues(aligned)).toEqual([]);
    expect(
      cursorPluginBundleIssues({
        ...aligned,
        manifest: { ...aligned.manifest, name: "other", mcpServers: {} },
        mcp: {
          mcpServers: {
            qorvex: { command: "node", args: ["dist/mcp/main.js"] },
          },
        },
        logoExists: false,
        skillNames: ["qorvex-tool-design", "reverse-engineer-anything"],
      }).map(({ field }) => field),
    ).toEqual([
      "name",
      "mcpServers",
      "logo.file",
      "mcp.args",
      "skills.entries",
    ]);
  });

  it("fails closed when the synced skill is missing, edited, or extended", async () => {
    const root = await createTestTempDirectory("qorvex-cursor-plugin-skill-");
    await authoredSkill(root, {
      "SKILL.md":
        "---\nname: reverse-engineer-anything\ndescription: Use QORVEX\n---\n\n# QORVEX\n",
      "references/guide.md": "# Guide\n",
    });
    await syncCursorPluginSkill({ root, check: false });
    const skill = join(
      root,
      ".cursor-plugin/skills/reverse-engineer-anything/SKILL.md",
    );
    expect(await readFile(skill, "utf8")).toBe(
      "---\nname: reverse-engineer-anything\ndescription: Use QORVEX\n---\n\n# QORVEX\n",
    );
    await expect(
      syncCursorPluginSkill({ root, check: true }),
    ).resolves.toBeUndefined();
    await writeFile(skill, "edited\n");
    await expect(
      syncCursorPluginSkill({ root, check: true }),
    ).rejects.toMatchObject({ code: "cursor_plugin_skill_stale" });
    await syncCursorPluginSkill({ root, check: false });
    await writeFile(
      join(
        root,
        ".cursor-plugin/skills/reverse-engineer-anything/references/extra.md",
      ),
      "extra\n",
    );
    await expect(
      syncCursorPluginSkill({ root, check: true }),
    ).rejects.toMatchObject({ code: "cursor_plugin_skill_inventory" });
  });
});
