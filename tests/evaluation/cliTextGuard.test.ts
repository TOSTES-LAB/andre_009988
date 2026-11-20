import { expect, it } from "vitest";
import {
  cliTextGuardSelects,
  cliTextOutsideCliCount,
} from "../../scripts/verify/cli-text-guard.mjs";

it.each([
  ["a parenthesized CLI option", '"Raise it (CLI: --max-heap-mb)."'],
  ["a template-built CLI option", "`Raise it (CLI --${flag} <bytes>).`"],
  ["an option named for the CLI", '"or pass --semantic-precision JSON."'],
  ["CLI-only prose", '"Increase it on the CLI."'],
  ["a suggested CLI command", '"Retry, or use qorvex decompile --resume."'],
  ["a backticked CLI command", "`Run \\`qorvex inspect-plist <path>\\` first.`"],
  ["a flag spelled in a binding", 'cliFlag: "--max-heap-mb"'],
  ["a flag spelled as a message", 'userMessage: "--path is required"'],
])("counts %s", (_name, content) => {
  expect(cliTextOutsideCliCount(content)).toBe(1);
});

it.each([
  ["a contract field", '"Increase max_heap_mb on the next call."'],
  ["an MCP operation name", '"Call inspect_plist on the bundle."'],
  ["a word that only starts with qorvex", '"or use reader settings."'],
])("ignores %s", (_name, content) => {
  expect(cliTextOutsideCliCount(content)).toBe(0);
});

it.each(["doctor", "setup", "environment-serve"])(
  "keeps the operator instruction to run host-only qorvex %s",
  (command) => {
    expect(cliTextOutsideCliCount(`"Run \`qorvex ${command} --json\`."`)).toBe(0);
    expect(cliTextOutsideCliCount(`"Retry, or use qorvex ${command}."`)).toBe(0);
  },
);

it.each([
  ["a parenthesized host-only command", '"Retry (CLI: `qorvex setup --json`)."'],
  [
    "a parenthesized host-only command with an option",
    '"(CLI: qorvex doctor --provider ghidra)"',
  ],
])("keeps %s", (_name, content) => {
  expect(cliTextOutsideCliCount(content)).toBe(0);
});

it.each([
  [
    "another option beside a host-only command",
    '"(CLI: --max-heap-mb, or `qorvex doctor`)"',
  ],
  [
    "another command beside a host-only command",
    '"(CLI: `qorvex doctor`, then `qorvex function`)"',
  ],
  [
    "an unquoted command between host-only commands",
    '"(CLI: qorvex doctor, then qorvex function, then qorvex setup)"',
  ],
  [
    "an unquoted command right after a host-only command's arguments",
    '"(CLI: qorvex doctor --json qorvex function)"',
  ],
])("still counts %s", (_name, content) => {
  expect(cliTextOutsideCliCount(content)).toBeGreaterThan(0);
});

it("counts a CLI command that only shares a host-only prefix", () => {
  expect(cliTextOutsideCliCount('"Run `qorvex doctoral`."')).toBe(1);
});

it("selects services but not the CLI layer or CLI-only files", () => {
  expect(cliTextGuardSelects("src/domain/analysisErrorPresentation.ts")).toBe(
    true,
  );
  expect(cliTextGuardSelects("src/cli/contractCommand.ts")).toBe(false);
  expect(cliTextGuardSelects("src/cliOutput.ts")).toBe(false);
  expect(cliTextGuardSelects("src/application/Doctor.ts")).toBe(false);
});
