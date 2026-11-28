import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { dirname } from "node:path";
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

function verificationFixture() {
  const hash = "a".repeat(64);
  const artifacts = Array.from({ length: 40 }, (_, index) => ({
    kind: index === 0 ? "database" : "media",
    key: `snapshots/test/${index}`,
    mediaKey: `media-${index}`,
    size: 1,
    sha256: hash,
  }));
  const manifest = {
    formatVersion: 1,
    id: "test",
    createdAt: new Date().toISOString(),
    sourceDatabase: "source",
    collections: ["pages"],
    migrations: [],
    artifacts,
  };
  let peakFiles = 0;
  const store = {
    json: async () => manifest,
    download: async (_key, file) => {
      await writeFile(file, "x");
      peakFiles = Math.max(peakFiles, (await readdir(dirname(file))).length);
      return { size: 1, sha256: hash };
    },
  };
  return { manifest, store, peakFiles: () => peakFiles };
}
test("verification discards media while retaining only the database when requested", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bounded-snapshot-test-"));
  try {
    const data = verificationFixture();
    await verifySnapshot(data.store, "test", [], dir);
    assert.deepEqual(await readdir(dir), []);
    assert.equal(data.peakFiles(), 1);
    const verified = await verifySnapshot(data.store, "test", [], dir, {
      keepDatabase: true,
    });
    assert.deepEqual(await readdir(dir), ["database.archive.gz"]);
    assert.equal(verified.files.length, 1);
    assert.equal(verified.files[0].artifact.kind, "database");
    assert.equal(data.peakFiles(), 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("completion manifest is published only after every uploaded artifact verifies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "complete-snapshot-test-"));
  try {
    const { completeSnapshot } = await import("./artifacts.mjs");
    const data = verificationFixture();
    const writes = [];
    data.store.putJson = async (key) => {
      writes.push(key);
    };
    const download = data.store.download;
    data.store.download = async (...args) => ({
      ...(await download(...args)),
      sha256: "0".repeat(64),
    });
    await assert.rejects(
      completeSnapshot(data.store, data.manifest, [], dir),
      /Checksum mismatch/,
    );
    assert.deepEqual(writes, []);
    data.store.download = download;
    await completeSnapshot(data.store, data.manifest, [], dir);
    assert.deepEqual(writes, ["snapshots/test/manifest.json", "latest.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
