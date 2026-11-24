import { createCommandCli } from "../../support/cli/commandCli.js";
import { resolve } from "node:path";
import { z } from "zod";
import { expect, it } from "vitest";

import { registerCliCommand } from "../../../src/cli/commandRegistry.js";
import { createCliShell } from "../../../src/cli/cliShell.js";
import { createCliCompletions } from "../../../src/cli/completions.js";
import type { CompletionShell } from "../../../src/cli/completionProtocol.js";
import { workspaceCliTest } from "../../support/cli/workspaceCliFixture.js";
import { serveInProcessCli } from "../../support/cli/serveInProcessCli.js";

const registry = () => {
  const cli = createCommandCli();
  registerCliCommand(cli, "instructions", {
    options: z.object({
      dryRun: z.boolean().optional(),
      noDryRun: z.string().optional(),
      procedure: z.string().optional(),
      targetFormat: z.enum(["dos-com", "raw-binary"]).optional(),
    }),
    alias: { targetFormat: "f" },
    run: () => {
      throw new Error("Completion must not execute a command");
    },
  });
  return cli;
};
const completionOutput = (
  shell: CompletionShell,
  words: string[],
  index = words.length - 1,
  transport: Readonly<NodeJS.ProcessEnv> = {},
) => {
  let text = "";
  const callback = createCliCompletions(registry(), {
    ...transport,
    COMPLETE: shell,
    _COMPLETE_INDEX: String(index),
  });
  expect(
    callback.complete(["--", ...words], {
      stdout: (value) => {
        text += value;
      },
    }),
  ).toBe(true);
  return text;
};
const complete = (words: string[], index = words.length - 1) => {
  const text = completionOutput("bash", words, index);
  return text === ""
    ? []
    : text
        .split("\v")
        .map((value) => (value.endsWith("\x01") ? value.slice(0, -1) : value));
};

const completeBash = (
  line: string,
  fragment: string,
  words: readonly string[],
  index = words.length,
) =>
  completionOutput("bash", ["qorvex", ...words], index, {
    _COMPLETE_BASH_LINE: `qorvex ${line}`,
    _COMPLETE_BASH_FRAGMENT: fragment,
  });

it("resolves enabled builtin scopes in the same tree as registered commands", () => {
  expect(complete(["qorvex", "mcp", "d"])).toEqual(["doctor"]);
  expect(complete(["qorvex", "mcp"], 2)).toEqual(["add", "doctor"]);
  expect(complete(["qorvex", ""])).toEqual(["instructions", "mcp", "completions"]);
  expect(complete(["qorvex", "completions", "b"])).toEqual(["bash"]);
  expect(complete(["qorvex", "mcp", "add", "--c"])).toEqual([
    "--command",
    "--columns",
  ]);
});

it("uses canonical global flag metadata and retains command options and enum hints", () => {
  expect(complete(["qorvex", "instructions", "--", "--he"])).toEqual([]);
  expect(complete(["qorvex", "instructions", "--he"])).toEqual(["--help"]);
  expect(complete(["qorvex", "instructions", "--for"])).toEqual(["--format"]);
  expect(complete(["qorvex", "instructions", "--tok"])).toEqual(
    expect.arrayContaining([
      "--token-count",
      "--token-limit",
      "--token-offset",
    ]),
  );
  expect(complete(["qorvex", "instructions", "--proc"])).toEqual(["--procedure"]);
  expect(complete(["qorvex", "instructions", "--target-format", "--he"])).toEqual([
    "--help",
  ]);
  expect(complete(["qorvex", "instructions", "--target-format", ""])).toEqual([
    "dos-com",
    "raw-binary",
  ]);
  expect(complete(["qorvex", "mcp", "doctor", "--format", ""])).toEqual([
    "toon",
    "json",
    "yaml",
    "md",
    "jsonl",
  ]);
  expect(complete(["qorvex", "mcp", "doctor", "--t"])).toEqual(["--timings"]);
  expect(complete(["qorvex", "mcp", "doctor", "-h"])).toEqual(["-h"]);
  expect(complete(["qorvex", "--filter-output", "mcp", ""])).toEqual([
    "instructions",
    "mcp",
    "completions",
  ]);
  expect(complete(["qorvex", "instructions", "--"])).not.toContain(
    "--incur-update-check",
  );
  expect(complete(["qorvex", "instructions", "--"])).not.toContain("--mcp");
});

