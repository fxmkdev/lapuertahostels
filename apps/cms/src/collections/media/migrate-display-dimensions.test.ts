import { readFile } from "node:fs/promises";
import type { Payload } from "payload";
import type { Media } from "../../payload-types";
import { expect, test, vi } from "vitest";
import {
  migrateDisplayDimensions,
  getOriginalObjectKey,
} from "./migrate-display-dimensions";

const fixture = "../../tests/e2e/assets/courtyard-orientation-6.jpg";
function harness() {
  const records = [
    {
      id: "legacy",
      filename: "photo.jpg",
      width: 1280,
      height: 854,
      focalX: 50,
      focalY: 90,
    },
    { id: "done", displayWidth: 400, displayHeight: 300 },
  ] as Media[];
  const find = vi.fn().mockImplementation(async ({ page }) => ({
    docs: [records[page - 1]],
    hasNextPage: page === 1,
  }));
  const update = vi
    .fn()
    .mockImplementation(async ({ id, data }) =>
      Object.assign(records.find((row) => row.id === id)!, data),
    );
  const loadOriginal = vi.fn().mockImplementation(() => readFile(fixture));
  return {
    payload: { find, update } as unknown as Payload,
    records,
    find,
    update,
    loadOriginal,
  };
}

test("backfills old JPEGs across pages without changing focal or raw dimensions", async () => {
  const h = harness();
  expect(await migrateDisplayDimensions(h)).toEqual({
    updated: 1,
    skipped: 1,
    dryRun: false,
  });
  expect(h.records[0]).toMatchObject({
    displayWidth: 854,
    displayHeight: 1280,
    width: 1280,
    height: 854,
    focalX: 50,
    focalY: 90,
  });
  expect(h.update.mock.calls[0][0].data).toEqual({
    displayWidth: 854,
    displayHeight: 1280,
  });
  expect(await migrateDisplayDimensions(h)).toEqual({
    updated: 0,
    skipped: 2,
    dryRun: false,
  });
  expect(h.loadOriginal).toHaveBeenCalledOnce();
});

test("a failed read reports the media ID and can be retried", async () => {
  const h = harness();
  h.loadOriginal.mockRejectedValueOnce(new Error("S3 unavailable"));
  await expect(migrateDisplayDimensions(h)).rejects.toThrow(
    "legacy (photo.jpg)",
  );
  expect(h.update).not.toHaveBeenCalled();
  expect(await migrateDisplayDimensions(h)).toMatchObject({ updated: 1 });
});

test("dry runs inspect originals but do not write", async () => {
  const h = harness();
  expect(await migrateDisplayDimensions({ ...h, dryRun: true })).toMatchObject({
    updated: 1,
    dryRun: true,
  });
  expect(h.update).not.toHaveBeenCalled();
});

test("uses both the optional storage folder and the original filename", () => {
  expect(getOriginalObjectKey({ id: "legacy", filename: "photo.jpg" })).toBe(
    "photo.jpg",
  );
  expect(
    getOriginalObjectKey({
      id: "new",
      filename: "photo.jpg",
      _objectKey: "/unique/",
    }),
  ).toBe("unique/photo.jpg");
  expect(() => getOriginalObjectKey({ id: "broken" })).toThrow(
    "Missing filename",
  );
});
