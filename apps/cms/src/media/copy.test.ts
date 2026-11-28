// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { copyObject, copyBatch } from "./copy";
import {
  canRemoveDerivative,
  backfillMedia,
  referencedKeys,
  verifyMedia,
} from "./maintenance";
import type { S3Client } from "@aws-sdk/client-s3";
import type { Payload } from "payload";
const object = (value: string) => ({
  Body: { transformToByteArray: async () => Buffer.from(value) },
});
test("repeated copies verify bytes without writing and ignore multipart ETags", async () => {
  const send = vi
    .fn()
    .mockResolvedValue({ ...object("same"), ETag: "not-a-hash-12" });
  const options = {
    source: { send } as unknown as S3Client,
    target: { send } as unknown as S3Client,
    sourceBucket: "source",
    targetBucket: "target",
    key: "folder/photo.jpg",
    apply: true,
  };
  expect(await copyObject(options)).toMatchObject({
    status: "verified",
    bytes: 4,
  });
  expect(await copyObject(options)).toMatchObject({ status: "verified" });
  expect(
    send.mock.calls.every(
      ([command]) => command.constructor.name === "GetObjectCommand",
    ),
  ).toBe(true);
});
test("interrupted copy can resume and verifies the stored result", async () => {
  const source = {
    send: vi.fn().mockResolvedValue(object("photo")),
  } as unknown as S3Client;
  const targetSend = vi
    .fn()
    .mockRejectedValueOnce(Object.assign(new Error(), { name: "NoSuchKey" }))
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(object("photo"));
  const result = await copyObject({
    source,
    target: { send: targetSend } as unknown as S3Client,
    sourceBucket: "old",
    targetBucket: "new",
    key: "photo.jpg",
    apply: true,
  });
  expect(result.status).toBe("copied");
  expect(targetSend.mock.calls[1][0].input.Key).toBe("photo.jpg");
});
test("verification rejects mismatches and missing source objects", async () => {
  const source = {
    send: vi.fn().mockResolvedValue(object("original")),
  } as unknown as S3Client;
  const target = {
    send: vi.fn().mockResolvedValue(object("damaged")),
  } as unknown as S3Client;
  const options = {
    source,
    target,
    sourceBucket: "old",
    targetBucket: "new",
    key: "photo.jpg",
    apply: false,
    verifyOnly: true,
  };
  await expect(copyObject(options)).rejects.toThrow("Checksum mismatch");
  vi.mocked(source.send).mockRejectedValue(new Error("source missing"));
  await expect(copyObject(options)).rejects.toThrow("source missing");
});
test("backfill only writes manifests, preserves absent focal points and resumes", async () => {
  const doc = {
    id: "stable",
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    alt: "Localized",
    updatedAt: "2026-11-28T00:00:00.000Z",
  };
  const before = structuredClone(doc);
  const updateOne = vi.fn(async ({ data }) => {
    const changes = { ...data };
    delete changes.updatedAt;
    return Object.assign(doc, changes);
  });
  const payload = {
    find: vi.fn(async () => ({ docs: [doc], hasNextPage: false })),
    db: { updateOne },
  } as unknown as Payload;
  const sharp = (await import("sharp")).default;
  const input = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  const store = {
    read: vi.fn(async () => input),
    write: vi.fn(async () => {}),
  };
  await backfillMedia(payload, false, async () => {}, false, store);
  expect(updateOne).not.toHaveBeenCalled();
  expect(store.read).not.toHaveBeenCalled();
  await backfillMedia(payload, true, async () => {}, false, store);
  expect(updateOne).toHaveBeenCalledWith({
    collection: "media",
    where: {
      and: [
        { id: { equals: "stable" } },
        { updatedAt: { equals: before.updatedAt } },
      ],
    },
    data: {
      updatedAt: null,
      imageVariants: expect.objectContaining({ focalX: 50, focalY: 50 }),
    },
  });
  const { imageVariants, ...preserved } = doc as typeof doc & {
    imageVariants: unknown;
  };
  expect(imageVariants).toBeDefined();
  expect(preserved).toEqual(before);
  await backfillMedia(payload, true, async () => {}, false, store);
  expect(updateOne).toHaveBeenCalledTimes(1);
  expect(store.read).toHaveBeenCalledTimes(2);
  const changed = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "blue" },
  })
    .jpeg()
    .toBuffer();
  store.read.mockResolvedValueOnce(changed);
  await backfillMedia(payload, true, async () => {}, false, store);
  expect(updateOne).toHaveBeenCalledTimes(2);
  expect(
    (doc as typeof doc & { imageVariants: { sourceHash: string } })
      .imageVariants.sourceHash,
  ).not.toBe((imageVariants as { sourceHash: string }).sourceHash);
  expect(doc.filename).toBe(before.filename);
  expect(doc.updatedAt).toBe(before.updatedAt);
});
test("cleanup protects referenced files, originals, and the retention window", () => {
  const now = new Date("2026-11-28").getTime();
  const old = new Date(now - 15 * 86400000);
  const refs = new Set(["optimized/referenced"]);
  expect(canRemoveDerivative("optimized/referenced", old, refs, now)).toBe(
    false,
  );
  expect(canRemoveDerivative("original.jpg", old, refs, now)).toBe(false);
  expect(canRemoveDerivative("optimized/new", new Date(now), refs, now)).toBe(
    false,
  );
  expect(canRemoveDerivative("optimized/orphan", old, refs, now)).toBe(true);
  expect(canRemoveDerivative("optimized/unmarked", undefined, refs, now)).toBe(
    false,
  );
});

