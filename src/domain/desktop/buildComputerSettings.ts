/** Host controls that cannot also be supplied as bundle settings. */
export const BUILD_COMPUTER_SETTINGS = [
  "QORVEX_AGENT_ENV_COMMAND",
  "QORVEX_DOCKER_COMMAND",
  "QORVEX_BUILD_COMPUTER_QORVEX_ARCHIVE",
] as const;

/** Bundle variable names; host-control names are excluded separately. */
export const BUNDLE_SETTING_VARIABLE = /^QORVEX_[A-Z0-9_]{1,60}$/u;
