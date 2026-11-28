import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fly, allowedApp } from "./content-snapshots.mjs";
import { env, fixture } from "./snapshot-test-fixture.mjs";
import { recoverWorkflowPin } from "./snapshot-pin.mjs";
test("app allowlists exclude production and unrelated previews", () => {
  assert(allowedApp("preview-abc", env));
  assert(!allowedApp("production", env));
  assert(!allowedApp("preview-invalid", env));
  assert(!allowedApp("staging", env));
  assert(allowedApp("staging", { ...env, DEPLOYMENT_ENVIRONMENT: "staging" }));
});

test("maintenance disables autostart before stopping all shared CMS Machines, persists recovery, and resumes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snapshot-maintenance-test-"));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { fly, calls, machines } = fixture();
    await fly.pause();
    const saved = JSON.parse(await readFile("snapshot-maintenance.json"));
    assert.equal(saved.machines.length, 2);
    assert(
      !calls.some(({ app }) =>
        ["production", "staging", "web-abc", "web-def"].includes(app),
      ),
    );
    for (const app of ["preview-abc", "preview-def"]) {
      assert.equal(machines.get(app)[0].state, "stopped");
      assert.equal(machines.get(app)[0].config.services[0].autostart, false);
      const update = calls.findIndex(
        (call) => call.app === app && call.body?.config,
      );
      const stop = calls.findIndex(
        (call) => call.app === app && call.action === "stop",
      );
      assert(update < stop);
    }
    await fly.halt();
    await fly.resume();
    for (const app of ["preview-abc", "preview-def"]) {
      assert.equal(machines.get(app)[0].state, "started");
      assert.equal(machines.get(app)[0].config.services[0].autostart, true);
      assert.equal(machines.get(app)[0].config.restart.policy, "on-failure");
      assert(
        !machines.get(app)[0].config.metadata.content_snapshot_maintenance,
      );
    }
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("recovery refuses a different snapshot and leaves Machines stopped", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snapshot-recovery-test-"));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { fly, machines } = fixture();
    await fly.pause();
    assert.equal(await fly.pin(), "snapshot-one");
    fly.env = { ...env, SNAPSHOT_ID: "different" };
    await assert.rejects(fly.pause(), /pinned snapshot/);
    assert.equal(machines.get("preview-abc")[0].state, "stopped");
    fly.env = { ...env, REQUESTED_SNAPSHOT: "different" };
    await assert.rejects(fly.pin(), /Recovery requires/);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend invalidation covers every shared preview and evaluates secrets remotely", async () => {
  const { fly, commands } = fixture();
  await fly.invalidate();
  const ssh = commands.filter(([, args]) => args[0] === "ssh");
  assert.equal(ssh.length, 2);
  assert(
    ssh.every(([, args]) =>
      args.at(-1).includes("process.env.CMS_CACHE_INVALIDATION_SECRET"),
    ),
  );
  assert(ssh.every(([, args]) => !args.includes("production")));
});

test("workflow retries recover their original pin even when no CMS Machine survived", async () => {
  const workflow = {
    ...env,
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "2",
    DEPLOYMENT_SHA: "abc123",
  };
  const artifact = {
    id: 1,
    name: "snapshot-pin-preview-abc123-1",
    expired: false,
  };
  const dir = await mkdtemp(join(tmpdir(), "snapshot-pin-fixture-"));
  try {
    writeFileSync(join(dir, "snapshot-id"), "original-snapshot\n");
    const pinned = await recoverWorkflowPin(workflow, (command, args) => {
      assert.equal(command, "gh");
      if (args[0] === "api") return JSON.stringify({ artifacts: [artifact] });
      const destination = args[args.indexOf("--dir") + 1];
      copyFileSync(join(dir, "snapshot-id"), join(destination, "snapshot-id"));
    });
    assert.equal(pinned, "original-snapshot");
    await assert.rejects(
      recoverWorkflowPin(workflow, () =>
        JSON.stringify({ artifacts: [{ ...artifact, expired: true }] }),
      ),
      /pin expired/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start retries Fly's asynchronous replacement precondition", async () => {
  let calls = 0;
  let waits = 0;
  const fly = new Fly(env, {
    wait: async () => {
      waits++;
    },
    fetcher: async () => ({
      ok: ++calls > 1,
      status: calls === 1 ? 412 : 200,
      json: async () => ({}),
    }),
  });
  await fly.transition("preview-abc", "machine", "start");
  assert.equal(calls, 2);
  assert.equal(waits, 1);
});

test("auto-destroying release workers are terminal when Fly reports destroyed", async () => {
  const fly = new Fly(env);
  fly.machine = async () => ({ state: "destroyed" });
  assert.equal((await fly.stopped("preview-abc", "worker")).state, "destroyed");
});

test("failure cleanup attempts other CMS Machines when one app cannot be updated", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snapshot-halt-test-"));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { fly, machines } = fixture();
    const update = fly.update.bind(fly);
    fly.update = async (app, ...args) => {
      if (app === "preview-abc") throw new Error("Unreachable app");
      return update(app, ...args);
    };
    await assert.rejects(fly.halt(), /could not be kept offline/);
    assert.equal(machines.get("preview-def")[0].state, "stopped");
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("cancellation stops release-command workers before releasing shared database maintenance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snapshot-cancellation-test-"));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { fly, machines, calls } = fixture();
    machines.get("preview-abc").push({
      id: "release-worker",
      state: "started",
      config: {
        env: { RELEASE_COMMAND: "1" },
        metadata: { fly_process_group: "fly_app_release_command" },
        services: [],
      },
    });
    await fly.halt();
    assert.equal(machines.get("preview-abc")[1].state, "stopped");
    const workerStop = calls.findIndex(
      ({ id, action }) => id === "release-worker" && action === "stop",
    );
    const appPause = calls.findIndex(({ body }) => body?.config);
    assert(workerStop >= 0 && workerStop < appPause);
    assert(
      !calls.some(({ id, body }) => id === "release-worker" && body?.config),
    );
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});
