import type { DoctorProviderInspection } from "./Doctor.js";
import { compareUnicodeCodePoints } from "../domain/unicodeCodePointOrder.js";

const SELECTED_REGISTRATION_SETTINGS = [
  "QORVEX_ANALYSIS_PROVIDER",
  "QORVEX_GHIDRA_STARTUP_TIMEOUT_MS",
  "QORVEX_HOPPER_STARTUP_TIMEOUT_MS",
  "QORVEX_JEB_MCP_TIMEOUT_MS",
  "QORVEX_MCP_INPUT_SCHEMA_PROFILE",
  "QORVEX_REGEX_MATCHING_DEADLINE_MS",
] as const;

/** Preserve selected setup settings without copying unrelated process values. */
export const explicitSetupRegistrationEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    SELECTED_REGISTRATION_SETTINGS.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

/** Preserve adapter-published settings independently of runtime readiness. */
export const providerRegistrationEnvironment = (
  inspections: readonly DoctorProviderInspection[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    inspections
      .flatMap(({ registrationEnvironment }) =>
        Object.entries(registrationEnvironment),
      )
      .sort(([left], [right]) => compareUnicodeCodePoints(left, right)),
  );
