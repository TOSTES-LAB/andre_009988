import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

import { bashCompletionScript } from "../../../src/cli/bashCompletionRegistration.js";

const execute = promisify(execFile);

it.skipIf(process.platform === "win32")(
  "registers and invokes dynamic candidates in the host Bash",
  async () => {
    const script = bashCompletionScript("qorvex");
    const { stdout, stderr } = await execute(
      "bash",
      [
        "--noprofile",
        "--norc",
        "-c",
        `${script}
complete -p qorvex || exit
qorvex() {
  [[ "$COMPLETE" == bash && "$_COMPLETE_INDEX" == 1 ]] || return 1
  [[ "$1" == -- && "$2" == qorvex && "$3" == ana ]] || return 1
  printf 'analyze\\013analyze-web-bundle\\013'
}
COMP_WORDS=(qorvex ana)
COMP_CWORD=1
_incur_complete_qorvex || exit
printf '%s\\n' "\${COMPREPLY[@]}"
`,
      ],
      { timeout: 5_000 },
    );
    expect(stderr).toBe("");
    expect(stdout).toContain("-F _incur_complete_qorvex qorvex");
    expect(stdout).toContain("\nanalyze\nanalyze-web-bundle\n");
  },
);

it.skipIf(process.platform === "win32")(
  "falls back when nosort and compopt are unavailable",
  async () => {
    const { stdout, stderr } = await execute(
      "bash",
      [
        "--noprofile",
        "--norc",
        "-c",
        `complete() {
  case " $* " in *" -o nosort "*) return 2;; esac
  builtin complete "$@"
}
compopt() { echo 'unexpected compopt' >&2; return 1; }
type() { [[ "$1" != compopt ]] && builtin type "$@"; }
${bashCompletionScript("qorvex")}
builtin complete -p qorvex || exit
qorvex() { printf 'group\\001\\013'; }
COMP_WORDS=(qorvex gr)
COMP_CWORD=1
_incur_complete_qorvex || exit
printf '%s\\n' "\${COMPREPLY[@]}"
`,
      ],
      { timeout: 5_000 },
    );
    expect(stderr).toBe("");
    expect(stdout).toContain("-F _incur_complete_qorvex qorvex");
    expect(stdout).not.toContain("nosort");
    expect(stdout).toContain("\ngroup\n");
  },
);
