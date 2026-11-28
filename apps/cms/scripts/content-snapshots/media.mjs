import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { downloadArtifact } from "./artifacts.mjs";
function mediaFilenames(value, result = new Set(), prefix = "") {
  if (Array.isArray(value))
    value.forEach((item) => mediaFilenames(item, result, prefix));
  else if (value && typeof value === "object") {
    prefix = (value._objectKey ?? value.prefix ?? prefix).replace(
      /^\/+|\/+$/g,
      "",
    );
    if (typeof value.filename === "string")
      result.add(prefix ? `${prefix}/${value.filename}` : value.filename);
    Object.values(value).forEach((item) =>
      mediaFilenames(item, result, prefix),
    );
  }
  return result;
}

export async function publishMedia(media, store, manifest, db, dir) {
  const objects = await media.list("");
  const keys = new Set(objects.map(({ Key }) => Key));
  for (const doc of await db.collection("media").find({}).toArray()) {
    for (const filename of mediaFilenames(doc))
      assert(keys.has(filename), `Missing production media: ${filename}`);
  }
  const artifacts = [];
  for (const [index, object] of objects.entries()) {
    const file = join(dir, "media");
    const info = await media.download(object.Key, file);
    const key = `snapshots/${manifest.id}/media/${index}`;
    await store.upload(key, file, info);
    await rm(file);
    artifacts.push({ kind: "media", key, mediaKey: object.Key, ...info });
  }
  return artifacts;
}
export async function restoreMedia(media, store, manifest, dir) {
  const objects = manifest.artifacts.filter(({ kind }) => kind === "media");
  for (const artifact of objects) {
    const file = join(dir, "media");
    // Recheck immutable bytes while transferring after the full preflight,
    // keeping only one media object on disk alongside the database archive.
    await downloadArtifact(store, artifact, file);
    await media.upload(artifact.mediaKey, file, artifact);
    await rm(file);
  }
  const keep = new Set(objects.map(({ mediaKey }) => mediaKey));
  await media.remove(
    (await media.list(""))
      .map(({ Key }) => Key)
      .filter((key) => !keep.has(key)),
  );
}
