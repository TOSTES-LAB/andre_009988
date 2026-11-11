/**
 * Numeric `QORVEX_` limits that are not runtime analysis settings.
 *
 * The static check in `scripts/verify/qorvex-numeric-limits.mjs` checks recognized
 * TypeScript reads against this list and `ANALYSIS_SETTINGS`. External readers
 * and generated controls declare separate behavioral witnesses, which the
 * Node-only check cannot verify. Every remaining entry is restart-only; limits
 * checked on each call belong in `ANALYSIS_SETTINGS` instead of this list.
 *
 * Narrative bounds, owners, and the non-numeric settings live in
 * `docs/design/qorvex-limit-inventory.md`.
 */
export interface NumericLimitRegistryEntry {
  readonly name: string;
  readonly update_mode: "restart";
  readonly policy: "restart-only";
  readonly read: "startup" | "construction";
  readonly reason: string;
  /** Read outside the TypeScript scan or generated into a bridge; execution needs its behavioral witness. */
  readonly provenance?: {
    readonly kind: "external-reader" | "generated-control";
    readonly source: string;
    readonly witness: string;
    readonly generator?: string;
    readonly generatorWitness?: string;
  };
}

export const NUMERIC_LIMIT_REGISTRY = [
  {
    name: "QORVEX_DEBUGGER_MAX_PENDING_COMMANDS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Caps the pending-command queue created with the debugger session manager. It is pool capacity for that manager, not a budget checked independently on each command.",
  },
  {
    name: "QORVEX_DEBUGGER_MAX_SESSIONS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Caps how many debugger sessions the session manager created at startup will admit. Changing the pool size of a manager that already exists requires a new QORVEX process.",
  },
  {
    name: "QORVEX_HOPPER_DEMO_DIALOG_TIMEOUT_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "The Linux private-display adapter reads this watch from the process environment when that helper starts. A running adapter does not observe a value stored only in the QORVEX process.",
    provenance: {
      kind: "external-reader",
      source: "scripts/hopper-demo-x11.py",
      witness: "tests/boundary/providers/hopper/linuxPrivateDisplay.test.ts",
    },
  },
  {
    name: "QORVEX_JADX_ACTIVE_PROCESSOR_COUNT",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Passed to the JVM as -XX:ActiveProcessorCount when the JADX worker process starts. A running JVM does not adopt a new processor count.",
  },
  {
    name: "QORVEX_JADX_HEAP_MIB",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Passed to the JVM as -Xmx when the JADX worker process starts. A running JVM does not adopt a new heap size.",
  },
  {
    name: "QORVEX_KUNA_CACHE_MAX_BYTES",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Sizes the Kuna project cache when that cache is constructed for the provider. An existing cache does not resize from a later value.",
  },
  {
    name: "QORVEX_KUNA_JOBS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Selects the Kuna worker-pool width when the provider builds its run slots. The pool is not resized for a process that is already running.",
  },
  {
    name: "QORVEX_MCP_DOCTOR_DEADLINE_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Bounds the MCP doctor phase while the server is starting. It shapes server startup, not a later analysis call.",
  },
  {
    name: "QORVEX_MCP_FIRST_CATALOG_BUDGET_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Bounds the first MCP catalog phase while the server is starting. It shapes server startup, not a later analysis call.",
  },
  {
    name: "QORVEX_MCP_INITIALIZE_BUDGET_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Bounds the MCP initialize phase while the server is starting. It shapes server startup, not a later analysis call.",
  },
  {
    name: "QORVEX_MCP_MAX_INPUT_ELEMENTS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Sizes argument admission for the MCP server created at process start. A running server does not rebuild that parser for a new allowance.",
  },
  {
    name: "QORVEX_MCP_MAX_RESPONSE_BYTES",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Sizes the MCP stdio receive buffer when the server process starts. A running transport and the paired client buffer do not adopt a new ceiling.",
  },
  {
    name: "QORVEX_MCP_TOOLS_LIST_BUDGET_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Bounds the MCP tools/list phase while the server is starting. It shapes server startup, not a later analysis call.",
  },
  {
    name: "QORVEX_RECONNECT_TIMEOUT_SECONDS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Fixed 30-second value written into the Hopper bridge helper from HOPPER_SHUTDOWN_TIMEOUT_MS. It is not a caller-selected launch setting.",
    provenance: {
      kind: "generated-control",
      source: "bridge/hopper_bridge.py",
      generator: "src/hopper/BridgeLauncher.ts",
      generatorWitness: "src/hopper/bridgeBootstrapLimit.test.ts",
      witness: "tests/boundary/providers/hopper/hopperBridgeReconnect.test.ts",
    },
  },
  {
    name: "QORVEX_SWIFTC_COMPILE_TIMEOUT_MS",
    update_mode: "restart",
    policy: "restart-only",
    read: "startup",
    reason:
      "Captured when the Darwin ownership-helper reader is constructed at process start. That helper compile uses the captured deadline, so a later value needs a new QORVEX process.",
  },
] as const satisfies readonly NumericLimitRegistryEntry[];
