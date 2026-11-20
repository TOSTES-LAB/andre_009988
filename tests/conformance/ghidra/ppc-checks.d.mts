import type { ElfFamilyMetadata } from "../../../src/domain/binaryTargetTypes.js";

import type { VerifierCommands } from "../../../scripts/lib/verifier-command-owner.mjs";

type ByteOrder = ElfFamilyMetadata["byteOrder"];
interface ReadelfReport {
  command: string;
  version: string;
  raw: string;
}

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
export interface PowerPc64ReadelfFacts {
  powerpc: ElfFamilyMetadata;
  symbols: Record<
    | "qorvex_ppc64_entry"
    | "qorvex_ppc64_leaf"
    | "qorvex_ppc64_probe"
    | "qorvex_ppc64_global"
    | "qorvex_ppc64_marker",
    string
  >;
  /** ELFv2 local entry addresses of the functions with a TOC prologue. */
  localEntries: Record<"qorvex_ppc64_entry" | "qorvex_ppc64_leaf", string>;
}
export function parsePowerPcReadelf(text: string): PowerPcReadelfFacts;
export function parsePowerPc64Readelf(
  text: string,
  byteOrder: ByteOrder,
): PowerPc64ReadelfFacts;
export function inspectPowerPcReadelf(
  commands: VerifierCommands,
  path: string,
): Promise<PowerPcReadelfFacts & ReadelfReport>;
export function inspectPowerPc64Readelf(
  commands: VerifierCommands,
  path: string,
  byteOrder: ByteOrder,
): Promise<PowerPc64ReadelfFacts & ReadelfReport>;
export function assertPowerPcLoadedImage(
  observations: unknown,
  sha256: string,
): void;
export function assertPowerPc64LoadedImage(
  observations: unknown,
  sha256: string,
  byteOrder: ByteOrder,
): void;
export function assertPowerPcProbe(
  move: unknown,
  branch: unknown,
  address: string,
): void;
export function assertPowerPc64Probe(
  instructions: { move: unknown; branch: unknown; vector: unknown },
  address: string,
  byteOrder: ByteOrder,
): void;
export function assertPowerPcGlobal(bytes: string): void;
export function assertPowerPc64Global(
  bytes: string,
  byteOrder: ByteOrder,
): void;
export function assertPowerPc64EntryPair(
  globalDossier: unknown,
  localDossier: unknown,
  pair: { global: string; local: string },
): void;
