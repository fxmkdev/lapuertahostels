import assert from "node:assert/strict";

// An allowlist prevents new auth or operational collections from silently
// becoming part of a snapshot readable by PR deployments.
const content = new Set([
  "pages",
  "brands",
  "banners",
  "redirects",
  "media",
  "media-categories",
  "locale-configs",
  "globals",
  "payload-folders",
  "common",
  "footer",
  "settings",
]);
export const preserved = new Set(["users", "api-keys", "payload-preferences"]);
export const transient = new Set(["payload-locked-documents", "payload-jobs"]);
export function isContentCollection(name) {
  return (
    name === "payload-migrations" ||
    content.has(name) ||
    (/^_.+_versions$/.test(name) && content.has(name.slice(1, -9)))
  );
}
export function required(env, name) {
  assert(env[name], `Missing ${name}`);
  return env[name];
}
export function snapshotId(id) {
  assert(
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
    "Invalid snapshot ID",
  );
  return id;
}
export function assertTarget(env) {
  assert(
    env.SNAPSHOT_RESTORE_ENABLED === "true",
    "Snapshot restoration is disabled",
  );
  const app = required(env, "FLY_APP_NAME");
  const environment = required(env, "DEPLOYMENT_ENVIRONMENT");
  const staging = required(env, "SNAPSHOT_STAGING_APP");
  const preview = required(env, "SNAPSHOT_PREVIEW_APP_PREFIX");
  assert(
    staging !== env.SNAPSHOT_PRODUCTION_APP &&
      !env.SNAPSHOT_PRODUCTION_APP?.startsWith(`${preview}-`),
    "Overlapping app allowlists",
  );
  assert(
    (environment === "staging" && app === staging) ||
      (environment === "preview" &&
        app.startsWith(`${preview}-`) &&
        /^[a-f0-9]+$/.test(app.slice(preview.length + 1))),
    "Restoration target is not allowed",
  );
  assert(
    app !== required(env, "SNAPSHOT_PRODUCTION_APP"),
    "Cannot restore production",
  );
}
function validateIdentity(value, id) {
  assert(
    value?.formatVersion === 1 && value.id === snapshotId(id),
    "Unsupported snapshot manifest",
  );
  assert(
    typeof value.sourceDatabase === "string" &&
      /^[\w-]+$/.test(value.sourceDatabase),
    "Invalid source database",
  );
  assert(
    typeof value.createdAt === "string" &&
      Number.isFinite(Date.parse(value.createdAt)),
    "Invalid snapshot timestamp",
  );
}
function validateCollections(value, availableMigrations) {
  assert(
    Array.isArray(value.collections) &&
      value.collections.length &&
      value.collections.every(isContentCollection),
    "Snapshot contains unsupported collections",
  );
  assert(
    new Set(value.collections).size === value.collections.length,
    "Duplicate collections",
  );
  assert(
    Array.isArray(value.migrations) &&
      value.migrations.every(
        (name) =>
          typeof name === "string" && availableMigrations.includes(name),
      ),
    "Snapshot migrations are incompatible with this image",
  );
}
function validateArtifacts(value, id) {
  assert(
    Array.isArray(value.artifacts) && value.artifacts.length > 0,
    "Empty snapshot",
  );
  const keys = new Set();
  for (const artifact of value.artifacts) {
    assert(
      typeof artifact.key === "string" &&
        artifact.key.startsWith(`snapshots/${id}/`) &&
        !keys.has(artifact.key),
      "Invalid artifact key",
    );
    keys.add(artifact.key);
    assert(
      /^[a-f0-9]{64}$/.test(artifact.sha256) &&
        Number.isSafeInteger(artifact.size) &&
        artifact.size >= 0,
      "Invalid artifact checksum or size",
    );
    assert(
      artifact.kind === "database" || artifact.kind === "media",
      "Invalid artifact kind",
    );
    if (artifact.kind === "media")
      assert(
        typeof artifact.mediaKey === "string" && artifact.mediaKey.length > 0,
        "Invalid media key",
      );
  }
  assert(
    value.artifacts.filter((item) => item.kind === "database").length === 1,
    "Expected one database archive",
  );
  const media = value.artifacts.filter((item) => item.kind === "media");
  assert(
    new Set(media.map((item) => item.mediaKey)).size === media.length,
    "Duplicate media keys",
  );
}
export function validateManifest(value, id, availableMigrations) {
  validateIdentity(value, id);
  validateCollections(value, availableMigrations);
  validateArtifacts(value, id);
  return value;
}
