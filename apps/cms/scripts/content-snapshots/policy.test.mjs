import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertTarget,
  isContentCollection,
  validateManifest,
} from "./policy.mjs";

const env = {
  SNAPSHOT_RESTORE_ENABLED: "true",
  FLY_APP_NAME: "preview-abc123",
  DEPLOYMENT_ENVIRONMENT: "preview",
  SNAPSHOT_PRODUCTION_APP: "production",
  SNAPSHOT_STAGING_APP: "staging",
  SNAPSHOT_PREVIEW_APP_PREFIX: "preview",
};
test("content allowlist excludes credentials, sessions and future collections", () => {
  for (const name of [
    "pages",
    "globals",
    "payload-migrations",
    "_pages_versions",
    "_footer_versions",
  ])
    assert(isContentCollection(name));
  for (const name of [
    "users",
    "api-keys",
    "payload-preferences",
    "_users_versions",
    "sessions",
    "payload-locked-documents",
    "payload-jobs",
    "new-auth-collection",
  ])
    assert(!isContentCollection(name));
});
test("restoration requires an explicit enabled non-production target", () => {
  assert.doesNotThrow(() => assertTarget(env));
  assert.doesNotThrow(() =>
    assertTarget({
      ...env,
      FLY_APP_NAME: "staging",
      DEPLOYMENT_ENVIRONMENT: "staging",
    }),
  );
  for (const change of [
    { SNAPSHOT_RESTORE_ENABLED: "false" },
    { FLY_APP_NAME: "production" },
    { DEPLOYMENT_ENVIRONMENT: "production" },
    { FLY_APP_NAME: "preview-other" },
    { SNAPSHOT_PRODUCTION_APP: "preview-abc123" },
    { SNAPSHOT_STAGING_APP: "production" },
  ]) {
    assert.throws(() => assertTarget({ ...env, ...change }));
  }
});
test("manifest rejects incompatible migrations, credential collections and corrupt artifact metadata", () => {
  const manifest = {
    formatVersion: 1,
    id: "test",
    sourceDatabase: "source",
    createdAt: new Date().toISOString(),
    collections: ["pages"],
    migrations: ["migration"],
    artifacts: [
      {
        kind: "database",
        key: "snapshots/test/database.archive.gz",
        size: 1,
        sha256: "a".repeat(64),
      },
    ],
  };
  assert.equal(validateManifest(manifest, "test", ["migration"]), manifest);
  for (const change of [
    { formatVersion: 2 },
    { collections: ["users"] },
    { collections: ["pages", "pages"] },
    { migrations: ["future"] },
    { sourceDatabase: "bad.*" },
    { artifacts: [] },
    { artifacts: [{ ...manifest.artifacts[0], key: "snapshots/other/file" }] },
    { artifacts: [{ ...manifest.artifacts[0], sha256: "bad" }] },
  ]) {
    assert.throws(() =>
      validateManifest({ ...manifest, ...change }, "test", ["migration"]),
    );
  }
});
