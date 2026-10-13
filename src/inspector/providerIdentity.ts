import type { ProviderIdentity } from "../application/AnalysisProvider.js";

/** Identity available without loading the V8InspectorProvider implementation. */
export const V8_INSPECTOR_PROVIDER_IDENTITY: ProviderIdentity = Object.freeze({
  id: "qorvex-v8-inspector",
  name: "QORVEX passive Node/Electron V8 Inspector provider",
  version: "1",
});
