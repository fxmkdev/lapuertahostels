import { invalidateFrontendCache } from "./snapshot-invalidation.mjs";
import assert from "node:assert/strict";
import { writeFile, readFile, appendFile } from "node:fs/promises";
import { recoverWorkflowPin } from "./snapshot-pin.mjs";
import {
  marker,
  required,
  allowedApp,
  isAppMachine,
  isReleaseMachine,
  quoteCommandArgument,
} from "./snapshot-policy.mjs";
export async function maintenanceApps(fly) {
  const target = required(fly.env, "CMS_APP");
  assert(allowedApp(target, fly.env), "Target app is not allowed");
  return fly.env.DEPLOYMENT_ENVIRONMENT === "preview"
    ? fly.apps().filter((app) => allowedApp(app, fly.env))
    : [target];
}

export async function pin(fly) {
  const snapshots = new Set();
  const saved = await recoverWorkflowPin(fly.env, fly.run);
  if (saved) snapshots.add(saved);
  for (const app of await fly.maintenanceApps()) {
    for (const machine of await fly.machines(app)) {
      const value = machine.config?.metadata?.[marker];
      if (value) snapshots.add(JSON.parse(value).snapshot);
    }
  }
  assert(
    snapshots.size <= 1,
    "Affected Machines have conflicting recovery snapshots",
  );
  const pinned = [...snapshots][0];
  assert(
    !pinned ||
      !fly.env.REQUESTED_SNAPSHOT ||
      pinned === fly.env.REQUESTED_SNAPSHOT,
    `Recovery requires snapshot ${pinned}`,
  );
  const id = pinned || fly.env.REQUESTED_SNAPSHOT || "";
  assert(
    typeof id === "string" && (id === "" || /^[a-zA-Z0-9_-]{1,100}$/.test(id)),
    "Invalid recovery snapshot ID",
  );
  if (fly.env.GITHUB_OUTPUT)
    await appendFile(fly.env.GITHUB_OUTPUT, `snapshot_id=${id}\n`);
  return id;
}

function recoveryRecord(fly, machine) {
  const previous = machine.config.metadata?.[marker];
  const record = previous
    ? JSON.parse(previous)
    : {
        snapshot: required(fly.env, "SNAPSHOT_ID"),
        started: machine.state === "started",
        services: machine.config.services?.map((service) => ({
          autostart: service.autostart,
          min_machines_running: service.min_machines_running,
        })),
        restart: machine.config.restart,
      };
  assert(
    record.snapshot === fly.env.SNAPSHOT_ID,
    `Recover using pinned snapshot ${record.snapshot}`,
  );
  return record;
}
async function pauseMachine(fly, app, machine, affected, save) {
  const record = recoveryRecord(fly, machine);
  const config = structuredClone(machine.config);
  config.metadata = { ...config.metadata, [marker]: JSON.stringify(record) };
  config.services?.forEach((service) => {
    service.autostart = false;
    service.min_machines_running = 0;
  });
  config.restart = { policy: "no" };
  affected.push({ app, id: machine.id, ...record });
  await save();
  await fly.update(app, machine, config);
  await fly.stop(app, await fly.machine(app, machine.id));
}
export async function pause(fly, bestEffort = false) {
  const affected = [];
  const errors = [];
  const save = () =>
    writeFile(
      "snapshot-maintenance.json",
      JSON.stringify(
        { snapshot: fly.env.SNAPSHOT_ID, machines: affected },
        null,
        2,
      ),
    );
  await save();
  for (const app of await fly.maintenanceApps()) {
    try {
      for (const machine of (await fly.machines(app)).filter(isAppMachine)) {
        try {
          await pauseMachine(fly, app, machine, affected, save);
        } catch (error) {
          if (!bestEffort) throw error;
          errors.push(error);
        }
      }
    } catch (error) {
      if (!bestEffort) throw error;
      errors.push(error);
    }
  }
  await save();
  if (errors.length)
    throw new AggregateError(
      errors,
      "Some CMS Machines could not be kept offline; inspect Fly state",
    );
}
export async function resume(fly) {
  const saved = JSON.parse(await readFile("snapshot-maintenance.json", "utf8"));
  assert(saved.snapshot === fly.env.SNAPSHOT_ID, "Recovery snapshot mismatch");
  for (const record of saved.machines) {
    assert(allowedApp(record.app, fly.env), "Recovery app is not allowed");
    const current = (await fly.machines(record.app)).find(
      ({ id }) => id === record.id,
    );
    if (!current) continue; // Deployment may have replaced a Machine.
    await fly.stop(record.app, current);
    const config = structuredClone(current.config);
    delete config.metadata?.[marker];
    config.services?.forEach((service, index) => {
      const original = record.services?.[index];
      service.autostart = original?.autostart ?? true;
      if (original?.min_machines_running !== undefined)
        service.min_machines_running = original.min_machines_running;
      else delete service.min_machines_running;
    });
    if (record.restart) config.restart = record.restart;
    else delete config.restart;
    await fly.update(record.app, current, config);
    if (record.started || record.app === fly.env.CMS_APP)
      await fly.start(record.app, current.id);
  }
}

export async function halt(fly) {
  const errors = [];
  // A cancelled runner must stop its release command too, so it cannot keep
  // modifying the shared DB after the workflow's lifecycle lock releases.
  for (const app of await fly.maintenanceApps()) {
    try {
      for (const machine of (await fly.machines(app)).filter(
        isReleaseMachine,
      )) {
        try {
          await fly.stop(app, machine);
        } catch (error) {
          if (error.status !== 404) errors.push(error);
        } // auto_destroy
      }
    } catch (error) {
      errors.push(error);
    }
  }
  // Also catches application VMs created by a failed deployment. Existing
  // markers preserve their original recovery configuration.
  try {
    await fly.pause(true);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Some CMS Machines could not be kept offline; inspect Fly state",
    );
}

export async function invalidate(fly) {
  let apps;
  if (fly.env.DEPLOYMENT_ENVIRONMENT === "preview") {
    const prefix = `${required(fly.env, "FRONTEND_PREVIEW_APP_PREFIX")}-`;
    apps = fly
      .apps()
      .filter(
        (app) =>
          app.startsWith(prefix) &&
          /^[a-f0-9]+$/.test(app.slice(prefix.length)),
      );
  } else apps = [required(fly.env, "FRONTEND_APP")];
  const code = `await (${invalidateFrontendCache.toString()})();`;
  for (const app of apps) {
    const machine = (await fly.machines(app)).find(isAppMachine);
    if (!machine) continue; // A provisioned app may not have been deployed yet.
    if (machine.state !== "started") await fly.start(app, machine.id);
    // The credential is evaluated inside the frontend; it never leaves Fly.
    fly.run(
      "flyctl",
      [
        "ssh",
        "console",
        "--app",
        app,
        "--machine",
        machine.id,
        "--command",
        `node --input-type=module -e ${quoteCommandArgument(code)}`,
      ],
      { stdio: "inherit" },
    );
  }
}
