import { accessSync, constants } from "node:fs";

import type { ConfigurationError } from "../domain/configurationErrors.js";
import { ok, type Result } from "../domain/result.js";
import { parseEnvironment } from "./environment.js";
import { homeDirectoryFromEnvironment } from "./homeDirectory.js";
import type { AppConfig } from "./types.js";
import {
  linuxHopperLauncherCandidates,
  QORVEX_MANAGED_LINUX_HOPPER_LAUNCHER,
} from "../application/LinuxHopper.js";

const DEFAULT_HOPPER_LAUNCHER_PATH =
  "/Applications/Hopper Disassembler.app/Contents/MacOS/hopper";
const executableAvailable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export const defaultHopperLauncherPath = (
  platform: NodeJS.Platform,
  homeDirectory: string,
  executable: (path: string) => boolean = executableAvailable,
): string => {
  if (platform !== "linux") return DEFAULT_HOPPER_LAUNCHER_PATH;
  return (
    linuxHopperLauncherCandidates(homeDirectory).find(executable) ??
    QORVEX_MANAGED_LINUX_HOPPER_LAUNCHER
  );
};

/** Parse provider configuration and runtime prerequisites at the composition root. */
export const parseConfig = (
  environment: Readonly<Record<string, string | undefined>>,
): Result<AppConfig, ConfigurationError> => {
  const parsed = parseEnvironment(environment);
  if (!parsed.ok) return parsed;
  const env = parsed.value;
  return ok({
    ...(env.QORVEX_MCP_MAX_RESPONSE_BYTES === undefined
      ? {}
      : { mcpMaxResponseBytes: env.QORVEX_MCP_MAX_RESPONSE_BYTES }),
    ...(env.QORVEX_MCP_INPUT_SCHEMA_PROFILE === undefined
      ? {}
      : { mcpInputSchemaProfile: env.QORVEX_MCP_INPUT_SCHEMA_PROFILE }),
    analysisProvider: env.QORVEX_ANALYSIS_PROVIDER,
    ...(env.QORVEX_IDA_MCP_CONFIG === undefined
      ? {}
      : { idaMcpConfigPath: env.QORVEX_IDA_MCP_CONFIG }),
    ghidraInstallDir: env.GHIDRA_INSTALL_DIR,
    ghidraJavaHome: env.JAVA_HOME,
    ghidraStartupTimeoutMs: env.QORVEX_GHIDRA_STARTUP_TIMEOUT_MS,
    ...(env.QORVEX_GHIDRA_LANGUAGE_ID === undefined
      ? {}
      : {
          ghidraLanguageOverride: {
            languageId: env.QORVEX_GHIDRA_LANGUAGE_ID,
            ...(env.QORVEX_GHIDRA_COMPILER_SPEC_ID === undefined
              ? {}
              : { compilerSpecId: env.QORVEX_GHIDRA_COMPILER_SPEC_ID }),
          },
        }),
    ...(env.QORVEX_GHIDRA_SEED_FILE === undefined
      ? {}
      : { ghidraSeedFile: env.QORVEX_GHIDRA_SEED_FILE }),
    ...(env.QORVEX_GHIDRA_DISABLED_ANALYZERS === undefined
      ? {}
      : { ghidraDisabledAnalyzers: env.QORVEX_GHIDRA_DISABLED_ANALYZERS }),
    ...(env.QORVEX_GHIDRA_NATIVEAOT_JAR === undefined
      ? {}
      : { ghidraNativeAotJar: env.QORVEX_GHIDRA_NATIVEAOT_JAR }),
    ilspyCmdPath: env.QORVEX_ILSPY_CMD_PATH,
    hopperLauncherPath:
      env.HOPPER_LAUNCHER_PATH ??
      defaultHopperLauncherPath(
        process.platform,
        homeDirectoryFromEnvironment(environment, process.platform),
      ),
    hopperStartupTimeoutMs: env.QORVEX_HOPPER_STARTUP_TIMEOUT_MS,
    hopperTargetPath: env.HOPPER_TARGET_PATH,
    hopperTargetKind: env.HOPPER_TARGET_KIND,
    hopperLoaderArgs: env.loaderArgs,
    logLevel: env.QORVEX_LOG_LEVEL,
    referenceSourcePolicy: {
      secretPatterns: env.referenceSecretPatterns,
    },
  });
};
