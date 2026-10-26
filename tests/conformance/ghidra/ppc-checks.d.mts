import type { ElfFamilyMetadata } from "../../../src/domain/binaryTargetTypes.js";

export interface PowerPcReadelfFacts {
  powerpc: ElfFamilyMetadata;
  symbols: Record<
    | "qorvex_ppc_entry"
    | "qorvex_ppc_leaf"
    | "qorvex_ppc_probe"
    | "qorvex_ppc_global"
    | "qorvex_ppc_marker",
    string
  >;
}
export function parsePowerPcReadelf(text: string): PowerPcReadelfFacts;
export function inspectPowerPcReadelf(
  path: string,
): Promise<
  PowerPcReadelfFacts & { command: string; version: string; raw: string }
>;
export function assertPowerPcLoadedImage(
  observations: unknown,
  sha256: string,
): void;
export function assertPowerPcProbe(
  move: unknown,
  branch: unknown,
  address: string,
): void;
export function assertPowerPcGlobal(bytes: string): void;
