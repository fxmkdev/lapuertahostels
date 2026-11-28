import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, previewApps, retentionCandidates } from "./clean-preview.mjs";
import { app, now, prefixes } from "./test-helpers/preview.mjs";

test("matches only literal configured preview prefixes", () => {
  const apps = previewApps(
    [
      app("site-preview-abc"),
      app("cms-preview-def"),
      app("site-production"),
      app("cms-staging"),
      app("other-site-preview-abc"),
      app("site-previewish-abc"),
      app("unrelated"),
    ],
    prefixes,
    now,
  );
  assert.deepEqual(
    apps.map(({ id }) => id),
    ["site-preview-abc", "cms-preview-def"],
  );
  assert.equal(
    previewApps([app("siteXpreview-abc")], ["site.preview", "cms"], now).length,
    0,
  );
});

test("requires both nonempty prefixes, an organization, and valid Fly data", async () => {
  assert.throws(() => previewApps([], ["", "cms"], now), /prefixes/);
  assert.throws(() => previewApps({}, prefixes, now), /invalid app list/);
  assert.throws(
    () =>
      previewApps(
        [{ ID: "site-preview-a", CurrentRelease: { CreatedAt: "bad" } }],
        prefixes,
        now,
      ),
    /timestamp/,
  );
  await assert.rejects(cleanup({ env: {} }), /FLY_ORG/);
  await assert.rejects(cleanup({ env: { FLY_ORG: "org" } }), /prefixes/);
});

test("retains the exact four-day boundary and selects missing or older releases", () => {
  const candidates = retentionCandidates(
    previewApps(
      [
        app("site-preview-new", 0),
        app("site-preview-boundary", 4),
        app("cms-preview-old", 4.001),
        app("cms-preview-missing", null),
      ],
      prefixes,
      now,
    ),
  );
  assert.deepEqual(
    [...candidates.keys()],
    ["cms-preview-old", "cms-preview-missing"],
  );
});

test("applies the six-app cap jointly and unions overlapping retention reasons", () => {
  const raw = Array.from({ length: 8 }, (_, i) =>
    app(`${i % 2 ? "cms" : "site"}-preview-${i}`, i),
  );
  const candidates = retentionCandidates(previewApps(raw, prefixes, now));
  assert.deepEqual(
    [...candidates.keys()],
    ["cms-preview-5", "site-preview-6", "cms-preview-7"],
  );
  assert.equal(candidates.get("site-preview-6").length, 2);
});

test("preserves null-first sorting and stable ties from the original jq selection", () => {
  const apps = previewApps(
    [
      app("site-preview-null", null),
      ...Array.from({ length: 6 }, (_, i) => app(`cms-preview-${i}`, 1)),
    ],
    prefixes,
    now,
  );
  assert.deepEqual(
    [...retentionCandidates(apps).keys()],
    ["site-preview-null", "cms-preview-5"],
  );
});
