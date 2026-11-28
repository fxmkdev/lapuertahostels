import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import {
  assertTarget,
  isContentCollection,
  required,
  preserved,
  snapshotId,
  transient,
  validateManifest,
} from "./policy.mjs";
import { fingerprint, storage } from "./storage.mjs";

const execute = promisify(execFile);
export async function mongoTool(command, args) {
  try {
    // Do not log argv or the tool error: both can contain connection credentials.
    await execute(command, args, { maxBuffer: 16 * 1024 * 1024 });
  } catch {
    throw new Error(`${command} failed; database changes may be incomplete`);
  }
}
async function temporary(action) {
  const dir = await mkdtemp(join(tmpdir(), "content-snapshot-"));
  try {
    return await action(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export async function availableMigrations() {
  const dir = fileURLToPath(new URL("../../src/migrations/", import.meta.url));
  return (await readdir(dir))
    .filter((name) => name !== "index.ts" && name.endsWith(".ts"))
    .map((name) => name.slice(0, -3));
}
export async function verifySnapshot(store, id, migrations, dir) {
  snapshotId(id);
  const manifest = validateManifest(
    await store.json(`snapshots/${id}/manifest.json`),
    id,
    migrations,
  );
  const files = [];
  for (const [index, artifact] of manifest.artifacts.entries()) {
    const file = join(dir, String(index));
    const actual = await store.download(artifact.key, file);
    assert(
      actual.size === artifact.size && actual.sha256 === artifact.sha256,
      `Checksum mismatch: ${artifact.key}`,
    );
    files.push({ artifact, file });
  }
  return { manifest, files };
}
export async function preflight(env, id) {
  const store = storage(env, "SNAPSHOT");
  try {
    id ??= (await store.json("latest.json")).id;
    return await temporary(async (dir) => {
      const { manifest } = await verifySnapshot(
        store,
        id,
        await availableMigrations(),
        dir,
      );
      return manifest.id;
    });
  } finally {
    store.close();
  }
}
function mediaFilenames(value, result = new Set(), prefix = "") {
  if (Array.isArray(value))
    value.forEach((item) => mediaFilenames(item, result, prefix));
  else if (value && typeof value === "object") {
    prefix = (value._objectKey ?? value.prefix ?? prefix).replace(
      /^\/+|\/+$/g,
      "",
    );
    if (typeof value.filename === "string")
      result.add(prefix ? `${prefix}/${value.filename}` : value.filename);
    Object.values(value).forEach((item) =>
      mediaFilenames(item, result, prefix),
    );
  }
  return result;
}
export async function cleanup(store, currentId, now = Date.now()) {
  const objects = await store.list("snapshots/");
  const complete = [];
  for (const object of objects.filter(({ Key }) =>
    Key.endsWith("/manifest.json"),
  )) {
    const manifest = await store.json(object.Key);
    if (
      manifest.formatVersion !== 1 ||
      !Number.isFinite(Date.parse(manifest.createdAt))
    )
      throw new Error("Invalid snapshot during cleanup");
    complete.push(manifest);
  }
  const retained = new Set([
    currentId,
    ...complete
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id }) => id)
      .filter((id) => id !== currentId)
      .slice(0, 4),
  ]);
  const completed = new Set(complete.map(({ id }) => id));
  const expired = objects.filter((object) => {
    const id = object.Key.split("/")[1];
    return (
      !retained.has(id) &&
      (completed.has(id) ||
        now - new Date(object.LastModified).getTime() > 24 * 60 * 60 * 1000)
    );
  });
  await store.remove(expired.map(({ Key }) => Key));
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
    const allCollections = (
      await db.listCollections({}, { nameOnly: true }).toArray()
    ).map(({ name }) => name);
    const collections = allCollections.filter(isContentCollection).sort();
    assert(
      collections.includes("globals") && collections.includes("media"),
      "Production content collections are missing",
    );
    const migrations = (
      await db
        .collection("payload-migrations")
        .find({ batch: { $ne: -1 } })
        .toArray()
    )
      .map(({ name }) => name)
      .sort();
    const id = snapshotId(
      `${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID()}`,
    );
    const prefix = `snapshots/${id}`;
    const manifest = {
      formatVersion: 1,
      id,
      createdAt: new Date().toISOString(),
      sourceDatabase: db.databaseName,
      sourceImage: required(env, "SNAPSHOT_SOURCE_IMAGE"),
      sourceVersion:
        env.SNAPSHOT_SOURCE_VERSION ||
        JSON.parse(
          await readFile(
            new URL(
              "../../.next/standalone/apps/cms/package.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ).version,
      collections,
      migrations,
      artifacts: [],
    };
    validateManifest(
      {
        ...manifest,
        artifacts: [
          {
            kind: "database",
            key: `${prefix}/database.archive.gz`,
            size: 0,
            sha256: "0".repeat(64),
          },
        ],
      },
      id,
      await availableMigrations(),
    );
    await temporary(async (dir) => {
      const archive = join(dir, "database.archive.gz");
      await tool("mongodump", [
        "--uri",
        env.DATABASE_URI,
        `--db=${db.databaseName}`,
        "--gzip",
        `--archive=${archive}`,
        ...[
          ...new Set([
            ...allCollections.filter((name) => !isContentCollection(name)),
            ...preserved,
            ...transient,
            "_users_versions",
            "_api-keys_versions",
            "sessions",
            "users_sessions",
            "api-keys_sessions",
          ]),
        ].map((name) => `--excludeCollection=${name}`),
      ]);
      // A collection created during mongodump must not bypass the exclusions
      // derived above. Check before any database archive reaches storage.
      const afterDumpCollections = (
        await db.listCollections({}, { nameOnly: true }).toArray()
      )
        .map(({ name }) => name)
        .sort();
      assert.deepEqual(
        afterDumpCollections,
        [...allCollections].sort(),
        "Production collections changed during snapshot export",
      );
      const archiveInfo = await fingerprint(archive);
      await store.upload(`${prefix}/database.archive.gz`, archive);
      manifest.artifacts.push({
        kind: "database",
        key: `${prefix}/database.archive.gz`,
        ...archiveInfo,
      });
      const objects = await media.list("");
      const keys = new Set(objects.map(({ Key }) => Key));
      for (const doc of await db.collection("media").find({}).toArray()) {
        for (const filename of mediaFilenames(doc))
          assert(keys.has(filename), `Missing production media: ${filename}`);
      }
      for (const [index, object] of objects.entries()) {
        const file = join(dir, "media");
        const info = await media.download(object.Key, file);
        const key = `${prefix}/media/${index}`;
        await store.upload(key, file, info);
        manifest.artifacts.push({
          kind: "media",
          key,
          mediaKey: object.Key,
          ...info,
        });
      }
      const after = (
        await db
          .collection("payload-migrations")
          .find({ batch: { $ne: -1 } })
          .toArray()
      )
        .map(({ name }) => name)
        .sort();
      assert.deepEqual(
        after,
        migrations,
        "Production migrations changed during snapshot export",
      );
      validateManifest(manifest, id, await availableMigrations());
      await store.putJson(`${prefix}/manifest.json`, manifest);
      // Read every uploaded artifact back before making the snapshot discoverable.
      try {
        await verifySnapshot(store, id, await availableMigrations(), dir);
      } catch (error) {
        await store.remove([`${prefix}/manifest.json`]);
        throw error;
      }
      await store.putJson("latest.json", { id });
    });
    await cleanup(store, id);
    return id;
  } finally {
    await client.close();
    store.close();
    media.close();
  }
}
export async function restore(env, id, tool = mongoTool) {
  assertTarget(env);
  const store = storage(env, "SNAPSHOT");
  const media = storage(env, "MEDIA_S3");
  const client = new MongoClient(required(env, "DATABASE_URI"));
  try {
    return await temporary(async (dir) => {
      const { manifest, files } = await verifySnapshot(
        store,
        snapshotId(id),
        await availableMigrations(),
        dir,
      );
      await client.connect();
      const db = client.db();
      assert(
        db.databaseName === required(env, "SNAPSHOT_TARGET_DATABASE"),
        "Target database does not match configured allowlist",
      );
      const archive = files.find(
        ({ artifact }) => artifact.kind === "database",
      ).file;
      const args = [
        "--uri",
        env.DATABASE_URI,
        "--gzip",
        `--archive=${archive}`,
        `--nsFrom=${manifest.sourceDatabase}.*`,
        `--nsTo=${db.databaseName}.*`,
        ...manifest.collections.map(
          (name) => `--nsInclude=${manifest.sourceDatabase}.${name}`,
        ),
      ];
      await tool("mongorestore", [...args, "--dryRun"]);
      for (const { artifact, file } of files.filter(
        ({ artifact }) => artifact.kind === "media",
      )) {
        await media.upload(artifact.mediaKey, file, artifact);
      }
      const targetObjects = await media.list("");
      const keepMedia = new Set(
        manifest.artifacts
          .filter(({ kind }) => kind === "media")
          .map(({ mediaKey }) => mediaKey),
      );
      await media.remove(
        targetObjects
          .map(({ Key }) => Key)
          .filter((key) => !keepMedia.has(key)),
      );
      for (const { name } of await db
        .listCollections({}, { nameOnly: true })
        .toArray()) {
        if (isContentCollection(name) || transient.has(name))
          await db.collection(name).drop();
      }
      await tool("mongorestore", [...args, "--stopOnError"]);
      return manifest.id;
    });
  } finally {
    await client.close();
    store.close();
    media.close();
  }
}
