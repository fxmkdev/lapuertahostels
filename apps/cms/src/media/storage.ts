import {
  GetObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  DeleteObjectTaggingCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { publicMediaUrl } from "../../../../libs/payload-types/src/media";

export type MediaStorage = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

export function mediaStorageFromEnv(env = process.env): MediaStorage {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`${name} is required for Tigris media storage`);
    return value;
  };
  const endpoint = required("MEDIA_STORAGE_ENDPOINT");
  const publicBaseUrl = required("MEDIA_PUBLIC_BASE_URL");
  for (const value of [endpoint, publicBaseUrl]) {
    if (!["https:", "http:"].includes(new URL(value).protocol))
      throw new Error("Media storage requires an HTTP(S) URL");
  }
  return {
    endpoint,
    region: env.MEDIA_STORAGE_REGION || "auto",
    bucket: required("MEDIA_STORAGE_BUCKET"),
    accessKeyId: required("MEDIA_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required("MEDIA_STORAGE_SECRET_ACCESS_KEY"),
    publicBaseUrl,
  };
}

export function createMediaClient(storage: MediaStorage) {
  return new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  });
}

export function createMediaStore(storage: MediaStorage) {
  const client = createMediaClient(storage);
  return {
    client,
    async read(key: string) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
      );
      if (!result.Body) throw new Error(`Empty media object: ${key}`);
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async write(key: string, body: Buffer, mimeType: string, sha256: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          CacheControl: "public, max-age=31536000, immutable",
          Metadata: { sha256 },
        }),
      );
      // Referencing a retired key again clears its previous retention clock.
      await client.send(
        new DeleteObjectTaggingCommand({ Bucket: storage.bucket, Key: key }),
      );
    },
    async retiredAt(key: string) {
      const result = await client.send(
        new GetObjectTaggingCommand({ Bucket: storage.bucket, Key: key }),
      );
      const value = result.TagSet?.find(
        (tag) => tag.Key === "retired-at",
      )?.Value;
      return value ? new Date(value) : undefined;
    },
    async retire(key: string) {
      await client.send(
        new PutObjectTaggingCommand({
          Bucket: storage.bucket,
          Key: key,
          Tagging: {
            TagSet: [{ Key: "retired-at", Value: new Date().toISOString() }],
          },
        }),
      );
    },
    url: (key: string) => publicMediaUrl(storage.publicBaseUrl, key),
  };
}
export type MediaStore = ReturnType<typeof createMediaStore>;
