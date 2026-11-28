import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { checksum } from "./optimize";

export async function* listObjects(
  client: S3Client,
  bucket: string,
  prefix?: string,
) {
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) if (object.Key) yield object;
    token = page.NextContinuationToken;
  } while (token);
}
export async function readObject(
  client: S3Client,
  bucket: string,
  key: string,
) {
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!object.Body) throw new Error(`Missing object body: ${key}`);
  return {
    ...object,
    bytes: Buffer.from(await object.Body.transformToByteArray()),
  };
}
export function isMissingObject(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    ["NoSuchKey", "NotFound"].includes(String(error.name))
  );
}
/** Every resumed run compares bytes again; only changed/missing targets are written. */
export async function copyObject({
  source,
  target,
  sourceBucket,
  targetBucket,
  key,
  apply,
  verifyOnly = false,
}: {
  source: S3Client;
  target: S3Client;
  sourceBucket: string;
  targetBucket: string;
  key: string;
  apply: boolean;
  verifyOnly?: boolean;
}) {
  try {
    const original = await readObject(source, sourceBucket, key);
    const hash = checksum(original.bytes);
    try {
      const existing = await readObject(target, targetBucket, key);
      if (checksum(existing.bytes) === hash)
        return {
          key,
          sha256: hash,
          bytes: original.bytes.length,
          status: "verified",
        };
      if (verifyOnly) throw new Error(`Checksum mismatch: ${key}`);
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      if (verifyOnly)
        throw new Error(`Missing target object: ${key}`, { cause: error });
    }
    if (apply) {
      await target.send(
        new PutObjectCommand({
          Bucket: targetBucket,
          Key: key,
          Body: original.bytes,
          ContentType: original.ContentType,
          CacheControl: key.startsWith("optimized/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=300",
          Metadata: { ...original.Metadata, sha256: hash },
        }),
      );
      const stored = await readObject(target, targetBucket, key);
      if (checksum(stored.bytes) !== hash)
        throw new Error(`Copied object checksum mismatch: ${key}`);
    }
    return {
      key,
      sha256: hash,
      bytes: original.bytes.length,
      status: apply ? "copied" : "would-copy",
    };
  } catch (error) {
    throw new Error(
      `Copy/verification failed for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** Finish every in-flight object and persist successful progress before failing. */
export async function copyBatch(
  keys: string[],
  options: Omit<Parameters<typeof copyObject>[0], "key">,
  report: (value: object) => Promise<void>,
) {
  const results = await Promise.allSettled(
    keys.map((key) => copyObject({ ...options, key })),
  );
  for (const result of results)
    if (result.status === "fulfilled") await report(result.value);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
