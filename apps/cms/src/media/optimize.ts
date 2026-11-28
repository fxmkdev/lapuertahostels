import { createHash } from "node:crypto";
import sharp from "sharp";
import type {
  ImageManifest,
  ImageVariant,
} from "../../../../libs/payload-types/src/media";

export const IMAGE_RECIPE_VERSION = 1;
export const checksum = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
export type Point = { x: number; y: number };
export const normalizePoint = (
  x?: number | null,
  y?: number | null,
): Point => ({
  x:
    typeof x === "number" && Number.isFinite(x)
      ? Math.min(100, Math.max(0, x))
      : 50,
  y:
    typeof y === "number" && Number.isFinite(y)
      ? Math.min(100, Math.max(0, y))
      : 50,
});

type Recipe = { preset: string; width: number; ratio?: number; jpeg?: boolean };
const recipes: Recipe[] = [
  ...[96, 192, 400, 800, 1200, 1600, 2400, 3200].map((width) => ({
    preset: "natural",
    width,
  })),
  ...Object.entries({
    square: 1,
    landscape: 4 / 3,
    portrait: 3 / 4,
    column: 9 / 10,
  }).flatMap(([preset, ratio]) =>
    [480, 960, 1600, 2400].map((width) => ({ preset, ratio, width })),
  ),
  { preset: "preview", width: 32 },
  { preset: "opengraph", width: 1200, ratio: 1200 / 630, jpeg: true },
  { preset: "twitter", width: 2400, ratio: 2, jpeg: true },
];

/** One limiter shared by all uploads in this process, not one limiter per photo. */
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    const start = () => {
      active++;
      resolve();
    };
    if (active < 2) start();
    else waiting.push(start);
  });
  try {
    return await work();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function cropRegion(
  width: number,
  height: number,
  ratio: number | undefined,
  point: Point,
) {
  const cropWidth = ratio
    ? Math.min(width, Math.max(1, Math.floor(height * ratio)))
    : width;
  const cropHeight = ratio
    ? Math.min(height, Math.max(1, Math.floor(width / ratio)))
    : height;
  const left = Math.max(
    0,
    Math.min(
      width - cropWidth,
      Math.round((width * point.x) / 100 - cropWidth / 2),
    ),
  );
  const top = Math.max(
    0,
    Math.min(
      height - cropHeight,
      Math.round((height * point.y) / 100 - cropHeight / 2),
    ),
  );
  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
    focalX: (((width * point.x) / 100 - left) / cropWidth) * 100,
    focalY: (((height * point.y) / 100 - top) / cropHeight) * 100,
  };
}

export async function optimizeImage({
  input,
  point,
  previous,
  write,
}: {
  input: Buffer;
  point: Point;
  previous?: ImageManifest;
  write: (
    key: string,
    buffer: Buffer,
    mimeType: string,
    sha256: string,
  ) => Promise<void>;
}): Promise<ImageManifest | null> {
  const sourceHash = checksum(input);
  if (
    previous?.sourceHash === sourceHash &&
    previous.recipeVersion === IMAGE_RECIPE_VERSION &&
    previous.focalX === point.x &&
    previous.focalY === point.y
  )
    return previous;
  const metadata = await sharp(input).metadata();
  if (
    !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    return null;
  const { width, height } = metadata.autoOrient;
  const seen = new Set<string>();
  const outputs = recipes.flatMap((recipe) => {
    const region = cropRegion(width, height, recipe.ratio, point);
    const outputWidth = Math.min(region.width, recipe.width);
    const outputHeight = Math.max(
      1,
      Math.round((region.height * outputWidth) / region.width),
    );
    const identity = `${recipe.preset}-${outputWidth}x${outputHeight}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ recipe, region, outputWidth, outputHeight, identity }];
  });
  const encodes = new Map<string, Promise<ImageVariant>>();
  const variants = await Promise.all(
    outputs.map(({ recipe, region, outputWidth, outputHeight, identity }) => {
      const geometry = JSON.stringify([
        region.left,
        region.top,
        region.width,
        region.height,
        outputWidth,
        outputHeight,
        !!recipe.jpeg,
      ]);
      let encoded = encodes.get(geometry);
      if (!encoded) {
        encoded = limited(async (): Promise<ImageVariant> => {
          let pipeline = sharp(input)
            .autoOrient()
            .extract({
              left: region.left,
              top: region.top,
              width: region.width,
              height: region.height,
            })
            .resize(outputWidth, outputHeight, { withoutEnlargement: true });
          pipeline = recipe.jpeg
            ? pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85 })
            : pipeline.webp({ quality: 80 });
          const { data, info } = await pipeline.toBuffer({
            resolveWithObject: true,
          });
          const mimeType = recipe.jpeg ? "image/jpeg" : "image/webp";
          const key = `optimized/v${IMAGE_RECIPE_VERSION}/${sourceHash}/${point.x}-${point.y}/${identity}.${recipe.jpeg ? "jpg" : "webp"}`;
          const sha256 = checksum(data);
          await write(key, data, mimeType, sha256);
          return {
            preset: recipe.preset,
            key,
            width: info.width,
            height: info.height,
            mimeType,
            focalX: region.focalX,
            focalY: region.focalY,
            sha256,
          };
        });
        encodes.set(geometry, encoded);
      }
      return encoded.then((variant) => ({ ...variant, preset: recipe.preset }));
    }),
  );
  return {
    recipeVersion: IMAGE_RECIPE_VERSION,
    sourceHash,
    focalX: point.x,
    focalY: point.y,
    variants,
  };
}
