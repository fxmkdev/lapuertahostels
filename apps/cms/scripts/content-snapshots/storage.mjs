import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { required } from "./policy.mjs";

export function storage(env, prefix) {
  const client = new S3Client({
    region: required(env, `${prefix}_REGION`),
    endpoint: env[`${prefix}_ENDPOINT`] || undefined,
    forcePathStyle: env[`${prefix}_FORCE_PATH_STYLE`] === "true",
    credentials: {
      accessKeyId: required(env, `${prefix}_ACCESS_KEY_ID`),
      secretAccessKey: required(env, `${prefix}_SECRET_ACCESS_KEY`),
    },
  });
  const Bucket = required(env, `${prefix}_BUCKET`);
  return {
    bucket: Bucket,
    close: () => client.destroy(),
    async json(key) {
      const object = await client.send(
        new GetObjectCommand({ Bucket, Key: key }),
      );
      return JSON.parse(await object.Body.transformToString());
    },
    async putJson(key, value) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: JSON.stringify(value),
          ContentType: "application/json",
        }),
      );
    },
    async download(key, file) {
      const object = await client.send(
        new GetObjectCommand({ Bucket, Key: key }),
      );
      await pipeline(object.Body, createWriteStream(file, { mode: 0o600 }));
      return {
        contentType: object.ContentType,
        metadata: object.Metadata,
        ...(await fingerprint(file)),
      };
    },
    async upload(key, file, { contentType, metadata } = {}) {
      const { size } = await stat(file);
      if (size > 5_000_000_000)
        throw new Error("Snapshot objects must be smaller than 5 GB");
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: createReadStream(file),
          ContentLength: size,
          ContentType: contentType,
          Metadata: metadata,
        }),
      );
    },
    async list(prefix) {
      const objects = [];
      let ContinuationToken;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket,
            Prefix: prefix,
            ContinuationToken,
          }),
        );
        objects.push(...(page.Contents ?? []));
        ContinuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (ContinuationToken);
      return objects;
    },
    async remove(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const result = await client.send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: {
              Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            },
          }),
        );
        if (result.Errors?.length) throw new Error("Snapshot cleanup failed");
      }
    },
  };
}
export async function fingerprint(file) {
  const hash = createHash("sha256");
  let size = 0;
  await pipeline(
    createReadStream(file),
    new Transform({
      transform(chunk, _encoding, done) {
        hash.update(chunk);
        size += chunk.length;
        done();
      },
    }),
  );
  return { size, sha256: hash.digest("hex") };
}
