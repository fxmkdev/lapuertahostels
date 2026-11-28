import { writeFile, rename, readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getPayload } from "payload";
import { createMediaStore, mediaStorageFromEnv } from "./storage";
import { copyBatch, listObjects } from "./copy";
import {
  backfillMedia,
  canRemoveDerivative,
  referencedKeys,
  verifyMedia,
  mediaDocuments,
} from "./maintenance";
import { optimizeImage } from "./optimize";

const [command = "help", mode = "dry-run", ...paths] = process.argv.slice(2);
const apply = mode === "apply";
const reportFile = process.env.MEDIA_MIGRATION_REPORT;
const results: object[] = [];
async function report(value: object) {
  results.push(value);
  console.log(JSON.stringify(value));
  if (reportFile) {
    const temporary = `${reportFile}.tmp`;
    await writeFile(
      temporary,
      JSON.stringify({ command, mode, results }, null, 2),
      { mode: 0o600 },
    );
    await rename(temporary, reportFile);
  }
}
async function run() {
  if (
    ![
      "inventory",
      "copy",
      "verify-copy",
      "backfill",
      "verify",
      "cleanup",
      "benchmark",
    ].includes(command)
  ) {
    console.log(
      "Usage: pnpm --filter cms media <inventory|copy|verify-copy|backfill|verify|cleanup|benchmark> <dry-run|apply> [benchmark image paths...]\nReports: MEDIA_MIGRATION_REPORT. Copy source: SOURCE_STORAGE_ENDPOINT/REGION/BUCKET plus SOURCE_STORAGE_ACCESS_KEY_ID/SECRET_ACCESS_KEY or AWS_PROFILE. Backfill override: MEDIA_REGENERATE_ALL=true. Cleanup apply requires MEDIA_WRITES_PAUSED=true on all CMS machines and this process.",
    );
    return;
  }
  if (!["apply", "dry-run"].includes(mode))
    throw new Error("Use apply or dry-run explicitly");
  if (command === "benchmark") {
    for (const path of paths) {
      const input = await readFile(path);
      const start = performance.now();
      let bytes = 0;
      const manifest = await optimizeImage({
        input,
        point: { x: 50, y: 50 },
        write: async (_key, buffer) => {
          bytes += buffer.length;
        },
      });
      await report({
        path,
        milliseconds: Math.round(performance.now() - start),
        originalBytes: input.length,
        outputBytes: bytes,
        outputs: manifest?.variants.length ?? 0,
        peakRSSKiB: process.resourceUsage().maxRSS,
      });
    }
    return;
  }
  if (
    command === "backfill" &&
    apply &&
    process.env.MEDIA_OPTIMIZATION_ENABLED === "false"
  )
    throw new Error("Enable image optimization before applying the backfill");
  const storage = mediaStorageFromEnv();
  const store = createMediaStore(storage);
  try {
    if (
      ["copy", "verify-copy"].includes(command) ||
      (command === "inventory" && process.env.SOURCE_STORAGE_BUCKET)
    ) {
      const required = (name: string) => {
        const value = process.env[`SOURCE_STORAGE_${name}`];
        if (!value) throw new Error(`Missing SOURCE_STORAGE_${name}`);
        return value;
      };
      const sourceBucket = required("BUCKET");
      const endpoint = required("ENDPOINT");
      if (sourceBucket === storage.bucket && endpoint === storage.endpoint)
        throw new Error("Source and target must differ");
      const source = new S3Client({
        endpoint,
        region: required("REGION"),
        credentials: process.env.SOURCE_STORAGE_ACCESS_KEY_ID
          ? {
              accessKeyId: required("ACCESS_KEY_ID"),
              secretAccessKey: required("SECRET_ACCESS_KEY"),
              sessionToken: process.env.SOURCE_STORAGE_SESSION_TOKEN,
            }
          : undefined,
      });
      try {
        const pending: string[] = [];
        const flush = () =>
          copyBatch(
            pending.splice(0),
            {
              source,
              target: store.client,
              sourceBucket,
              targetBucket: storage.bucket,
              apply,
              verifyOnly: command === "verify-copy",
            },
            report,
          );
        for await (const object of listObjects(source, sourceBucket)) {
          if (command === "inventory")
            await report({
              key: object.Key,
              bytes: object.Size,
              modified: object.LastModified,
            });
          else {
            pending.push(object.Key!);
            if (pending.length === 4) await flush();
          }
        }
        await flush();
      } finally {
        source.destroy();
      }
      if (command !== "inventory") return;
    }
    const { default: config } = await import("../payload.config");
    const payload = await getPayload({
      config: { ...(await config), onInit: () => {} },
    });
    try {
      if (command === "inventory")
        for await (const doc of mediaDocuments(payload))
          await report({
            id: doc.id,
            filename: doc.filename,
            mimeType: doc.mimeType,
          });
      if (command === "backfill")
        await backfillMedia(
          payload,
          apply,
          report,
          process.env.MEDIA_REGENERATE_ALL === "true",
          store,
        );
      if (command === "verify") await verifyMedia(payload, store, report);
      if (command === "cleanup") {
        if (apply && process.env.MEDIA_WRITES_PAUSED !== "true")
          throw new Error(
            "Pause media writes on all CMS machines before applying cleanup",
          );
        const references = await referencedKeys(payload);
        for await (const object of listObjects(
          store.client,
          storage.bucket,
          "optimized/",
        )) {
          if (references.has(object.Key!)) continue;
          const retiredAt = await store.retiredAt(object.Key!);
          if (!retiredAt) {
            if (apply) await store.retire(object.Key!);
            await report({
              key: object.Key,
              status: apply ? "retired" : "would-retire",
            });
          } else if (canRemoveDerivative(object.Key!, retiredAt, references)) {
            if (apply)
              await store.client.send(
                new DeleteObjectCommand({
                  Bucket: storage.bucket,
                  Key: object.Key,
                }),
              );
            await report({
              key: object.Key,
              status: apply ? "deleted" : "would-delete",
            });
          }
        }
      }
    } finally {
      await payload.destroy();
    }
  } finally {
    store.client.destroy();
  }
}
try {
  await run();
} catch (error) {
  await report({
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
