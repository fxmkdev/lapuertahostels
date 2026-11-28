import { test } from "node:test";
import { withIntegrationFixture } from "./integration-fixture.mjs";
import * as cases from "./integration-cases.mjs";

test(
  "real MongoDB/S3 export and restoration preserve environment credentials and recover from failures",
  {
    skip:
      !process.env.SNAPSHOT_TEST_MONGODB_URI ||
      !process.env.SNAPSHOT_TEST_S3_ENDPOINT,
    timeout: 180000,
  },
  async (t) => {
    await withIntegrationFixture(async (context) => {
      await t.test(
        "published archive contains no production auth collections",
        () => cases.archiveExcludesAuth(context),
      );
      await t.test("failed export leaves latest unchanged", () =>
        cases.exportFailure(context),
      );
      await t.test(
        "collections appearing during export fail before archive upload",
        () => cases.collectionChange(context),
      );
      await t.test(
        "missing media or upload failure leaves latest unchanged",
        () => cases.missingMedia(context),
      );
      await t.test("corrupt artifact fails before any target changes", () =>
        cases.corruptArtifact(context),
      );
      await t.test(
        "incompatible migration and missing snapshot are rejected",
        () => cases.incompatibleMigration(context),
      );
      await t.test("production targets are rejected", () =>
        cases.rejectProduction(context),
      );
      await t.test(
        "interrupted restore preserves users and keys and can be rerun",
        () => cases.restoreRecovery(context),
      );
      await t.test(
        "release restores source history before applying real pending Payload migrations",
        () => cases.applyPendingMigration(context),
      );
    });
  },
);