test("cleanup reference inventory protects originals and legacy thumbnails in the reserved namespace", async () => {
  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: [
        {
          id: "legacy",
          filename: "original.jpg",
          _objectKey: "optimized/legacy",
          sizes: { thumbnail: { filename: "thumbnail.jpg" } },
          imageVariants: {
            recipeVersion: 1,
            sourceHash: "a".repeat(64),
            focalX: 50,
            focalY: 50,
            variants: [
              {
                preset: "natural",
                key: "optimized/derived.webp",
                width: 100,
                height: 100,
                mimeType: "image/webp",
                focalX: 50,
                focalY: 50,
                sha256: "b".repeat(64),
              },
            ],
          },
        },
      ],
      hasNextPage: false,
    }),
  } as unknown as Payload;
  const references = await referencedKeys(payload);
  expect(references).toEqual(
    new Set([
      "optimized/legacy/original.jpg",
      "optimized/legacy/thumbnail.jpg",
      "optimized/derived.webp",
    ]),
  );
  const old = new Date("2026-01-01");
  for (const key of references)
    expect(canRemoveDerivative(key, old, references)).toBe(false);
});

test("a failed copy batch reports completed objects and resumes without overwriting matching bytes", async () => {
  const source = {
    send: vi.fn(async (command) => {
      if (command.input.Key === "missing")
        throw Object.assign(new Error("missing source"), { name: "NoSuchKey" });
      return object("same");
    }),
  } as unknown as S3Client;
  const targetSend = vi.fn(
    async (_command: { constructor: { name: string } }) => object("same"),
  );
  const options = {
    source,
    target: { send: targetSend } as unknown as S3Client,
    sourceBucket: "old",
    targetBucket: "new",
    apply: true,
  };
  const report = vi.fn(async (_value: object) => {});
  await expect(
    copyBatch(["first", "missing", "last"], options, report),
  ).rejects.toThrow("missing source");
  expect(report.mock.calls.map(([value]) => value)).toEqual([
    expect.objectContaining({ key: "first", status: "verified" }),
    expect.objectContaining({ key: "last", status: "verified" }),
  ]);
  await copyBatch(["first", "last"], options, report);
  expect(
    targetSend.mock.calls.every(
      ([command]) => command.constructor.name === "GetObjectCommand",
    ),
  ).toBe(true);
});

test("original-only animation backfills skip repeat writes and pass verification", async () => {
  const input = await readFile(
    new URL(
      "../../../../tests/e2e/assets/animated-two-frames.png",
      import.meta.url,
    ),
  );
  const updateOne = vi.fn();
  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: [
        { id: "animated", filename: "animated.png", mimeType: "image/png" },
      ],
      hasNextPage: false,
    }),
    db: { updateOne },
  } as unknown as Payload;
  const store = {
    read: vi.fn(async () => input),
    write: vi.fn(async () => {}),
  };
  const report = vi.fn(async (_value: object) => {});
  await backfillMedia(payload, true, report, false, store);
  await backfillMedia(payload, true, report, false, store);
  expect(updateOne).not.toHaveBeenCalled();
  expect(store.write).not.toHaveBeenCalled();
  expect(
    report.mock.calls.every(
      ([value]) => (value as { status: string }).status === "skipped",
    ),
  ).toBe(true);
  await verifyMedia(payload, store, report);
  expect(report).toHaveBeenLastCalledWith({
    id: "animated",
    status: "verified",
    derivatives: 0,
  });
});
