import { test } from "node:test";
import assert from "node:assert/strict";
import {
  app,
  associationRoutes,
  env,
  pr,
  repoPath,
  runCleanup,
} from "./test-helpers/preview.mjs";

test("network failure skips PR cleanup while retaining age-based deletion", async () => {
  const routes = {
    [`${repoPath}/deployments`]: new Error("network unavailable"),
  };
  const { commands, warnings, result } = await runCleanup(
    [app("site-preview-new"), app("site-preview-old", 5)],
    routes,
  );
  assert.deepEqual([...result.keys()], ["site-preview-old"]);
  assert.ok(warnings.length);
  assert.deepEqual(commands.at(-1).args, [
    "apps",
    "destroy",
    "--yes",
    "site-preview-old",
  ]);
});

test("combines PR and retention candidates, deleting each app exactly once with reasons", async () => {
  const id = "site-preview-closed";
  const raw = [
    app(id),
    ...Array.from({ length: 7 }, (_, i) => app(`cms-preview-${i}`, i)),
  ];
  const { commands, logs, result } = await runCleanup(
    raw,
    associationRoutes([id], [pr(42)]),
  );
  const deleted = commands
    .filter(({ args }) => args[1] === "destroy")
    .map(({ args }) => args.at(-1));
  assert.deepEqual(deleted, ["cms-preview-5", "cms-preview-6", id]);
  assert.equal(new Set(deleted).size, result.size);
  assert.ok(logs.some((line) => line.includes("closed PR #42")));
  assert.ok(
    logs.some(
      (line) =>
        line.includes("over 4 days") && line.includes("six most recent"),
    ),
  );
});

test("no apps makes no GitHub or destroy requests", async () => {
  const { result, calls, commands } = await runCleanup([]);
  assert.equal(result.size, 0);
  assert.equal(calls.length, 0);
  assert.equal(commands.length, 1);
});

test("Fly discovery and deletion failures propagate", async () => {
  await assert.rejects(
    runCleanup(
      [],
      {},
      {
        run: () => {
          throw new Error("Fly discovery failed");
        },
      },
    ),
    /Fly discovery failed/,
  );
  await assert.rejects(
    runCleanup(
      [],
      {},
      {
        run: (_, args) => {
          if (args[1] === "list")
            return JSON.stringify([app("site-preview-old", 5)]);
          throw new Error("Fly destruction failed");
        },
      },
    ),
    /Fly destruction failed/,
  );
});

test("missing GitHub credentials or repository skips only PR-based cleanup", async () => {
  for (const overrides of [{ GITHUB_TOKEN: "" }, { GITHUB_REPOSITORY: "" }]) {
    const { result, warnings, calls } = await runCleanup(
      [app("site-preview-new"), app("site-preview-old", 5)],
      {},
      { env: { ...env, ...overrides } },
    );
    assert.deepEqual([...result.keys()], ["site-preview-old"]);
    assert.ok(warnings.length);
    assert.equal(calls.length, 0);
  }
});

test("retention-only cleanup does not require GitHub lookup and deduplicates reasons", async () => {
  const { result, calls, commands } = await runCleanup([
    ...Array.from({ length: 8 }, (_, i) => app(`site-preview-${i}`, i + 5)),
  ]);
  assert.equal(result.size, 8);
  assert.equal(calls.length, 0);
  assert.equal(commands.filter(({ args }) => args[1] === "destroy").length, 8);
});
