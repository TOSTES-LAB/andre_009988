/** Host controls that cannot also be supplied as bundle settings. */
export const BUILD_COMPUTER_SETTINGS = [
  "QORVEX_AGENT_ENV_COMMAND",
  "QORVEX_DOCKER_COMMAND",
  "QORVEX_BUILD_COMPUTER_QORVEX_ARCHIVE",
] as const;

/** Bundle variable names, excluding the host controls, in the advertised schema too. */
export const BUNDLE_SETTING_VARIABLE = new RegExp(
  `^(?!(?:${BUILD_COMPUTER_SETTINGS.join("|")})$)QORVEX_[A-Z0-9_]{1,60}$`,
  "u",
);