it("completes whole-word inline values with their option spelling", () => {
  expect(
    JSON.parse(
      completionOutput("nushell", ["qorvex", "instructions", "--format=j"]),
    ),
  ).toEqual([{ value: "--format=json" }, { value: "--format=jsonl" }]);
  expect(complete(["qorvex", "instructions", "--target-format="])).toEqual([
    "--target-format=dos-com",
    "--target-format=raw-binary",
  ]);
  expect(complete(["qorvex", "instructions", "--targetFormat=r"])).toEqual([]);
  expect(complete(["qorvex", "instructions", "-f", "r"])).toEqual(["raw-binary"]);
  expect(complete(["qorvex", "instructions", "-f=r"])).toEqual([]);
  expect(
    complete(["qorvex", "instructions", "example.f", "--target-format=r"]),
  ).toEqual(["--target-format=raw-binary"]);
  expect(
    complete(["qorvex", "instructions", "--no-dry-run", "--target-format=r"]),
  ).toEqual(["--target-format=raw-binary"]);
  expect(
    complete([
      "qorvex",
      "instructions",
      "example.bin",
      "--procedure",
      "--target-format=r",
    ]),
  ).toEqual([]);
  expect(
    complete([
      "qorvex",
      "instructions",
      "--procedure",
      "--target-format",
      "--target-format=r",
    ]),
  ).toEqual(["--target-format=raw-binary"]);
  for (const word of [
    "--unknown=j",
    "--procedure=j",
    "--help=t",
    "--format=j=",
  ])
    expect(complete(["qorvex", "instructions", word])).toEqual([]);
  expect(complete(["qorvex", "instructions", "--", "--format=j"])).toEqual([]);
  expect(
    JSON.parse(
      completionOutput("nushell", [
        "qorvex",
        "instructions",
        "--filter-output",
        "--format=j",
      ]),
    ),
  ).toEqual([]);
});

it("preserves command scope and the replacement fragment in Bash inline words", () => {
  expect(
    completeBash("--filter-output=mcp instructions --target-format=r", "r", [
      "--filter-output",
      "=",
      "mcp",
      "instructions",
      "--target-format",
      "=",
      "r",
    ]),
  ).toBe("raw-binary");
  expect(
    completeBash("--filter-output=instructions mcp doctor --format=c", "c", [
      "--filter-output",
      "=",
      "instructions",
      "mcp",
      "doctor",
      "--format",
      "=",
      "c",
    ]),
  ).toBe("");
  expect(
    completeBash("instructions --filter-output=--format=y", "y", [
      "instructions",
      "--filter-output",
      "=",
      "--format",
      "=",
      "y",
    ]),
  ).toBe("");
  expect(
    completeBash("instructions --target-format=", "", [
      "instructions",
      "--target-format",
      "=",
    ]),
  ).toBe("dos-com\vraw-binary");
  expect(
    completeBash("instructions --target-format = r", "r", [
      "instructions",
      "--target-format",
      "=",
      "r",
    ]),
  ).toBe("");
  expect(
    completeBash(
      "--filter-output /tmp/word instructions --target-format=r",
      "r",
      [
        "--filter-output",
        "C:/Temp/word",
        "instructions",
        "--target-format",
        "=",
        "r",
      ],
    ),
  ).toBe("");
  expect(
    completeBash("providers \u00a0--he", "\u00a0--he", [
      "providers",
      "\u00a0--he",
    ]),
  ).toBe("");
});

it.each([
  [
    "providers --filter-output foo=--format=j",
    "j",
    ["providers", "--filter-output", "foo", "=", "--format", "=", "j"],
    "",
  ],
  [
    "--filter-output foo:providers mcp doctor --format c",
    "c",
    [
      "--filter-output",
      "foo",
      ":",
      "providers",
      "mcp",
      "doctor",
      "--format",
      "c",
    ],
    "",
  ],
  [
    "providers --format=j",
    "j",
    ["providers", "--format", "=", "j"],
    "json\vjsonl",
  ],
  ["providers --format j", "j", ["providers", "--format", "j"], "json\vjsonl"],
  [
    "instructions>/dev/null --target-format=r",
    "r",
    ["instructions", ">", "/dev/null", "--target-format", "=", "r"],
    "raw-binary",
  ],
] as const)(
  "preserves Bash word boundaries in %s",
  (line, fragment, words, expected) => {
    expect(completeBash(line, fragment, words)).toBe(expected);
  },
);

it("keeps text beyond the cursor in a spaced Bash filter value", () => {
  const line = "providers --filter-output --he";
  expect(
    completeBash(line, "--he", ["providers", "--filter-output", "--hello"]),
  ).toBe("");
  expect(
    completeBash(
      line,
      "--he",
      ["providers", "--filter-output", "--he", ":", "llo"],
      4,
    ),
  ).toBe("");
});

it("offers Bash enum values when the cursor is just after the equals sign", () => {
  expect(
    completeBash("providers --format=", "", [
      "providers",
      "--format",
      "=",
      "y",
    ]),
  ).toBe("toon\vjson\vyaml\vmd\vjsonl\vcsv\vtsv");
});

it("serves the Bash script through both public generation routes", async () => {
  const ordinary = await serveInProcessCli(createCommandCli(), [
    "completions",
    "bash",
  ]);
  const protocol = await serveInProcessCli(
    createCliShell({
      selectedEnvironment: { COMPLETE: "bash" },
      registrations: [],
    }),
    [],
  );
  expect(ordinary.exitCode).toBe(0);
  expect(ordinary.stdout).toContain('export COMPLETE="bash"');
  expect(protocol.exitCode).toBe(0);
  expect(protocol.stdout.trimEnd()).toBe(ordinary.stdout.trimEnd());

  const help = await serveInProcessCli(createCommandCli(), [
    "completions",
    "bash",
    "--help",
  ]);
  expect(help.exitCode).toBe(0);
  expect(help.stdout).toContain("Usage: qorvex completions");
  expect(help.stdout).not.toContain('export COMPLETE="bash"');
});

