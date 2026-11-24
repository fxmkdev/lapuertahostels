import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CollectionBeforeChangeHook } from "payload";
import sharp from "sharp";
import { expect, test } from "vitest";
import {
  readDisplayDimensions,
  setDisplayDimensions,
} from "./display-dimensions";

const fixture = "../../tests/e2e/assets/courtyard-orientation-6.jpg";

test.each([1, 2, 3, 4, 5, 6, 7, 8])(
  "reads displayed dimensions for EXIF orientation %s without changing bytes",
  async (orientation) => {
    const buffer = await sharp(await readFile(fixture))
      .withMetadata({ orientation })
      .toBuffer();
    const original = Buffer.from(buffer);
    const swapped = orientation >= 5;
    expect(await readDisplayDimensions(buffer)).toEqual({
      displayWidth: swapped ? 854 : 1280,
      displayHeight: swapped ? 1280 : 854,
    });
    expect(buffer).toEqual(original);
  },
);

function invoke(data: object, file?: object) {
  return setDisplayDimensions({
    data,
    req: { file },
  } as Parameters<CollectionBeforeChangeHook>[0]);
}

test("replacement and focal refetch overwrite stale display dimensions", async () => {
  const data = {
    displayWidth: 1200,
    displayHeight: 500,
    focalX: 50,
    focalY: 90,
  };
  const output = await invoke(data, {
    mimetype: "image/jpeg",
    data: await readFile(fixture),
  });
  expect(output).toEqual({ ...data, displayWidth: 854, displayHeight: 1280 });
  expect(await invoke(data)).toBe(data);
});

test("reads temporary uploads from disk", async () => {
  const directory = await mkdtemp(join(tmpdir(), "focal-exif-"));
  try {
    const tempFilePath = join(directory, "photo.jpg");
    await writeFile(tempFilePath, await readFile(fixture));
    expect(
      await invoke(
        {},
        { mimetype: "image/jpeg", data: Buffer.alloc(0), tempFilePath },
      ),
    ).toEqual({ displayWidth: 854, displayHeight: 1280 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("JPEG failures reject the update; non-images clear stale dimensions", async () => {
  await expect(
    invoke({}, { mimetype: "image/jpeg", data: Buffer.from("invalid") }),
  ).rejects.toThrow();
  expect(
    await invoke(
      { displayWidth: 854, displayHeight: 1280 },
      { mimetype: "video/mp4" },
    ),
  ).toEqual({ displayWidth: null, displayHeight: null });
});
