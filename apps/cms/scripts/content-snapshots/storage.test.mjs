import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, verifySnapshot } from "./snapshot.mjs";

test("failed artifact verification never produces a usable snapshot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-snapshot-test-"));
  try {
    const manifest = {
      formatVersion: 1,
      id: "test",
      createdAt: new Date().toISOString(),
      sourceDatabase: "source",
      collections: ["pages"],
      migrations: [],
      artifacts: [
        {
          kind: "database",
          key: "snapshots/test/database",
          size: 1,
          sha256: "0".repeat(64),
        },
      ],
    };
    const store = {
      json: async () => manifest,
      download: async (_key, file) => {
        await writeFile(file, "wrong");
        return { size: 5, sha256: "a".repeat(64) };
      },
    };
    await assert.rejects(
      verifySnapshot(store, "test", [], dir),
      /Checksum mismatch/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("retention keeps five complete snapshots and recent unfinished uploads", async () => {
  const now = Date.now();
  const manifests = Array.from({ length: 7 }, (_, i) => ({
    formatVersion: 1,
    id: `complete-${i}`,
    createdAt: new Date(now - i * 1000).toISOString(),
  }));
  const objects = manifests.flatMap(({ id }) => [
    { Key: `snapshots/${id}/manifest.json` },
    { Key: `snapshots/${id}/database` },
  ]);
  objects.push(
    {
      Key: "snapshots/old-incomplete/database",
      LastModified: new Date(now - 86400001),
    },
    { Key: "snapshots/new-incomplete/database", LastModified: new Date(now) },
  );
  let removed;
  await cleanup(
    {
      list: async () => objects,
      json: async (key) => manifests.find(({ id }) => key.includes(`/${id}/`)),
      remove: async (keys) => {
        removed = keys;
      },
    },
    "complete-0",
    now,
  );
  assert.deepEqual(
    removed.sort(),
    [
      "snapshots/complete-5/database",
      "snapshots/complete-5/manifest.json",
      "snapshots/complete-6/database",
      "snapshots/complete-6/manifest.json",
      "snapshots/old-incomplete/database",
    ].sort(),
  );
});
