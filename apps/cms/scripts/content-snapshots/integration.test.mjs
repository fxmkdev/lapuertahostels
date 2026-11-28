import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  availableMigrations,
  preflight,
  publish,
  restore,
  mongoTool,
} from "./snapshot.mjs";
import { storage } from "./storage.mjs";

test(
  "real MongoDB/S3 export and restoration preserve environment credentials and recover from failures",
  {
    skip:
      !process.env.SNAPSHOT_TEST_MONGODB_URI ||
      !process.env.SNAPSHOT_TEST_S3_ENDPOINT,
    timeout: 180000,
  },
  async (t) => {
    const token = randomUUID().replaceAll("-", "");
    const sourceName = `snapshot_source_${token}`;
    const targetName = `snapshot_target_${token}`;
    const sourceBucket = `source-${token}`;
    const targetBucket = `target-${token}`;
    const snapshotBucket = `snapshots-${token}`;
    const endpoint = process.env.SNAPSHOT_TEST_S3_ENDPOINT;
    assert(
      ["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname),
      "Integration storage must be local",
    );
    const baseUri = process.env.SNAPSHOT_TEST_MONGODB_URI;
    assert(
      /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(baseUri),
      "Integration MongoDB must be local and unauthenticated",
    );
    const client = new MongoClient(baseUri);
    const s3 = new S3Client({
      endpoint,
      region: "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: "snapshot-test",
        secretAccessKey: "snapshot-test-password",
      },
    });
    const env = {
      DATABASE_URI: `${baseUri.replace(/\/$/, "")}/${sourceName}`,
      FLY_APP_NAME: "production",
      DEPLOYMENT_ENVIRONMENT: "production",
      SNAPSHOT_PRODUCTION_APP: "production",
      SNAPSHOT_STAGING_APP: "staging",
      SNAPSHOT_PREVIEW_APP_PREFIX: "preview",
      SNAPSHOT_SOURCE_IMAGE: "test@sha256:test",
      SNAPSHOT_SOURCE_VERSION: "1.0.0-test",
      SNAPSHOT_TARGET_DATABASE: targetName,
      SNAPSHOT_ENDPOINT: endpoint,
      SNAPSHOT_REGION: "auto",
      SNAPSHOT_BUCKET: snapshotBucket,
      SNAPSHOT_FORCE_PATH_STYLE: "true",
      SNAPSHOT_ACCESS_KEY_ID: "snapshot-test",
      SNAPSHOT_SECRET_ACCESS_KEY: "snapshot-test-password",
      MEDIA_S3_ENDPOINT: endpoint,
      MEDIA_S3_REGION: "auto",
      MEDIA_S3_BUCKET: sourceBucket,
      MEDIA_S3_FORCE_PATH_STYLE: "true",
      MEDIA_S3_ACCESS_KEY_ID: "snapshot-test",
      MEDIA_S3_SECRET_ACCESS_KEY: "snapshot-test-password",
    };
    const targetEnv = {
      ...env,
      DATABASE_URI: `${baseUri.replace(/\/$/, "")}/${targetName}`,
      FLY_APP_NAME: "staging",
      DEPLOYMENT_ENVIRONMENT: "staging",
      SNAPSHOT_RESTORE_ENABLED: "true",
      MEDIA_S3_BUCKET: targetBucket,
    };
    const source = client.db(sourceName);
    const target = client.db(targetName);
    const reader = storage(env, "SNAPSHOT");
    const page = {
      _id: new ObjectId(),
      title: { en: "Production content" },
      createdAt: new Date(),
      binary: Buffer.from("BSON fidelity"),
      content: [{ blockType: "RoomList", rooms: [{ cta: { label: "Book" } }] }],
    };
    const credentials = {
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
    try {
      await client.connect();
      for (const Bucket of [sourceBucket, targetBucket, snapshotBucket])
        await s3.send(new CreateBucketCommand({ Bucket }));
      await source.collection("pages").insertOne(page);
      await source.collection("pages").createIndex({ "title.en": 1 });
      await source
        .collection("_pages_versions")
        .insertOne({ parent: page._id, version: page });
      await source
        .collection("globals")
        .insertOne({ globalType: "settings", siteName: "Production" });
      await source.collection("media").insertOne({ filename: "photo.png" });
      const pendingMigration = "20260529_000000_optional_room_cta";
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
      for (const [name, doc] of Object.entries(credentials))
        await target.collection(name).insertOne(doc);
      const expectedCredentials = Object.fromEntries(
        await Promise.all(
          Object.keys(credentials).map(async (name) => [
            name,
            await target.collection(name).find().toArray(),
          ]),
        ),
      );
      await target.collection("pages").insertOne({ title: "stale" });
      await target
        .collection("brands")
        .insertOne({ name: "absent from snapshot" });
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
      const id = await publish(env);
      const manifest = await reader.json(`snapshots/${id}/manifest.json`);
      assert(!JSON.stringify(manifest).includes("must-never-export"));
      assert.deepEqual(
        manifest.collections.sort(),
        [
          "_pages_versions",
          "globals",
          "media",
          "pages",
          "payload-migrations",
        ].sort(),
      );
      assert.equal(await preflight(env), id);
      await t.test(
        "published archive contains no production auth collections",
        async () => {
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
            const names = (
              await client.db(inspection).listCollections().toArray()
            )
              .map(({ name }) => name)
              .sort();
            assert.deepEqual(names, [...manifest.collections].sort());
          } finally {
            await client.db(inspection).dropDatabase();
            await rm(dir, { recursive: true, force: true });
          }
        },
      );

      await t.test("failed export leaves latest unchanged", async () => {
        await assert.rejects(
          publish(env, async () => {
            throw new Error("simulated export failure");
          }),
        );
        assert.equal((await reader.json("latest.json")).id, id);
      });
      await t.test(
        "collections appearing during export fail before archive upload",
        async () => {
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
        },
      );
      await t.test(
        "missing media or upload failure leaves latest unchanged",
        async () => {
          await assert.rejects(
            publish({ ...env, MEDIA_S3_BUCKET: "does-not-exist" }),
          );
          assert.equal((await reader.json("latest.json")).id, id);
        },
      );
      await t.test(
        "corrupt artifact fails before any target changes",
        async () => {
          const artifact = manifest.artifacts.find(
            ({ kind }) => kind === "media",
          );
          await s3.send(
            new PutObjectCommand({
              Bucket: snapshotBucket,
              Key: artifact.key,
              Body: "tampered",
            }),
          );
          await assert.rejects(restore(targetEnv, id), /Checksum mismatch/);
          assert.equal(
            (await target.collection("pages").findOne()).title,
            "stale",
          );
          await s3.send(
            new PutObjectCommand({
              Bucket: snapshotBucket,
              Key: artifact.key,
              Body: "image-bytes",
            }),
          );
        },
      );
      await t.test(
        "incompatible migration and missing snapshot are rejected",
        async () => {
          await reader.putJson(`snapshots/${id}/manifest.json`, {
            ...manifest,
            migrations: ["future-migration"],
          });
          await assert.rejects(restore(targetEnv, id), /incompatible/);
          await reader.putJson(`snapshots/${id}/manifest.json`, manifest);
          await assert.rejects(restore(targetEnv, "missing-snapshot"));
          assert.equal(
            (await target.collection("pages").findOne()).title,
            "stale",
          );
        },
      );
      await t.test("production targets are rejected", async () => {
        await assert.rejects(
          restore({ ...targetEnv, FLY_APP_NAME: "production" }, id),
        );
      });
      await t.test(
        "interrupted restore preserves users and keys and can be rerun",
        async () => {
          await assert.rejects(
            restore(targetEnv, id, async (command, args) => {
              if (!args.includes("--dryRun"))
                throw new Error("simulated interrupted restore");
              return mongoTool(command, args);
            }),
          );
          for (const name of Object.keys(credentials))
            assert.deepEqual(
              await target.collection(name).find().toArray(),
              expectedCredentials[name],
            );
          await restore(targetEnv, id);
          assert.equal(
            (await target.collection("pages").findOne()).title.en,
            "Production content",
          );
          assert.equal(
            (await target.collection("pages").findOne())._id.toHexString(),
            page._id.toHexString(),
          );
          assert.equal(
            (
              await target.collection("_pages_versions").findOne()
            ).parent.toHexString(),
            page._id.toHexString(),
          );
          assert.equal(await target.collection("brands").countDocuments(), 0);
          assert.equal(
            await target
              .collection("payload-locked-documents")
              .countDocuments(),
            0,
          );
          for (const name of Object.keys(credentials))
            assert.deepEqual(
              await target.collection(name).find().toArray(),
              expectedCredentials[name],
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
          const image = await s3.send(
            new GetObjectCommand({ Bucket: targetBucket, Key: "photo.png" }),
          );
          assert.equal(await image.Body.transformToString(), "image-bytes");
          assert.equal(image.ContentType, "image/png");
          assert.equal(image.Metadata.original, "true");
          await assert.rejects(
            s3.send(
              new GetObjectCommand({ Bucket: targetBucket, Key: "stale.png" }),
            ),
          );
        },
      );
      await t.test(
        "release restores source history before applying real pending Payload migrations",
        async () => {
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
            (await target.collection("pages").findOne()).content[0].rooms[0].cta
              .show,
            true,
          );
          assert.equal(
            await target
              .collection("payload-migrations")
              .countDocuments({ name: pendingMigration }),
            1,
          );
          for (const name of Object.keys(credentials))
            assert.deepEqual(
              await target.collection(name).find().toArray(),
              expectedCredentials[name],
            );
        },
      );
    } finally {
      await source.dropDatabase();
      await target.dropDatabase();
      await client.close();
      for (const bucket of [sourceBucket, targetBucket, snapshotBucket]) {
        const bucketStore = storage(
          { ...env, SNAPSHOT_BUCKET: bucket },
          "SNAPSHOT",
        );
        try {
          await bucketStore.remove(
            (await bucketStore.list("")).map(({ Key }) => Key),
          );
          await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
        } finally {
          bucketStore.close();
        }
      }
      reader.close();
      s3.destroy();
    }
  },
);
