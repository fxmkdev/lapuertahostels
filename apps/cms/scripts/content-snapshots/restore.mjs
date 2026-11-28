import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import {
  assertTarget,
  isContentCollection,
  required,
  snapshotId,
  transient,
} from "./policy.mjs";
import { storage } from "./storage.mjs";
import {
  availableMigrations,
  mongoTool,
  temporary,
  verifySnapshot,
} from "./artifacts.mjs";
import { restoreMedia } from "./media.mjs";

function restoreArguments(env, db, manifest, files) {
  const archive = files.find(
    ({ artifact }) => artifact.kind === "database",
  ).file;
  return [
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
}
async function replaceContent(db, args, tool) {
  for (const { name } of await db
    .listCollections({}, { nameOnly: true })
    .toArray()) {
    if (isContentCollection(name) || transient.has(name))
      await db.collection(name).drop();
  }
  await tool("mongorestore", [...args, "--stopOnError"]);
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
        { keepDatabase: true },
      );
      await client.connect();
      const db = client.db();
      assert(
        db.databaseName === required(env, "SNAPSHOT_TARGET_DATABASE"),
        "Target database does not match configured allowlist",
      );
      const args = restoreArguments(env, db, manifest, files);
      await tool("mongorestore", [...args, "--dryRun"]);
      await restoreMedia(media, store, manifest, dir);
      await replaceContent(db, args, tool);
      return manifest.id;
    });
  } finally {
    await client.close();
    store.close();
    media.close();
  }
}
