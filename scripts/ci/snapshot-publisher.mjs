import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { required, isAppMachine, immutableImage } from "./snapshot-policy.mjs";

export function publisherName(env, requireWorkflow = false) {
  if (env.GITHUB_RUN_ID || env.GITHUB_RUN_ATTEMPT || requireWorkflow) {
    assert(
      /^\d+$/.test(env.GITHUB_RUN_ID ?? "") &&
        /^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? ""),
      "Publisher cleanup requires a workflow run and attempt",
    );
    return `content-snapshot-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  }
  return `content-snapshot-${Date.now()}`;
}
function publisherConfig(source, app) {
  const image = immutableImage(source);
  return {
    image,
    env: {
      ...source.config.env,
      DEPLOYMENT_ENVIRONMENT: "production",
      SNAPSHOT_PRODUCTION_APP: app,
      SNAPSHOT_SOURCE_IMAGE: image,
    },
    init: {
      cmd: ["node", "apps/cms/scripts/content-snapshots/cli.mjs", "publish"],
    },
    guest: source.config.guest,
    services: [],
    restart: { policy: "no" },
  };
}
async function launchPublisher(fly, app, source, name, dir) {
  const config = publisherConfig(source, app);
  const file = join(dir, "machine.json");
  await writeFile(file, JSON.stringify(config));
  fly.run(
    "flyctl",
    [
      "machine",
      "run",
      config.image,
      "--app",
      app,
      "--name",
      name,
      "--region",
      source.region,
      "--machine-config",
      file,
      "--detach",
      "--restart",
      "no",
    ],
    { stdio: "inherit" },
  );
  const machine = (await fly.machines(app)).find(
    (machine) => machine.name === name,
  );
  assert(machine, "Publisher Machine was not created");
  return machine;
}
export async function cleanupPublisher(
  fly,
  name = publisherName(fly.env, true),
) {
  const app = required(fly.env, "SNAPSHOT_PRODUCTION_APP");
  const machine = (await fly.machines(app)).find(
    (machine) => machine.name === name,
  );
  if (machine)
    await fly.request(
      `/apps/${app}/machines/${machine.id}?force=true`,
      "DELETE",
    );
}
export async function publish(fly) {
  const app = required(fly.env, "SNAPSHOT_PRODUCTION_APP");
  const running = (await fly.machines(app)).filter(isAppMachine);
  assert(running.length, "Production has no deployed CMS Machines");
  const image = immutableImage(running[0]);
  assert(
    running.every((machine) => immutableImage(machine) === image),
    "Production CMS Machines have different images",
  );
  const name = publisherName(fly.env);
  const dir = await mkdtemp(join(tmpdir(), "snapshot-machine-"));
  try {
    const machine = await launchPublisher(fly, app, running[0], name, dir);
    await fly.completed(app, machine.id);
  } finally {
    // The workflow also invokes this after cancellation, when Node's finally
    // block may not run. Keep exit evidence until completion has been checked.
    try {
      await cleanupPublisher(fly, name);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
