// @vitest-environment node
import { expect, test, vi } from "vitest";

// These exercise native encoders, including on slower shared CI workers.
vi.setConfig({ testTimeout: 30_000 });
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import {
  cropRegion,
  normalizePoint,
  optimizeImage,
  checksum,
} from "./optimize";
import { optimizeMedia } from "./hooks";

const photo = () =>
  sharp({
    create: {
      width: 240,
      height: 160,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
test.each([
  { x: 0, y: 100 },
  { x: 100, y: 0 },
  { x: 50, y: 50 },
])("bounded focal crops at %j", async (point) => {
  const input = await photo();
  const originalHash = checksum(input);
  const files = new Map<string, Buffer>();
  let active = 0;
  let maxActive = 0;
  const manifest = await optimizeImage({
    input,
    point,
    write: async (key, buffer, _type, hash) => {
      active++;
      maxActive = Math.max(active, maxActive);
      expect(checksum(buffer)).toBe(hash);
      files.set(key, buffer);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
    },
  });
  expect(checksum(input)).toBe(originalHash);
  expect(maxActive).toBeLessThanOrEqual(2);
  expect(new Set(manifest!.variants.map((v) => v.key)).size).toBe(
    manifest!.variants.length,
  );
  for (const variant of manifest!.variants) {
    const metadata = await sharp(files.get(variant.key)!).metadata();
    expect(metadata.width).toBe(variant.width);
    expect(metadata.height).toBe(variant.height);
    expect(variant.width).toBeLessThanOrEqual(240);
    expect(variant.height).toBeLessThanOrEqual(160);
    expect(variant.focalX).toBeGreaterThanOrEqual(0);
    expect(variant.focalX).toBeLessThanOrEqual(100);
    expect(variant.focalY).toBeGreaterThanOrEqual(0);
    expect(variant.focalY).toBeLessThanOrEqual(100);
    if (variant.mimeType === "image/webp") expect(metadata.hasAlpha).toBe(true);
  }
});
test("EXIF orientation controls output dimensions and crop geometry", async () => {
  const input = await readFile(
    new URL(
      "../../../../tests/e2e/assets/courtyard-orientation-6.jpg",
      import.meta.url,
    ),
  );
  const manifest = await optimizeImage({
    input,
    point: { x: 0, y: 100 },
    write: async () => {},
  });
  const natural = manifest!.variants.find((v) => v.preset === "natural")!;
  expect(natural.height).toBeGreaterThan(natural.width);
  expect(cropRegion(854, 1280, 1, { x: 0, y: 100 }).top).toBe(426);
});
test("immutable keys change with focal edits and current metadata skips processing", async () => {
  const input = await photo();
  const write = vi.fn(async () => {});
  const original = await optimizeImage({ input, point: { x: 0, y: 0 }, write });
  write.mockClear();
  expect(
    await optimizeImage({
      input,
      point: { x: 0, y: 0 },
      previous: original!,
      write,
    }),
  ).toBe(original);
  expect(write).not.toHaveBeenCalled();
  const edited = await optimizeImage({
    input,
    point: { x: 100, y: 100 },
    previous: original!,
    write,
  });
  expect(edited!.variants[0].key).not.toBe(original!.variants[0].key);
});
test("failed writes reject generation", async () => {
  await expect(
    optimizeImage({
      input: await photo(),
      point: { x: 50, y: 50 },
      write: async () => {
        throw new Error("storage unavailable");
      },
    }),
  ).rejects.toThrow("storage unavailable");
});
test("metadata-only saves do no storage work and cannot inject manifests", async () => {
  const read = vi.fn();
  const write = vi.fn();
  const previous = { recipeVersion: 1 };
  const result = await optimizeMedia({ read, write })({
    data: { alt: "New text", imageVariants: { injected: true } },
    originalDoc: { imageVariants: previous },
    req: {},
    context: {},
  } as never);
  expect(result).toMatchObject({ alt: "New text", imageVariants: previous });
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
test("focal saves load the original key and storage errors abort the save", async () => {
  const hook = optimizeMedia({
    read: vi.fn().mockRejectedValue(new Error("missing original")),
    write: vi.fn(),
  });
  await expect(
    hook({
      data: { focalX: 0 },
      originalDoc: {
        id: "id",
        filename: "photo.jpg",
        _objectKey: "folder",
        mimeType: "image/jpeg",
      },
      req: {},
      context: {},
    } as never),
  ).rejects.toThrow("missing original");
});
test("invalid or missing focal metadata has a centered fallback", () => {
  expect(normalizePoint(undefined, NaN)).toEqual({ x: 50, y: 50 });
});
