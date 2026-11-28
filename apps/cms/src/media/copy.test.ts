// @vitest-environment node
import { expect, test, vi } from "vitest";
import { copyObject } from "./copy";
import { canRemoveDerivative, backfillMedia } from "./maintenance";
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
  const updateOne = vi.fn(async ({ data }) => Object.assign(doc, data));
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
  expect(store.read).toHaveBeenCalledTimes(1);
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
