import sharp from "sharp";
import type { Payload } from "payload";
import { readImageManifest } from "@lapuertahostels/payload-types";
import { getOriginalObjectKey } from "../collections/media/migrate-display-dimensions";
import {
  IMAGE_RECIPE_VERSION,
  checksum,
  normalizePoint,
  optimizeImage,
  canOptimizeImage,
} from "./optimize";
import type { MediaStore } from "./storage";

export async function* mediaDocuments(payload: Payload) {
  let page = 1;
  while (true) {
    const batch = await payload.find({
      collection: "media",
      depth: 0,
      limit: 50,
      page,
      sort: "id",
      overrideAccess: true,
      showHiddenFields: true,
    });
    for (const doc of batch.docs) yield doc;
    if (!batch.hasNextPage) break;
    page++;
  }
}
export async function backfillMedia(
  payload: Payload,
  apply: boolean,
  report: (value: object) => Promise<void>,
  force = false,
  store?: Pick<MediaStore, "read" | "write">,
) {
  for await (const media of mediaDocuments(payload)) {
    const manifest = readImageManifest(media.imageVariants);
    const point = normalizePoint(media.focalX, media.focalY);
    const eligible = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ].includes(media.mimeType ?? "");
    const current =
      manifest?.recipeVersion === IMAGE_RECIPE_VERSION &&
      manifest.focalX === point.x &&
      manifest.focalY === point.y;
    if (!eligible) {
      await report({ id: media.id, status: "skipped" });
      continue;
    }
    let input: Buffer | undefined;
    if (current && !force) {
      if (!store) throw new Error("Backfill requires a media store");
      input = await store.read(getOriginalObjectKey(media));
      if (checksum(input) === manifest.sourceHash) {
        await report({ id: media.id, status: "skipped" });
        continue;
      }
    }
    if (apply)
      try {
        if (!store) throw new Error("Backfill requires a media store");
        const imageVariants = await optimizeImage({
          input: input ?? (await store.read(getOriginalObjectKey(media))),
          point,
          write: store.write,
        });
        if (!imageVariants && !manifest) {
          await report({
            id: media.id,
            status: "skipped",
            reason: "original-only",
          });
          continue;
        }
        // Bypass upload/localization hooks and preserve the original focal fields.
        const updated = await payload.db.updateOne({
          collection: "media",
          where: {
            and: [
              { id: { equals: media.id } },
              { updatedAt: { equals: media.updatedAt } },
            ],
          },
          // The adapter treats null as an instruction to preserve updatedAt.
          data: { imageVariants, updatedAt: null },
        });
        if (!updated)
          throw new Error("Media changed during backfill; retry it");
      } catch (error) {
        throw new Error(
          `Backfill failed for media ${media.id} (${media.filename}): ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    await report({
      id: media.id,
      status: apply ? "generated" : "would-generate",
    });
  }
}
export async function verifyMedia(
  payload: Payload,
  store: Pick<MediaStore, "read">,
  report: (value: object) => Promise<void>,
) {
  for await (const media of mediaDocuments(payload)) {
    try {
      const original = await store.read(getOriginalObjectKey(media));
      const manifest = readImageManifest(media.imageVariants);
      const point = normalizePoint(media.focalX, media.focalY);
      if (manifest) {
        if (
          manifest.recipeVersion !== IMAGE_RECIPE_VERSION ||
          manifest.focalX !== point.x ||
          manifest.focalY !== point.y
        )
          throw new Error(`Stale derivatives for media ${media.id}`);
        if (manifest.sourceHash !== checksum(original))
          throw new Error(`Original changed for media ${media.id}`);
        await Promise.all(
          manifest.variants.map(async (variant) => {
            if (checksum(await store.read(variant.key)) !== variant.sha256)
              throw new Error(`Derivative checksum mismatch: ${variant.key}`);
          }),
        );
      } else if (
        media.mimeType?.startsWith("image/") &&
        media.mimeType !== "image/svg+xml"
      ) {
        const metadata = await sharp(original).metadata();
        if (canOptimizeImage(original, metadata))
          throw new Error(`Missing image variants for ${media.id}`);
      }
      for (const size of Object.values(media.sizes ?? {}))
        if (size?.filename) {
          await store.read(
            getOriginalObjectKey({ ...media, filename: size.filename }),
          );
        }
      await report({
        id: media.id,
        status: "verified",
        derivatives: manifest?.variants.length ?? 0,
      });
    } catch (error) {
      throw new Error(
        `Verification failed for media ${media.id} (${media.filename}): ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
export async function referencedKeys(payload: Payload) {
  const keys = new Set<string>();
  for await (const doc of mediaDocuments(payload)) {
    keys.add(getOriginalObjectKey(doc));
    for (const size of Object.values(doc.sizes ?? {}))
      if (size?.filename)
        keys.add(getOriginalObjectKey({ ...doc, filename: size.filename }));
    for (const variant of readImageManifest(doc.imageVariants)?.variants ?? [])
      keys.add(variant.key);
  }
  return keys;
}
export function canRemoveDerivative(
  key: string,
  retiredAt: Date | undefined,
  references: Set<string>,
  now = Date.now(),
) {
  return (
    key.startsWith("optimized/") &&
    !!retiredAt &&
    now - retiredAt.getTime() >= 14 * 86400000 &&
    !references.has(key)
  );
}
