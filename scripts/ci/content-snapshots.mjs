import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { recoverWorkflowPin } from "./snapshot-pin.mjs";

const marker = "content_snapshot_maintenance";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const required = (env, key) => {
  assert(env[key], `Missing ${key}`);
  return env[key];
};
export function allowedApp(app, env) {
  const production = required(env, "SNAPSHOT_PRODUCTION_APP");
  if (app === production) return false;
  if (env.DEPLOYMENT_ENVIRONMENT === "staging")
    return app === required(env, "SNAPSHOT_STAGING_APP");
  assert(
    env.DEPLOYMENT_ENVIRONMENT === "preview",
    "Invalid maintenance environment",
  );
  const prefix = `${required(env, "SNAPSHOT_PREVIEW_APP_PREFIX")}-`;
  return app.startsWith(prefix) && /^[a-f0-9]+$/.test(app.slice(prefix.length));
}
export class Fly {
  constructor(env, { fetcher = fetch, wait = sleep, run = execFileSync } = {}) {
    this.env = env;
    this.fetcher = fetcher;
    this.wait = wait;
    this.run = run;
  }
  async request(path, method = "GET", body) {
    const response = await this.fetcher(`https://api.machines.dev/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${required(this.env, "FLY_API_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Fly Machines API ${method} failed (${response.status})`),
        { status: response.status },
      );
    return response.status === 204 ? undefined : response.json();
  }
  machines(app) {
    return this.request(`/apps/${app}/machines`);
  }
  machine(app, id) {
    return this.request(`/apps/${app}/machines/${id}`);
  }
  update(app, machine, config) {
    return this.request(`/apps/${app}/machines/${machine.id}`, "POST", {
      config,
      skip_launch: true,
    });
  }
  async stopped(app, id) {
    for (let i = 0; i < 90; i++) {
      const machine = await this.machine(app, id);
      if (["stopped", "destroyed"].includes(machine.state)) return machine;
      await this.wait(2000);
    }
    throw new Error(`Timed out stopping ${app}/${id}`);
  }
  async stop(app, machine) {
    if (machine.state !== "stopped") {
      await this.transition(app, machine.id, "stop", {
        signal: "SIGTERM",
        timeout: "30s",
      });
      await this.stopped(app, machine.id);
    }
  }
  async transition(app, id, action, body = {}) {
    for (let i = 0; i < 90; i++) {
      try {
        return await this.request(
          `/apps/${app}/machines/${id}/${action}`,
          "POST",
          body,
        );
      } catch (error) {
        // A config update is asynchronous. Fly returns 412 while the old
        // instance is being replaced, even when its visible state is stopped.
        if (![409, 412].includes(error.status)) throw error;
        await this.wait(2000);
      }
    }
    throw new Error(`Timed out waiting to ${action} ${app}/${id}`);
  }
  async start(app, id) {
    const machine = await this.machine(app, id);
    if (machine.state !== "started") await this.transition(app, id, "start");
    for (let i = 0; i < 90; i++) {
      if ((await this.machine(app, id)).state === "started") return;
      await this.wait(2000);
    }
    throw new Error(`Timed out starting ${app}/${id}`);
  }
  apps() {
    return JSON.parse(
      this.run(
        "flyctl",
        ["apps", "list", "--org", required(this.env, "FLY_ORG"), "--json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
      ),
    ).map((app) => app.Name ?? app.ID);
  }
  async maintenanceApps() {
    const target = required(this.env, "CMS_APP");
    assert(allowedApp(target, this.env), "Target app is not allowed");
    return this.env.DEPLOYMENT_ENVIRONMENT === "preview"
      ? this.apps().filter((app) => allowedApp(app, this.env))
      : [target];
  }
  async pin() {
    const snapshots = new Set();
    const saved = await recoverWorkflowPin(this.env, this.run);
    if (saved) snapshots.add(saved);
    for (const app of await this.maintenanceApps()) {
      for (const machine of await this.machines(app)) {
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
        !this.env.REQUESTED_SNAPSHOT ||
        pinned === this.env.REQUESTED_SNAPSHOT,
      `Recovery requires snapshot ${pinned}`,
    );
    const id = pinned || this.env.REQUESTED_SNAPSHOT || "";
    assert(
      typeof id === "string" &&
        (id === "" || /^[a-zA-Z0-9_-]{1,100}$/.test(id)),
      "Invalid recovery snapshot ID",
    );
    if (this.env.GITHUB_OUTPUT)
      await appendFile(this.env.GITHUB_OUTPUT, `snapshot_id=${id}\n`);
    return id;
  }
  async pause(bestEffort = false) {
    const affected = [];
    const errors = [];
    const save = () =>
      writeFile(
        "snapshot-maintenance.json",
        JSON.stringify(
          { snapshot: this.env.SNAPSHOT_ID, machines: affected },
          null,
          2,
        ),
      );
    await save();
    for (const app of await this.maintenanceApps()) {
      try {
        for (const machine of (await this.machines(app)).filter(isAppMachine)) {
          try {
            const previous = machine.config.metadata?.[marker];
            const record = previous
              ? JSON.parse(previous)
              : {
                  snapshot: required(this.env, "SNAPSHOT_ID"),
                  started: machine.state === "started",
                  services: machine.config.services?.map((service) => ({
                    autostart: service.autostart,
                    min_machines_running: service.min_machines_running,
                  })),
                  restart: machine.config.restart,
                };
            assert(
              record.snapshot === this.env.SNAPSHOT_ID,
              `Recover ${app} using pinned snapshot ${record.snapshot}`,
            );
            const config = structuredClone(machine.config);
            config.metadata = {
              ...config.metadata,
              [marker]: JSON.stringify(record),
            };
            config.services?.forEach((service) => {
              service.autostart = false;
              service.min_machines_running = 0;
            });
            config.restart = { policy: "no" };
            affected.push({ app, id: machine.id, ...record });
            await save();
            await this.update(app, machine, config);
            await this.stop(app, await this.machine(app, machine.id));
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
  async resume() {
    const saved = JSON.parse(
      await readFile("snapshot-maintenance.json", "utf8"),
    );
    assert(
      saved.snapshot === this.env.SNAPSHOT_ID,
      "Recovery snapshot mismatch",
    );
    for (const record of saved.machines) {
      assert(allowedApp(record.app, this.env), "Recovery app is not allowed");
      const current = (await this.machines(record.app)).find(
        ({ id }) => id === record.id,
      );
      if (!current) continue; // Deployment may have replaced a Machine.
      await this.stop(record.app, current);
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
      await this.update(record.app, current, config);
      if (record.started || record.app === this.env.CMS_APP)
        await this.start(record.app, current.id);
    }
  }
  async halt() {
    const errors = [];
    // A cancelled runner must stop its release command too, so it cannot keep
    // modifying the shared DB after the workflow's lifecycle lock releases.
    for (const app of await this.maintenanceApps()) {
      try {
        for (const machine of (await this.machines(app)).filter(
          isReleaseMachine,
        )) {
          try {
            await this.stop(app, machine);
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
      await this.pause(true);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        "Some CMS Machines could not be kept offline; inspect Fly state",
      );
  }
  async invalidate() {
    let apps;
    if (this.env.DEPLOYMENT_ENVIRONMENT === "preview") {
      const prefix = `${required(this.env, "FRONTEND_PREVIEW_APP_PREFIX")}-`;
      apps = this.apps().filter(
        (app) =>
          app.startsWith(prefix) &&
          /^[a-f0-9]+$/.test(app.slice(prefix.length)),
      );
    } else apps = [required(this.env, "FRONTEND_APP")];
    const code = `const r=await fetch('http://127.0.0.1:3000/api/invalidate-cms-cache',{method:'POST',headers:{Authorization:'Bearer '+process.env.CMS_CACHE_INVALIDATION_SECRET},signal:AbortSignal.timeout(10000)});if(!r.ok)process.exit(1)`;
    for (const app of apps) {
      const machine = (await this.machines(app)).find(isAppMachine);
      if (!machine) continue; // A provisioned app may not have been deployed yet.
      if (machine.state !== "started") await this.start(app, machine.id);
      // The credential is evaluated inside the frontend; it never leaves Fly.
      this.run(
        "flyctl",
        [
          "ssh",
          "console",
          "--app",
          app,
          "--machine",
          machine.id,
          "--command",
          `node --input-type=module -e ${JSON.stringify(code)}`,
        ],
        { stdio: "inherit" },
      );
    }
  }
  async publish() {
    const app = required(this.env, "SNAPSHOT_PRODUCTION_APP");
    const running = (await this.machines(app)).filter(isAppMachine);
    assert(running.length, "Production has no deployed CMS Machines");
    const image = immutableImage(running[0]);
    assert(
      running.every((machine) => immutableImage(machine) === image),
      "Production CMS Machines have different images",
    );
    const name = `content-snapshot-${Date.now()}`;
    const dir = await mkdtemp(join(tmpdir(), "snapshot-machine-"));
    try {
      const config = {
        image,
        env: {
          ...running[0].config.env,
          DEPLOYMENT_ENVIRONMENT: "production",
          SNAPSHOT_PRODUCTION_APP: app,
          SNAPSHOT_SOURCE_IMAGE: image,
        },
        init: {
          cmd: [
            "node",
            "apps/cms/scripts/content-snapshots/cli.mjs",
            "publish",
          ],
        },
        guest: running[0].config.guest,
        services: [],
        restart: { policy: "no" },
      };
      const file = join(dir, "machine.json");
      await writeFile(file, JSON.stringify(config));
      this.run(
        "flyctl",
        [
          "machine",
          "run",
          image,
          "--app",
          app,
          "--name",
          name,
          "--region",
          running[0].region,
          "--machine-config",
          file,
          "--detach",
          "--restart",
          "no",
        ],
        { stdio: "inherit" },
      );
      const machine = (await this.machines(app)).find(
        (machine) => machine.name === name,
      );
      assert(machine, "Publisher Machine was not created");
      await this.completed(app, machine.id);
    } finally {
      // Keep the Machine until its exit status has been inspected. --rm can
      // destroy that evidence before the workflow observes the failure.
      const machine = (await this.machines(app)).find(
        (machine) => machine.name === name,
      );
      if (machine)
        await this.request(
          `/apps/${app}/machines/${machine.id}?force=true`,
          "DELETE",
        );
      await rm(dir, { recursive: true, force: true });
    }
  }
  async completed(app, id) {
    for (let i = 0; i < 900; i++) {
      const machine = await this.machine(app, id);
      if (machine.state === "stopped") {
        const event = machine.events?.find((event) => event.type === "exit");
        assert(
          event?.request?.exit_event?.exit_code === 0,
          `Publisher failed; inspect Fly logs for ${app}/${id}`,
        );
        return;
      }
      assert(
        machine.state !== "destroyed",
        "Publisher disappeared before completion",
      );
      await this.wait(2000);
    }
    throw new Error("Snapshot publisher exceeded 30 minutes");
  }
}
function isReleaseMachine(machine) {
  return (
    machine.config?.env?.RELEASE_COMMAND === "1" ||
    machine.config?.metadata?.fly_process_group === "fly_app_release_command"
  );
}
export function isAppMachine(machine) {
  return (
    !isReleaseMachine(machine) &&
    (machine.config?.metadata?.fly_process_group === "app" ||
      machine.config?.services?.length > 0)
  );
}
export function immutableImage(machine) {
  const image = machine.image_ref;
  assert(
    image?.registry && image.repository && image.digest,
    "Deployed image has no immutable digest",
  );
  return `${image.registry}/${image.repository}@${image.digest}`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const fly = new Fly(process.env);
  const command = process.argv[2];
  assert(
    ["publish", "pin", "pause", "resume", "halt", "invalidate"].includes(
      command,
    ),
    "Unknown snapshot deployment command",
  );
  await fly[command]();
}
