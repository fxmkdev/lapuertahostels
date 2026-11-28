import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { publish, restore, mongoTool } from "./snapshot.mjs";

export async function archiveExcludesAuth(context) {
  const { token, sourceName, baseUri, client, reader, manifest } = context;

  const dir = await mkdtemp(join(tmpdir(), "inspect-snapshot-test-"));
  const inspection = `snapshot_inspect_${token}`;
  try {
    const archive = join(dir, "archive.gz");
    await reader.download(
      manifest.artifacts.find(({ kind }) => kind === "database").key,
      archive,
    );
    await mongoTool("mongorestore", [
      "--uri",
      `${baseUri.replace(/\/$/, "")}/${inspection}`,
      "--gzip",
      `--archive=${archive}`,
      `--nsInclude=${sourceName}.*`,
      `--nsFrom=${sourceName}.*`,
      `--nsTo=${inspection}.*`,
    ]);
    const names = (await client.db(inspection).listCollections().toArray())
      .map(({ name }) => name)
      .sort();
    assert.deepEqual(names, [...manifest.collections].sort());
  } finally {
    await client.db(inspection).dropDatabase();
    await rm(dir, { recursive: true, force: true });
  }
}

export async function exportFailure(context) {
  const { env, reader, id } = context;

  await assert.rejects(
    publish(env, async () => {
      throw new Error("simulated export failure");
    }),
  );
  assert.equal((await reader.json("latest.json")).id, id);
}

export async function collectionChange(context) {
  const { env, source, reader, id } = context;

  const before = (await reader.list("snapshots/")).length;
  try {
    await assert.rejects(
      publish(env, async (command, args) => {
        await mongoTool(command, args);
        await source
          .collection("new-auth-collection")
          .insertOne({ credential: "must-never-export" });
      }),
      /collections changed/,
    );
    assert.equal((await reader.list("snapshots/")).length, before);
    assert.equal((await reader.json("latest.json")).id, id);
  } finally {
    await source.collection("new-auth-collection").drop();
  }
}

export async function missingMedia(context) {
  const { env, reader, id } = context;

  await assert.rejects(publish({ ...env, MEDIA_S3_BUCKET: "does-not-exist" }));
  assert.equal((await reader.json("latest.json")).id, id);
}

export async function corruptArtifact(context) {
  const { snapshotBucket, s3, targetEnv, target, id, manifest } = context;

  const artifact = manifest.artifacts.find(({ kind }) => kind === "media");
  await s3.send(
    new PutObjectCommand({
      Bucket: snapshotBucket,
      Key: artifact.key,
      Body: "tampered",
    }),
  );
  await assert.rejects(restore(targetEnv, id), /Checksum mismatch/);
  assert.equal((await target.collection("pages").findOne()).title, "stale");
  await s3.send(
    new PutObjectCommand({
      Bucket: snapshotBucket,
      Key: artifact.key,
      Body: "image-bytes",
    }),
  );
}

export async function incompatibleMigration(context) {
  const { targetEnv, target, reader, id, manifest } = context;

  await reader.putJson(`snapshots/${id}/manifest.json`, {
    ...manifest,
    migrations: ["future-migration"],
  });
  await assert.rejects(restore(targetEnv, id), /incompatible/);
  await reader.putJson(`snapshots/${id}/manifest.json`, manifest);
  await assert.rejects(restore(targetEnv, "missing-snapshot"));
  assert.equal((await target.collection("pages").findOne()).title, "stale");
}

export async function rejectProduction(context) {
  const { targetEnv, id } = context;

  await assert.rejects(
    restore({ ...targetEnv, FLY_APP_NAME: "production" }, id),
  );
}

async function assertCredentials(context) {
  for (const name of Object.keys(context.credentials)) {
    assert.deepEqual(
      await context.target.collection(name).find().toArray(),
      context.expectedCredentials[name],
    );
  }
}
async function assertRestoredContent(context) {
  const { source, target, page, manifest } = context;
  assert.deepEqual(
    await target.collection("pages").findOne(),
    await source.collection("pages").findOne(),
  );
  assert.equal(
    (await target.collection("_pages_versions").findOne()).parent.toHexString(),
    page._id.toHexString(),
  );
  assert.equal(await target.collection("brands").countDocuments(), 0);
  assert.equal(
    await target.collection("payload-locked-documents").countDocuments(),
    0,
  );
  assert.equal(
    (await target.collection("payload-migrations").findOne()).name,
    manifest.migrations[0],
  );
  assert(
    (await target.collection("pages").indexes()).some(
      ({ key }) => key["title.en"] === 1,
    ),
  );
}
async function assertRestoredMedia(context) {
  const { s3, targetBucket } = context;
  const image = await s3.send(
    new GetObjectCommand({ Bucket: targetBucket, Key: "photo.png" }),
  );
  assert.equal(await image.Body.transformToString(), "image-bytes");
  assert.equal(image.ContentType, "image/png");
  assert.equal(image.Metadata.original, "true");
  await assert.rejects(
    s3.send(new GetObjectCommand({ Bucket: targetBucket, Key: "stale.png" })),
  );
}
export async function restoreRecovery(context) {
  const { targetEnv, id } = context;
  await assert.rejects(
    restore(targetEnv, id, async (command, args) => {
      if (!args.includes("--dryRun"))
        throw new Error("simulated interrupted restore");
      return mongoTool(command, args);
    }),
  );
  await assertCredentials(context);
  await restore(targetEnv, id);
  await assertRestoredContent(context);
  await assertRestoredMedia(context);
  await assertCredentials(context);
}
export async function applyPendingMigration(context) {
  const { targetEnv, target, id, pendingMigration } = context;

  await promisify(execFile)(
    process.execPath,
    [fileURLToPath(new URL("./cli.mjs", import.meta.url)), "release"],
    {
      cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
      env: {
        ...process.env,
        ...targetEnv,
        SNAPSHOT_ID: id,
        PAYLOAD_SECRET: "local-snapshot-test-secret",
        NODE_ENV: "production",
        PNPM_CONFIG_ENGINE_STRICT: "false",
        PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false",
      },
      timeout: 90000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(
    (await target.collection("pages").findOne()).content[0].rooms[0].cta.show,
    true,
  );
  assert.equal(
    await target
      .collection("payload-migrations")
      .countDocuments({ name: pendingMigration }),
    1,
  );
  await assertCredentials(context);
}