it("refuses a second shell", async () => {
  const reply = await serveInProcessCli(createCommandCli(), [
    "completions",
    "bash",
    "fish",
  ]);
  expect(reply.exitCode).toBe(1);
  expect(reply.stdout).toContain("completions expects exactly one shell");
});

workspaceCliTest(
  "explains zsh completion initialization in public help",
  async ({ processes, workspace }) => {
    const environment = {
      ...process.env,
      ...workspace.environment,
      QORVEX_LOG_LEVEL: "silent",
      QORVEX_TEST_NODE: process.execPath,
      QORVEX_TEST_DISPATCHER: resolve("scripts/qorvex.mjs"),
    };
    for (const arguments_ of [["completions", "--help"], ["completions"]]) {
      const help = await processes.run(
        process.execPath,
        [resolve("scripts/qorvex.mjs"), ...arguments_],
        { env: environment },
      );
      expect(help.exitCode, help.stderr).toBe(0);
      expect(help.stdout).toContain(
        "initialize completion with `autoload -Uz compinit; compinit` before evaluating the zsh hook",
      );
    }
  },
);

workspaceCliTest.skipIf(process.platform !== "darwin")(
  "registers zsh completion after compinit",
  async ({ processes, workspace }) => {
    const environment = {
      ...process.env,
      ...workspace.environment,
      QORVEX_LOG_LEVEL: "silent",
      QORVEX_TEST_NODE: process.execPath,
      QORVEX_TEST_DISPATCHER: resolve("scripts/qorvex.mjs"),
    };
    const result = await processes.run(
      "zsh",
      [
        "-f",
        "-c",
        `
qorvex() { "$QORVEX_TEST_NODE" "$QORVEX_TEST_DISPATCHER" "$@"; }
autoload -Uz compinit
compinit -i -D
eval "$(qorvex completions zsh)" || exit
print -r -- "association=\${+_comps[qorvex]}"
`,
      ],
      { env: environment },
    );
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("association=1\n");
  },
);

workspaceCliTest.skipIf(process.platform === "win32")(
  "runs generated Bash completion with valid MCP scope and incomplete global values through the public launcher",
  async ({ processes, workspace }) => {
    const result = await processes.run(
      "bash",
      [
        "--noprofile",
        "--norc",
        "-c",
        `
qorvex() { "$QORVEX_TEST_NODE" "$QORVEX_TEST_DISPATCHER" "$@"; }
eval "$(qorvex completions bash)" || exit
COMP_WORDS=(qorvex mcp "")
COMP_CWORD=2
_incur_complete_qorvex || exit
printf 'mcp=%s\\n' "\${COMPREPLY[*]}"
COMP_WORDS=(qorvex instructions --format "")
COMP_CWORD=3
_incur_complete_qorvex || exit
printf 'format=%s\\n' "\${COMPREPLY[*]}"
COMP_LINE='qorvex instructions --format=j'
COMP_POINT=\${#COMP_LINE}
COMP_WORDS=(qorvex instructions --format = j)
COMP_CWORD=4
_incur_complete_qorvex qorvex j = || exit
printf 'inline=%s\\n' "\${COMPREPLY[*]}"
COMP_LINE='qorvex instructions --format='
COMP_POINT=\${#COMP_LINE}
COMP_WORDS=(qorvex instructions --format =)
COMP_CWORD=3
_incur_complete_qorvex qorvex '' --format || exit
printf 'empty-inline=%s\\n' "\${COMPREPLY[*]}"
COMP_LINE='qorvex instructions --format = j'
COMP_POINT=\${#COMP_LINE}
COMP_WORDS=(qorvex instructions --format = j)
COMP_CWORD=4
_incur_complete_qorvex qorvex j = || exit
printf 'separate-equals=%s\\n' "\${COMPREPLY[*]}"
COMP_LINE='qorvex mcp doctor --'
COMP_POINT=\${#COMP_LINE}
COMP_WORDS=(qorvex mcp doctor --)
COMP_CWORD=3
_incur_complete_qorvex || exit
printf 'doctor=%s\\n' "\${COMPREPLY[*]}"
`,
      ],
      {
        env: {
          ...process.env,
          ...workspace.environment,
          QORVEX_LOG_LEVEL: "silent",
          QORVEX_TEST_NODE: process.execPath,
          QORVEX_TEST_DISPATCHER: resolve("scripts/qorvex.mjs"),
        },
      },
    );
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("mcp=add doctor\n");
    expect(result.stdout).toContain("format=toon json yaml md jsonl csv tsv\n");
    expect(result.stdout).toContain("inline=json jsonl\n");
    expect(result.stdout).toContain(
      "empty-inline=toon json yaml md jsonl csv tsv\n",
    );
    expect(result.stdout).toContain("separate-equals=\n");
    expect(result.stdout).toContain(
      "doctor=--format --json --full-output --help --timings\n",
    );
  },
);
