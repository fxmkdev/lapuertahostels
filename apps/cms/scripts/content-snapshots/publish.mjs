import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import {
  isContentCollection,
  required,
  preserved,
  transient,
  snapshotId,
} from "./policy.mjs";
import { fingerprint, storage } from "./storage.mjs";
import {
  availableMigrations,
  mongoTool,
  temporary,
  completeSnapshot,
} from "./artifacts.mjs";
import { publishMedia } from "./media.mjs";
import { cleanup } from "./retention.mjs";

async function collectionNames(db) {
  return (await db.listCollections({}, { nameOnly: true }).toArray())
    .map(({ name }) => name)
    .sort();
}
async function migrationNames(db) {
  return (
    await db
      .collection("payload-migrations")
      .find({ batch: { $ne: -1 } })
      .toArray()
  )
    .map(({ name }) => name)
    .sort();
}
async function sourceState(db) {
  const allCollections = await collectionNames(db);
  const collections = allCollections.filter(isContentCollection);
  assert(
    collections.includes("globals") && collections.includes("media"),
    "Production content collections are missing",
  );
  return { allCollections, collections, migrations: await migrationNames(db) };
}
async function createManifest(env, db, source) {
  const id = snapshotId(
    `${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID()}`,
  );
  const sourceVersion =
    env.SNAPSHOT_SOURCE_VERSION ||
    JSON.parse(
      await readFile(
        new URL(
          "../../.next/standalone/apps/cms/package.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).version;
  return {
    formatVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    sourceDatabase: db.databaseName,
    sourceImage: required(env, "SNAPSHOT_SOURCE_IMAGE"),
    sourceVersion,
    collections: source.collections,
    migrations: source.migrations,
    artifacts: [],
  };
}
async function archiveDatabase(env, db, source, store, manifest, dir, tool) {
  const archive = join(dir, "database.archive.gz");
  const excluded = new Set([
    ...source.allCollections.filter((name) => !isContentCollection(name)),
    ...preserved,
    ...transient,
    "_users_versions",
    "_api-keys_versions",
    "sessions",
    "users_sessions",
    "api-keys_sessions",
  ]);
  await tool("mongodump", [
    "--uri",
    env.DATABASE_URI,
    `--db=${db.databaseName}`,
    "--gzip",
    `--archive=${archive}`,
    ...[...excluded].map((name) => `--excludeCollection=${name}`),
  ]);
  // A collection created during mongodump cannot bypass export exclusions.
  assert.deepEqual(
    await collectionNames(db),
    source.allCollections,
    "Production collections changed during snapshot export",
  );
  const info = await fingerprint(archive);
  const key = `snapshots/${manifest.id}/database.archive.gz`;
  await store.upload(key, archive);
  await rm(archive);
  return { kind: "database", key, ...info };
}
export async function publish(env, tool = mongoTool) {
  assert(
    required(env, "FLY_APP_NAME") === required(env, "SNAPSHOT_PRODUCTION_APP"),
    "Publishing is restricted to production",
  );
  assert(
    env.DEPLOYMENT_ENVIRONMENT === "production",
    "Publishing requires production context",
  );
  const store = storage(env, "SNAPSHOT");
  const media = storage(env, "MEDIA_S3");
  const client = new MongoClient(required(env, "DATABASE_URI"));
  try {
    await client.connect();
    const db = client.db();
    const source = await sourceState(db);
    const manifest = await createManifest(env, db, source);
    const migrations = await availableMigrations();
    assert(
      source.migrations.every((name) => migrations.includes(name)),
      "Production migrations are incompatible with this image",
    );
    await temporary(async (dir) => {
      manifest.artifacts.push(
        await archiveDatabase(env, db, source, store, manifest, dir, tool),
      );
      manifest.artifacts.push(
        ...(await publishMedia(media, store, manifest, db, dir)),
      );
      assert.deepEqual(
        await migrationNames(db),
        source.migrations,
        "Production migrations changed during snapshot export",
      );
      await completeSnapshot(store, manifest, migrations, dir);
    });
    await cleanup(store, manifest.id);
    return manifest.id;
  } finally {
    await client.close();
    store.close();
    media.close();
  }
}
