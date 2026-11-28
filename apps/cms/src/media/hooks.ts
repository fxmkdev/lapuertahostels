import { readFile } from "node:fs/promises";
import type { CollectionBeforeChangeHook } from "payload";
import { readImageManifest } from "../../../../libs/payload-types/src/media";
import { getOriginalObjectKey } from "../collections/media/migrate-display-dimensions";
import { normalizePoint, optimizeImage } from "./optimize";
import type { MediaStore } from "./storage";

export function optimizeMedia(
  store: Pick<MediaStore, "read" | "write">,
): CollectionBeforeChangeHook {
  return async ({ data, originalDoc, req, context }) => {
    // Never accept a caller-provided manifest. Only our processor writes it.
    data.imageVariants = originalDoc?.imageVariants ?? null;
    if (context.skipImageOptimization) return data;
    const point = normalizePoint(
      "focalX" in data ? data.focalX : originalDoc?.focalX,
      "focalY" in data ? data.focalY : originalDoc?.focalY,
    );
    const oldPoint = normalizePoint(originalDoc?.focalX, originalDoc?.focalY);
    const force = context.regenerateImages === true;
    if (!req.file && !force && point.x === oldPoint.x && point.y === oldPoint.y)
      return data;
    if (process.env.MEDIA_OPTIMIZATION_ENABLED === "false") {
      data.imageVariants = null;
      return data;
    }
    const mimeType =
      req.file?.mimetype ?? data.mimeType ?? originalDoc?.mimeType;
    if (!mimeType?.startsWith("image/") || mimeType === "image/svg+xml") {
      data.imageVariants = null;
      return data;
    }
    const input = req.file
      ? await (req.file.tempFilePath
          ? readFile(req.file.tempFilePath)
          : Promise.resolve(req.file.data))
      : await store.read(getOriginalObjectKey(originalDoc));
    data.imageVariants = await optimizeImage({
      input,
      point,
      previous: force
        ? undefined
        : readImageManifest(originalDoc?.imageVariants),
      write: store.write,
    });
    return data;
  };
}
