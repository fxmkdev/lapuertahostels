import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { availableMigrations, preflight, publish } from "./snapshot.mjs";
import { storage } from "./storage.mjs";

const storageCredentials = {
  accessKeyId: "snapshot-test",
  secretAccessKey: "snapshot-test-password",
};
const commonEnvironment = {
  FLY_APP_NAME: "production",
  DEPLOYMENT_ENVIRONMENT: "production",
  SNAPSHOT_PRODUCTION_APP: "production",
  SNAPSHOT_STAGING_APP: "staging",
  SNAPSHOT_PREVIEW_APP_PREFIX: "preview",
  SNAPSHOT_SOURCE_IMAGE: "test@sha256:test",
  SNAPSHOT_SOURCE_VERSION: "1.0.0-test",
  SNAPSHOT_REGION: "auto",
  SNAPSHOT_FORCE_PATH_STYLE: "true",
  SNAPSHOT_ACCESS_KEY_ID: storageCredentials.accessKeyId,
  SNAPSHOT_SECRET_ACCESS_KEY: storageCredentials.secretAccessKey,
  MEDIA_S3_REGION: "auto",
  MEDIA_S3_FORCE_PATH_STYLE: "true",
  MEDIA_S3_ACCESS_KEY_ID: storageCredentials.accessKeyId,
  MEDIA_S3_SECRET_ACCESS_KEY: storageCredentials.secretAccessKey,
};
function localServices() {
  const endpoint = process.env.SNAPSHOT_TEST_S3_ENDPOINT;
  const baseUri = process.env.SNAPSHOT_TEST_MONGODB_URI;
  assert(
    ["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname),
    "Integration storage must be local",
  );
  assert(
    /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(baseUri),
    "Integration MongoDB must be local and unauthenticated",
  );
  return { endpoint, baseUri };
}
function targetCredentials() {
  return {
    users: {
      _id: new ObjectId(),
      email: "staging@example.invalid",
      hash: "staging-password-hash",
      sessions: [{ id: "staging-session" }],
    },
    "api-keys": {
      _id: new ObjectId(),
      apiKey: "staging-key",
      enableAPIKey: true,
    },
    "payload-preferences": { _id: new ObjectId(), value: { staging: true } },
  };
}
function sourcePage() {
  return {
    _id: new ObjectId(),
    title: { en: "Production content" },
    createdAt: new Date(),
    binary: Buffer.from("BSON fidelity"),
    content: [{ blockType: "RoomList", rooms: [{ cta: { label: "Book" } }] }],
  };
}
function createFixture() {
  const { endpoint, baseUri } = localServices();
  const token = randomUUID().replaceAll("-", "");
  const sourceName = `snapshot_source_${token}`;
  const targetName = `snapshot_target_${token}`;
  const sourceBucket = `source-${token}`,
    targetBucket = `target-${token}`,
    snapshotBucket = `snapshots-${token}`;
  const env = {
    ...commonEnvironment,
    DATABASE_URI: `${baseUri.replace(/\/$/, "")}/${sourceName}`,
    SNAPSHOT_TARGET_DATABASE: targetName,
    SNAPSHOT_ENDPOINT: endpoint,
    SNAPSHOT_BUCKET: snapshotBucket,
    MEDIA_S3_ENDPOINT: endpoint,
    MEDIA_S3_BUCKET: sourceBucket,
  };
  const targetEnv = {
    ...env,
    DATABASE_URI: `${baseUri.replace(/\/$/, "")}/${targetName}`,
    FLY_APP_NAME: "staging",
    DEPLOYMENT_ENVIRONMENT: "staging",
    SNAPSHOT_RESTORE_ENABLED: "true",
    MEDIA_S3_BUCKET: targetBucket,
  };
  const client = new MongoClient(baseUri);
  const s3 = new S3Client({
    endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: storageCredentials,
  });
  return {
    token,
    baseUri,
    sourceName,
    targetName,
    sourceBucket,
    targetBucket,
    snapshotBucket,
    env,
    targetEnv,
    client,
    s3,
    source: client.db(sourceName),
    target: client.db(targetName),
    reader: storage(env, "SNAPSHOT"),
    page: sourcePage(),
    credentials: targetCredentials(),
    pendingMigration: "20260529_000000_optional_room_cta",
    createdBuckets: [],
  };
}
async function seedSource(context) {
  const { source, page, s3, sourceBucket, pendingMigration } = context;
  await source.collection("pages").insertOne(page);
  await source.collection("pages").createIndex({ "title.en": 1 });
  await source
    .collection("_pages_versions")
    .insertOne({ parent: page._id, version: page });
  await source
    .collection("globals")
    .insertOne({ globalType: "settings", siteName: "Production" });
  await source.collection("media").insertOne({ filename: "photo.png" });
  await source
    .collection("payload-migrations")
    .insertMany(
      (await availableMigrations())
        .filter((name) => name !== pendingMigration)
        .map((name) => ({ name, batch: 1 })),
    );
  for (const name of [
    "users",
    "api-keys",
    "payload-preferences",
    "payload-locked-documents",
    "payload-jobs",
    "_users_versions",
    "sessions",
    "future-auth",
  ]) {
    await source
      .collection(name)
      .insertOne({ productionCredential: "must-never-export" });
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: sourceBucket,
      Key: "photo.png",
      Body: "image-bytes",
      ContentType: "image/png",
      Metadata: { original: "true" },
    }),
  );
}
async function seedTarget(context) {
  const { target, credentials, s3, targetBucket } = context;
  for (const [name, doc] of Object.entries(credentials))
    await target.collection(name).insertOne(doc);
  context.expectedCredentials = Object.fromEntries(
    await Promise.all(
      Object.keys(credentials).map(async (name) => [
        name,
        await target.collection(name).find().toArray(),
      ]),
    ),
  );
  await target.collection("pages").insertOne({ title: "stale" });
  await target.collection("brands").insertOne({ name: "absent from snapshot" });
  await target
    .collection("payload-locked-documents")
    .insertOne({ stale: true });
  await s3.send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: "stale.png",
      Body: "old",
    }),
  );
}
async function publishFixture(context) {
  const { env, reader } = context;
  context.id = await publish(env);
  context.manifest = await reader.json(`snapshots/${context.id}/manifest.json`);
  assert(!JSON.stringify(context.manifest).includes("must-never-export"));
  assert.deepEqual(
    [...context.manifest.collections].sort(),
    [
      "_pages_versions",
      "globals",
      "media",
      "pages",
      "payload-migrations",
    ].sort(),
  );
  assert.equal(await preflight(env), context.id);
}
async function cleanBucket(context, bucket) {
  const store = storage(
    { ...context.env, SNAPSHOT_BUCKET: bucket },
    "SNAPSHOT",
  );
  try {
    await store.remove((await store.list("")).map(({ Key }) => Key));
    await context.s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  } finally {
    store.close();
  }
}
async function cleanupFixture(context) {
  try {
    const results = await Promise.allSettled([
      context.source.dropDatabase(),
      context.target.dropDatabase(),
      ...context.createdBuckets.map((bucket) => cleanBucket(context, bucket)),
    ]);
    const failures = results
      .filter(({ status }) => status === "rejected")
      .map(({ reason }) => reason);
    if (failures.length)
      throw new AggregateError(failures, "Integration fixture cleanup failed");
  } finally {
    await context.client.close();
    context.reader.close();
    context.s3.destroy();
  }
}
export async function withIntegrationFixture(action) {
  const context = createFixture();
  try {
    await context.client.connect();
    for (const Bucket of [
      context.sourceBucket,
      context.targetBucket,
      context.snapshotBucket,
    ]) {
      await context.s3.send(new CreateBucketCommand({ Bucket }));
      context.createdBuckets.push(Bucket);
    }
    await seedSource(context);
    await seedTarget(context);
    await publishFixture(context);
    await action(context);
  } finally {
    await cleanupFixture(context);
  }
}
