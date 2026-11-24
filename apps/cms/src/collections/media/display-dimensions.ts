import type { CollectionBeforeChangeHook } from "payload";
import sharp from "sharp";

export type DisplayDimensions = { displayWidth: number; displayHeight: number };

/** Read headers only; do not rotate, resize, or re-encode the original. */
export async function readDisplayDimensions(
  input: Buffer | string,
): Promise<DisplayDimensions> {
  const { autoOrient } = await sharp(input).metadata();
  const { width, height } = autoOrient;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Unable to determine displayed image dimensions");
  }
  return { displayWidth: width, displayHeight: height };
}

export const setDisplayDimensions: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  const file = req.file;
  if (!file) return data;
  if (!file.mimetype.startsWith("image/")) {
    return { ...data, displayWidth: null, displayHeight: null };
  }
  try {
    return {
      ...data,
      ...(await readDisplayDimensions(file.tempFilePath || file.data)),
    };
  } catch (error) {
    // JPEG metadata must be trustworthy before accepting a focal edit. Other
    // formats supported by Payload may not have a decoder in this Sharp build.
    if (file.mimetype === "image/jpeg") throw error;
    return { ...data, displayWidth: null, displayHeight: null };
  }
};
