import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, it } from "vitest";

import { createTestTempDirectory } from "../../tests/fixtures/temporaryDirectory.js";
import { PRODUCT_IDENTITY } from "../identity.js";
import { resolveBuildComputerEnvironment } from "./BuildComputerEnvironment.js";

const host = async () => {
  const root = await createTestTempDirectory("qorvex-build-environment-");
  const bin = join(root, "bin");
  const cache = join(root, "cache");
  const archive = join(
    cache,
    "qorvex/build-computer",
    `qorvex-${PRODUCT_IDENTITY.packageVersion}.tar.xz`,
  );
  await mkdir(bin);
  await mkdir(join(cache, "qorvex/build-computer"), { recursive: true });
  for (const program of ["agent-env", "docker"])
    await writeFile(join(bin, program), "#!/bin/sh\n", { mode: 0o755 });
  await writeFile(archive, "packed");
  const environment = {
    HOME: join(root, "home"),
    PATH: `relative-bin:${bin}`,
    XDG_CACHE_HOME: cache,
  };
  return { bin, archive, environment };
};

it.skipIf(process.platform === "win32")(
  "resolves every build setting on a host that exports none of them",
  async () => {
    const { bin, archive, environment } = await host();

    const resolved = await resolveBuildComputerEnvironment(
      environment,
      "linux",
    );

    expect(resolved).toMatchObject({
      QORVEX_AGENT_ENV_COMMAND: join(bin, "agent-env"),
      QORVEX_DOCKER_COMMAND: join(bin, "docker"),
      QORVEX_BUILD_COMPUTER_QORVEX_ARCHIVE: archive,
    });
  },
);

it.skipIf(process.platform === "win32")(
  "keeps each build setting the environment sets",
  async () => {
    const { environment } = await host();
    const selected = {
      QORVEX_AGENT_ENV_COMMAND: "/opt/agentenv/bin/agent-env",
      QORVEX_DOCKER_COMMAND: "/usr/local/bin/docker",
      QORVEX_BUILD_COMPUTER_QORVEX_ARCHIVE: "/srv/qorvex-prod.tar.xz",
    };

    expect(
      await resolveBuildComputerEnvironment(
        { ...environment, ...selected },
        "linux",
      ),
    ).toMatchObject(selected);
  },
);

it.skipIf(process.platform === "win32")(
  "looks for defaults only where the caller points",
  async () => {
    const { environment } = await host();
    const empty = await createTestTempDirectory("qorvex-build-defaults-empty-");

    const resolved = await resolveBuildComputerEnvironment(
      environment,
      "linux",
      { archiveDirectory: empty, searchPath: empty },
    );

    expect(resolved).not.toHaveProperty("QORVEX_AGENT_ENV_COMMAND");
    expect(resolved).not.toHaveProperty("QORVEX_DOCKER_COMMAND");
    expect(resolved).not.toHaveProperty("QORVEX_BUILD_COMPUTER_QORVEX_ARCHIVE");
  },
);
