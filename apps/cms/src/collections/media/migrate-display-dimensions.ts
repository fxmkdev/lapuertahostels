import type { Payload, PayloadRequest } from "payload";
import type { Media } from "../../payload-types";
import { readDisplayDimensions } from "./display-dimensions";

type Options = {
  payload: Payload;
  req?: PayloadRequest;
  loadOriginal: (media: Media) => Promise<Buffer>;
  dryRun?: boolean;
};

/** Metadata-only, paginated and safe to resume after a failed object read. */
export async function migrateDisplayDimensions({
  payload,
  req,
  loadOriginal,
  dryRun = false,
}: Options) {
  let page = 1;
  let updated = 0;
  let skipped = 0;
  while (true) {
    const result = await payload.find({
      collection: "media",
      depth: 0,
      limit: 100,
      page,
      sort: "id",
      where: { mimeType: { equals: "image/jpeg" } },
      overrideAccess: true,
      req,
      showHiddenFields: true,
    });
    for (const media of result.docs) {
      if (usableDimensions(media)) {
        skipped++;
        continue;
      }
      try {
        const dimensions = await readDisplayDimensions(
          await loadOriginal(media),
        );
        if (!dryRun)
          await payload.update({
            collection: "media",
            id: media.id,
            data: dimensions,
            overrideAccess: true,
            req,
          });
        updated++;
      } catch (cause) {
        throw new Error(
          `Failed to backfill display dimensions for media ${media.id} (${media.filename})`,
          { cause },
        );
      }
    }
    if (!result.hasNextPage) return { updated, skipped, dryRun };
    page++;
  }
}

function usableDimensions(media: Media) {
  return (
    typeof media.displayWidth === "number" &&
    Number.isFinite(media.displayWidth) &&
    media.displayWidth > 0 &&
    typeof media.displayHeight === "number" &&
    Number.isFinite(media.displayHeight) &&
    media.displayHeight > 0
  );
}

export function getOriginalObjectKey(
  media: Pick<Media, "id" | "filename" | "_objectKey">,
) {
  if (!media.filename)
    throw new Error(`Missing filename for media ${media.id}`);
  return [media._objectKey?.replace(/^\/+|\/+$/g, ""), media.filename]
    .filter(Boolean)
    .join("/");
}
