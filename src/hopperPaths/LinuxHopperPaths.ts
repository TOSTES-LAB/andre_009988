import { appendCallerPath } from "../filesystem/callerPath.js";

/** Canonical launcher path for a legacy user-local Linux Hopper installation. */
const linuxHopperLauncherPath = (home: string): string =>
  appendCallerPath(home, ".local/share/qorvex/hopper/bin/Hopper", "linux");

/** QORVEX's managed Linux install path, preferred when no explicit launcher is set. */
export const QORVEX_MANAGED_LINUX_HOPPER_LAUNCHER = "/opt/hopper/bin/Hopper";

/** Other system-wide Hopper paths used by package installations. */
const systemLinuxHopperLauncherCandidates: readonly string[] = [
  "/opt/hopper-v4/bin/hopper",
  "/usr/bin/hopper",
];

/** Probe QORVEX-managed and user-local installs before arbitrary system builds. */
export const linuxHopperLauncherCandidates = (
  home: string | undefined,
): readonly string[] => [
  QORVEX_MANAGED_LINUX_HOPPER_LAUNCHER,
  ...(home === undefined
    ? []
    : [linuxHopperLauncherPath(home), ...systemLinuxHopperLauncherCandidates]),
];
