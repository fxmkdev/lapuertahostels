import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  migrateDisplayDimensions,
  getOriginalObjectKey,
} from "../collections/media/migrate-display-dimensions";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const client = new S3Client({
    region: process.env.MEDIA_S3_REGION!,
    credentials: {
      accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY!,
    },
  });
  try {
    const result = await migrateDisplayDimensions({
      payload,
      req,
      loadOriginal: async (media) => {
        const key = getOriginalObjectKey(media);
        const { Body } = await client.send(
          new GetObjectCommand({
            Bucket: process.env.MEDIA_S3_BUCKET!,
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
