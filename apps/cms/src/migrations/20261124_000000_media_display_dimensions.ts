import { createMediaClient, mediaStorageFromEnv } from "../media/storage";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  migrateDisplayDimensions,
  getOriginalObjectKey,
} from "../collections/media/migrate-display-dimensions";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const storage = mediaStorageFromEnv();
  const client = createMediaClient(storage);
  try {
    const result = await migrateDisplayDimensions({
      payload,
      req,
      loadOriginal: async (media) => {
        const key = getOriginalObjectKey(media);
        const { Body } = await client.send(
          new GetObjectCommand({
            Bucket: storage.bucket,
            Key: key,
          }),
        );
        if (!Body) throw new Error(`Empty S3 response for media ${media.id}`);
        return Buffer.from(await Body.transformToByteArray());
      },
    });
    payload.logger.info({
      msg: "Backfilled media display dimensions",
      ...result,
    });
  } finally {
    client.destroy();
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Additive metadata can remain on rollback; raw dimensions and files never change.
}
