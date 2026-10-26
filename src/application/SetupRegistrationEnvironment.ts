import type { DoctorProviderInspection } from "./Doctor.js";
import { compareUnicodeCodePoints } from "../domain/unicodeCodePointOrder.js";

const SELECTED_REGISTRATION_SETTINGS = [
  "GHIDRA_INSTALL_DIR",
  "JAVA_HOME",
  "HOPPER_LAUNCHER_PATH",
  "QORVEX_ILSPY_CMD_PATH",
  "QORVEX_IDA_MCP_CONFIG",
  "QORVEX_JADX_MCP_JAR",
  "QORVEX_JADX_HEAP_MIB",
  "QORVEX_JADX_ACTIVE_PROCESSOR_COUNT",
  "QORVEX_JADX_OPERATION_TIMEOUT_MS",
  "QORVEX_KUNA_COMMAND",
  "QORVEX_KUNA_CACHE_DIR",
  "QORVEX_KUNA_CACHE_MAX_BYTES",
  "QORVEX_KUNA_PROJECT_TIMEOUT_MS",
  "QORVEX_KUNA_TIMEOUT_MS",
  "QORVEX_KUNA_JOBS",
  "QORVEX_ANALYSIS_PROVIDER",
  "QORVEX_ASAR_MAX_HEADER_BYTES",
  "QORVEX_BRIDGE_MAX_REQUEST_BYTES",
  "QORVEX_CAPTURE_DECODER_OLD_GENERATION_MIB",
  "QORVEX_GHIDRA_DECOMPILE_TIMEOUT_SECONDS",
  "QORVEX_GHIDRA_STARTUP_TIMEOUT_MS",
  "QORVEX_GHIDRA_LANGUAGE_ID",
  "QORVEX_GHIDRA_COMPILER_SPEC_ID",
  "QORVEX_GHIDRA_DISABLED_ANALYZERS",
  "QORVEX_GHIDRA_SEED_FILE",
  "QORVEX_GHIDRA_NATIVEAOT_JAR",
  "QORVEX_HOPPER_STARTUP_TIMEOUT_MS",
  "QORVEX_JEB_MCP_TIMEOUT_MS",
  "QORVEX_MCP_INPUT_SCHEMA_PROFILE",
  "QORVEX_MCP_OUTPUT_SCHEMA_PROFILE",
  "QORVEX_MCP_MAX_RESPONSE_BYTES",
  "QORVEX_NATIVE_MATCHING_REPRESENTATION_BYTES",
  "QORVEX_REGEX_MATCHING_DEADLINE_MS",
  "QORVEX_REGEX_WORKER_HEAP_REQUEST_MIB",
  "QORVEX_MCP_INITIALIZE_BUDGET_MS",
  "QORVEX_MCP_TOOLS_LIST_BUDGET_MS",
  "QORVEX_MCP_FIRST_CATALOG_BUDGET_MS",
  "QORVEX_MCP_DOCTOR_DEADLINE_MS",
] as const;

/** Explicit selections override discovered defaults even when a provider is unavailable.
 * This is a registration policy, not a prefix match against the ambient environment.
 */
export const explicitSetupRegistrationEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    SELECTED_REGISTRATION_SETTINGS.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

/** Discovered provider defaults; explicit selections are applied separately. */
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
