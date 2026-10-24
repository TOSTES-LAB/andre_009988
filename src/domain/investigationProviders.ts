/** Provider identity for deterministic composed analysis workflows. */
export const QORVEX_WORKFLOW_PROVIDER = {
  id: "qorvex-workflow",
  name: "QORVEX composed investigation workflow",
  version: "1",
} as const;

/** Provider identity for deterministic artifact inventories. */
export const ARTIFACT_GRAPH_PROVIDER = Object.freeze({
  id: "qorvex-artifact-graph",
  name: "QORVEX safe artifact graph provider",
  version: "1",
} as const);

/** Provider identity for execution-free managed PE/CLI analysis. */
export const MANAGED_STATIC_PROVIDER = Object.freeze({
  id: "qorvex-dotnet-static",
  name: "QORVEX managed static analysis provider",
  version: "1",
} as const);

/** Provider identity for portable, execution-free PE resource decoding. */
export const PE_RESOURCES_PROVIDER = Object.freeze({
  id: "qorvex-pe-resources",
  name: "QORVEX PE resource parser",
  version: "1",
} as const);

/** Provider identity for portable, execution-free PE Authenticode table decoding. */
export const PE_CERTIFICATES_PROVIDER = Object.freeze({
  id: "qorvex-pe-certificates",
  name: "QORVEX PE certificate parser",
  version: "1",
} as const);

/** Provider identity for portable, execution-free PE import-table decoding. */
export const PE_IMPORTS_PROVIDER = Object.freeze({
  id: "qorvex-pe-imports",
  name: "QORVEX PE import parser",
  version: "1",
} as const);

/** Provider identity for portable, execution-free ELF note-table decoding. */
export const DEVICETREE_PROVIDER = Object.freeze({
  id: "qorvex-devicetree",
  name: "QORVEX flattened devicetree parser",
  version: "1",
} as const);

export const ELF_NOTES_PROVIDER = Object.freeze({
  id: "qorvex-elf-notes",
  name: "QORVEX ELF note parser",
  version: "1",
} as const);

/** Provider identity for portable, execution-free Apple .ips crash-report decoding. */
export const APPLE_IPS_PROVIDER = Object.freeze({
  id: "qorvex-apple-ips",
  name: "QORVEX Apple IPS parser",
  version: "1",
} as const);
/** Provider identity for portable, execution-free Linux kernel-module metadata. */
export const KERNEL_MODULE_PROVIDER = Object.freeze({
  id: "qorvex-kernel-module",
  name: "QORVEX kernel module parser",
  version: "1",
} as const);

/** Provider identity for execution-free Shannon byte-entropy profiling. */
export const BYTE_ENTROPY_PROVIDER = Object.freeze({
  id: "byte-entropy",
  name: "QORVEX byte entropy",
  version: "1",
} as const);

/** Provider identity for portable, execution-free PE and ELF export tables. */
export const NATIVE_EXPORTS_PROVIDER = Object.freeze({
  id: "qorvex-native-exports",
  name: "QORVEX PE/ELF export table reader",
  version: "1",
} as const);

/** Provider identity for deterministic managed-code comparison workflows. */
export const MANAGED_WORKFLOW_PROVIDER = {
  id: "qorvex-dotnet-workflows",
  name: "QORVEX managed-code workflows",
  version: "1",
} as const;

/** Provider identity for deterministic Apple application projections. */
export const APPLE_APPLICATION_PROVIDER = {
  id: "qorvex-apple-application",
  name: "QORVEX Apple application workflows",
  version: "1",
} as const;

/** Provider identity for deterministic Android application projections. */
export const ANDROID_APPLICATION_PROVIDER = {
  id: "qorvex-android-application",
  name: "QORVEX Android application workflows",
  version: "1",
} as const;

/** Provider identity for deterministic HarmonyOS application projections. */
export const HARMONY_APPLICATION_PROVIDER = {
  id: "qorvex-harmony-application",
  name: "QORVEX HarmonyOS application workflows",
  version: "1",
} as const;

/** Provider identity for verified publication of retained website scripts. */
export const WEB_SCRIPT_EXPORT_PROVIDER = {
  id: "qorvex-web-script-export",
  name: "QORVEX captured script export",
  version: "1",
} as const;

/** Provider identity for deterministic static JavaScript application analysis. */
export const JAVASCRIPT_APPLICATION_PROVIDER = {
  id: "qorvex-javascript-application",
  name: "QORVEX JavaScript application analyzer",
  version: "1",
} as const;

/** Provider identity for static/passive-runtime JavaScript reconciliation. */
export const JAVASCRIPT_RUNTIME_RECONCILIATION_PROVIDER = {
  id: "qorvex-javascript-runtime-reconciliation",
  name: "QORVEX JavaScript runtime reconciliation",
  version: "1",
} as const;

/** Provider identity for selected views of retained analysis Evidence. */
export const ANALYSIS_VIEW_PROVIDER = {
  id: "qorvex-analysis-view",
  name: "QORVEX analysis view projection",
  version: "1",
} as const;

/** Provider identity for graph-native feature tracing and version comparison. */
export const JAVASCRIPT_APPLICATION_WORKFLOW_PROVIDER = {
  id: "qorvex-javascript-application-workflows",
  name: "QORVEX JavaScript application workflows",
  version: "1",
} as const;

/** Provider identity for deterministic Evidence bundle comparisons. */
export const BUNDLE_COMPARISON_PROVIDER = {
  id: "qorvex-bundle-comparison",
  name: "QORVEX Evidence bundle comparison",
  version: "1",
} as const;

/** Provider identity for comparison-Evidence behavior aggregation. */
export const CHANGED_BEHAVIOR_PROVIDER = {
  id: "qorvex-changed-behavior",
  name: "QORVEX changed behavior investigation",
  version: "1",
} as const;

/** Provider identity for Evidence-backed call-path reconstruction. */
export const CALL_PATH_PROVIDER = {
  id: "qorvex-call-path",
  name: "QORVEX call path reconstruction",
  version: "1",
} as const;

/** Provider identity for explicit static/runtime hypothesis correlation. */
export const STATIC_RUNTIME_PROVIDER = {
  id: "qorvex-static-runtime-correlation",
  name: "QORVEX static/runtime correlation",
  version: "1",
} as const;

/** Provider identity for finite reconstruction specification verification. */
export const RECONSTRUCTION_PROVIDER = {
  id: "qorvex-reconstruction-verifier",
  name: "QORVEX reconstruction verifier",
  version: "1",
} as const;

export const PE_LOAD_CONFIG_PROVIDER = Object.freeze({
  id: "qorvex-pe-load-config",
  name: "QORVEX PE TLS/load-config parser",
  version: "1",
} as const);
