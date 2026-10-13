export const LARGE_FIXTURE_COUNT: number;
export const HOPPER_C_ORACLE: Readonly<{
  mainProcedure: "main";
  entryProcedure: "qorvex_entry";
  branchProcedure: "qorvex_branch";
  leafProcedure: "qorvex_leaf";
  entryString: "QORVEX_C_ENTRY";
  leafString: "QORVEX_C_LEAF";
  globalName: "qorvex_c_global";
}>;
export function sha256(value: string | Uint8Array): string;
export function generateLargeFixture(): string;
export function sourceDigest(
  sources: readonly { readonly path: string; readonly content: string }[],
): string;
