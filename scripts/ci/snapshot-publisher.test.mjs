import assert from "node:assert/strict";
import { test } from "node:test";
import { Fly } from "./content-snapshots.mjs";
import { env } from "./snapshot-test-fixture.mjs";
import { readFileSync, existsSync } from "node:fs";
import { immutableImage } from "./snapshot-policy.mjs";
import { publisherName } from "./snapshot-publisher.mjs";
test("publisher completion checks exit status rather than Machine startup", async () => {
  for (const exitCode of [0, 1, undefined]) {
    const fly = new Fly(env, { wait: async () => {} });
    let polls = 0;
    fly.machine = async () =>
      ++polls === 1
        ? { state: "started" }
        : {
            state: "stopped",
            events: [
              {
                type: "exit",
                request: { exit_event: { exit_code: exitCode } },
              },
            ],
          };
    if (exitCode === 0) await fly.completed("production", "publisher");
    else
      await assert.rejects(
        fly.completed("production", "publisher"),
        /Publisher failed/,
      );
    assert.equal(polls, 2);
  }
});

test("publisher uses an immutable deployed digest", () => {
  assert.equal(
    immutableImage({
      image_ref: {
        registry: "registry.fly.io",
        repository: "cms",
        digest: "sha256:abc",
      },
    }),
    "registry.fly.io/cms@sha256:abc",
  );
  assert.throws(() => immutableImage({ config: { image: "cms:latest" } }));
});

test("publisher always destroys its isolated worker after observing success or failure", async () => {
  for (const exitCode of [0, 1]) {
    let worker;
    let configFile;
    let destroyed = false;
    const source = {
      region: "cdg",
      image_ref: {
        registry: "registry.fly.io",
        repository: "cms",
        digest: "sha256:abc",
      },
      config: {
        metadata: { fly_process_group: "app" },
        env: {},
        guest: { cpus: 1, memory_mb: 256 },
      },
    };
    const fly = new Fly(env, {
      run: (_command, args) => {
        configFile = args[args.indexOf("--machine-config") + 1];
        const config = JSON.parse(readFileSync(configFile, "utf8"));
        assert.deepEqual(config.services, []);
        assert.equal(config.restart.policy, "no");
        assert.equal(
          config.env.SNAPSHOT_SOURCE_IMAGE,
          "registry.fly.io/cms@sha256:abc",
        );
        assert.equal(config.env.DEPLOYMENT_ENVIRONMENT, "production");
        worker = {
          id: "worker",
          name: args[args.indexOf("--name") + 1],
          state: "stopped",
          events: [
            { type: "exit", request: { exit_event: { exit_code: exitCode } } },
          ],
        };
      },
    });
    fly.machines = async () => [source, ...(worker ? [worker] : [])];
    fly.machine = async () => worker;
    fly.request = async (path, method) => {
      assert(path.endsWith("/worker?force=true"));
      assert.equal(method, "DELETE");
      destroyed = true;
    };
    if (exitCode === 0) await fly.publish();
    else await assert.rejects(fly.publish(), /Publisher failed/);
    assert(destroyed);
    assert(!existsSync(configFile));
  }
});

test("cancelled workflow cleanup finds only its own worker without in-memory state", async () => {
  const workflow = { ...env, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" };
  const fly = new Fly(workflow);
  const removed = [];
  fly.machines = async () => [
    { id: "ours", name: "content-snapshot-123-2" },
    { id: "other", name: "content-snapshot-123-1" },
  ];
  fly.request = async (path, method) => {
    assert.equal(method, "DELETE");
    removed.push(path);
  };
  await fly.cleanupPublisher();
  assert.deepEqual(removed, ["/apps/production/machines/ours?force=true"]);
  assert.throws(
    () => publisherName({ GITHUB_RUN_ID: "invalid", GITHUB_RUN_ATTEMPT: "2" }),
    /requires a workflow/,
  );
  await assert.rejects(new Fly(env).cleanupPublisher(), /requires a workflow/);
});
test("publisher timeout includes API latency rather than just sleep intervals", async () => {
  let clock = 0,
    polls = 0;
  const fly = new Fly(env, {
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
    },
  });
  fly.machine = async () => {
    polls++;
    clock += 60000;
    return { state: "started" };
  };
  await assert.rejects(
    fly.completed("production", "worker"),
    /exceeded 30 minutes/,
  );
  assert(polls <= 30);
});
