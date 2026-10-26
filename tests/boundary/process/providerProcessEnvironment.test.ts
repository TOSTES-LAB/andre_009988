import { expect, it } from "vitest";

import {
  ProviderProcessSupervisor,
  spawnOwnedProviderProcess,
} from "../../../src/process/ProviderProcess.js";

const hostEnvironment = {
  PATH: "host-search-path",
  QORVEX_CASE_TEST: "host-case",
  QORVEX_EMPTY_TEST: "host-empty",
  QORVEX_UNSET_TEST: "host-unset",
  QORVEX_EXACT_UNSET_TEST: "host-exact-unset",
  QORVEX_PROCESS_RUN_ID: "host-run-id",
};

const observeEnvironment = async (
  platform: NodeJS.Platform,
  path: string | undefined,
): Promise<Record<string, string>> => {
  const launched = await spawnOwnedProviderProcess({
    command: process.execPath,
    arguments: [
      "-e",
      `process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() === "PATH" || key.toUpperCase().startsWith("QORVEX_")))));`,
    ],
    hostEnvironment,
    env: {
      Path: path,
      qorvex_case_test: "caller-case",
      qorvex_empty_test: "",
      qorvex_unset_test: undefined,
      QORVEX_EXACT_UNSET_TEST: undefined,
      QORVEX_PROCESS_RUN_ID: "caller-uppercase-run-id",
      qorvex_process_run_id: "caller-lowercase-run-id",
    },
    platform,
    runId: "owned-run-id",
  });
  const supervisor = new ProviderProcessSupervisor({
    ...launched,
    ownsProcessLifetime: true,
  });
  try {
    expect(await supervisor.waitForOutputClose(2_000)).toBe(true);
    const snapshot = supervisor.snapshot();
    expect(snapshot.exitCode, snapshot.stderr.text).toBe(0);
    return JSON.parse(snapshot.stdout.text) as Record<string, string>;
  } finally {
    const stopped = await supervisor.stop();
    expect(stopped.status).not.toBe("incomplete");
  }
};

it.each([undefined, ""])(
  "preserves Windows caller PATH %s and ownership token precedence at real process creation",
  async (path) => {
    // On Windows this exercises the native Job Object launcher. On POSIX the
    // configured-platform seam exposes the exact producer environment to a real child.
    const observed = await observeEnvironment("win32", path);
    const entries = Object.entries(observed);
    const canonical = Object.fromEntries(
      entries.map(([name, value]) => [name.toUpperCase(), value]),
    );
    expect(canonical).toEqual({
      ...(path === undefined ? {} : { PATH: "" }),
      QORVEX_CASE_TEST: "caller-case",
      QORVEX_EMPTY_TEST: "",
      QORVEX_PROCESS_RUN_ID: "owned-run-id",
    });
    expect(entries).toHaveLength(Object.keys(canonical).length);
  },
);

it.skipIf(process.platform === "win32")(
  "keeps case-distinct POSIX variables and exact-key removal through real process creation",
  async () => {
    expect(await observeEnvironment(process.platform, undefined)).toEqual({
      PATH: "host-search-path",
      QORVEX_CASE_TEST: "host-case",
      QORVEX_EMPTY_TEST: "host-empty",
      QORVEX_UNSET_TEST: "host-unset",
      QORVEX_PROCESS_RUN_ID: "owned-run-id",
      qorvex_case_test: "caller-case",
      qorvex_empty_test: "",
      qorvex_process_run_id: "caller-lowercase-run-id",
    });
  },
);
