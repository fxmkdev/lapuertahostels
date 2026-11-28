import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotId, validateManifest } from "./policy.mjs";
import { storage } from "./storage.mjs";
const execute = promisify(execFile);
export async function mongoTool(command, args) {
  try {
    // Do not log argv or the tool error: both can contain connection credentials.
    await execute(command, args, { maxBuffer: 16 * 1024 * 1024 });
  } catch {
    throw new Error(`${command} failed; database changes may be incomplete`);
  }
}
export async function temporary(action) {
  const dir = await mkdtemp(join(tmpdir(), "content-snapshot-"));
  try {
    return await action(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export async function availableMigrations() {
  const dir = fileURLToPath(new URL("../../src/migrations/", import.meta.url));
  return (await readdir(dir))
    .filter((name) => name !== "index.ts" && name.endsWith(".ts"))
    .map((name) => name.slice(0, -3));
}
export async function downloadArtifact(store, artifact, file) {
  const actual = await store.download(artifact.key, file);
  assert(
    actual.size === artifact.size && actual.sha256 === artifact.sha256,
    `Checksum mismatch: ${artifact.key}`,
  );
}
export async function verifyArtifacts(
  store,
  manifest,
  dir,
  { keepDatabase = false } = {},
) {
  const files = [];
  for (const artifact of manifest.artifacts) {
    const keep = keepDatabase && artifact.kind === "database";
    const file = join(dir, keep ? "database.archive.gz" : "verify");
    try {
      await downloadArtifact(store, artifact, file);
      if (keep) files.push({ artifact, file });
    } finally {
      if (!keep) await rm(file, { force: true });
    }
  }
  return { manifest, files };
}
export async function verifySnapshot(store, id, migrations, dir, options) {
  snapshotId(id);
  const manifest = validateManifest(
    await store.json(`snapshots/${id}/manifest.json`),
    id,
    migrations,
  );
  return verifyArtifacts(store, manifest, dir, options);
}
export async function preflight(env, id) {
  const store = storage(env, "SNAPSHOT");
  try {
    id ??= (await store.json("latest.json")).id;
    return await temporary(async (dir) => {
      const { manifest } = await verifySnapshot(
        store,
        id,
        await availableMigrations(),
        dir,
      );
      return manifest.id;
    });
  } finally {
    store.close();
  }
}

export async function completeSnapshot(store, manifest, migrations, dir) {
  validateManifest(manifest, manifest.id, migrations);
  await verifyArtifacts(store, manifest, dir);
  // Only a fully verified upload gets a completion manifest and latest pointer.
  await store.putJson(`snapshots/${manifest.id}/manifest.json`, manifest);
  await store.putJson("latest.json", { id: manifest.id });
}
