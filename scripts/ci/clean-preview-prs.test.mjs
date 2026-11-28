import { githubClient } from "./preview-github.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { closedPrCandidates, previewApps } from "./clean-preview.mjs";
import {
  api,
  app,
  associationRoutes,
  closed,
  now,
  prefixes,
  pr,
  repository,
  repoPath,
} from "./test-helpers/preview.mjs";

for (const [description, details] of [
  ["merged", { merged_at: "2026-11-28T10:00:00Z" }],
  ["closed without merging", { merged_at: null }],
]) {
  test(`selects a preview whose PR was ${description}`, async () => {
    const id = "site-preview-abc";
    const { result, warnings } = await closed(
      [app(id)],
      associationRoutes([id], [pr(42, "closed", "feature", details)]),
    );
    assert.deepEqual([...result], [[id, ["closed PR #42"]]]);
    assert.deepEqual(warnings, []);
  });
}

for (const description of ["open", "reopened"]) {
  test(`retains previews belonging to ${description} PRs`, async () => {
    const id = "site-preview-abc";
    const { result } = await closed(
      [app(id)],
      associationRoutes([id], [pr(42, "open")]),
    );
    assert.equal(result.size, 0);
  });
}

test("supports multiple revisions and both app types, caching PR queries", async () => {
  const ids = [
    "site-preview-oldsha",
    "site-preview-newsha",
    "cms-preview-newsha",
  ];
  const routes = associationRoutes(ids, [pr(42)]);
  routes[`${repoPath}/deployments`] = (url) =>
    url.searchParams.get("environment") === "preview-frontend"
      ? [
          { id: 1, ref: "feature" },
          { id: 2, ref: "feature" },
        ]
      : [{ id: 3, ref: "feature" }];
  const { result, calls } = await closed(
    ids.map((id) => app(id)),
    routes,
  );
  assert.deepEqual([...result.keys()], ids);
  assert.equal(
    calls.filter(({ url }) => url.pathname.endsWith("/pulls")).length,
    1,
  );
});

test("retains a reused branch while any matching PR is open", async () => {
  const id = "site-preview-abc";
  const { result } = await closed(
    [app(id)],
    associationRoutes([id], [pr(1), pr(2, "open")]),
  );
  assert.equal(result.size, 0);
});

test("selects a reused branch when all its PRs are closed", async () => {
  const id = "site-preview-abc";
  const { result } = await closed(
    [app(id)],
    associationRoutes([id], [pr(1), pr(2)]),
  );
  assert.deepEqual(result.get(id), ["closed PRs #1, #2"]);
});

test("retains apps without a deployment or matching PR", async () => {
  const id = "site-preview-abc";
  assert.equal((await closed([app(id)], {})).result.size, 0);
  assert.equal(
    (await closed([app(id)], associationRoutes([id], []))).result.size,
    0,
  );
});

test("rejects foreign-repository or malformed PR associations", async () => {
  const id = "site-preview-abc";
  for (const match of [
    pr(1, "closed", "different"),
    pr(1, "closed", "feature", {
      head: { ref: "feature", repo: { full_name: "other/site" } },
    }),
    pr(1, "unknown"),
  ]) {
    const { result, warnings } = await closed(
      [app(id)],
      associationRoutes([id], [match]),
    );
    assert.equal(result.size, 0);
    assert.match(warnings[0], /Ambiguous/);
  }
});

test("retains apps with conflicting deployment source branches", async () => {
  const id = "site-preview-abc";
  const routes = associationRoutes([id, id], [pr(42)]);
  routes[`${repoPath}/deployments`] = [
    { id: 1, ref: "feature" },
    { id: 2, ref: "other" },
  ];
  const { result } = await closed([app(id)], routes);
  assert.equal(result.size, 0);
});

test("retains apps when configured prefixes overlap", async () => {
  const mock = api();
  const apps = previewApps(
    [app("site-preview-abc")],
    ["site", "site-preview"],
    now,
  );
  assert.equal(
    (await closedPrCandidates(apps, { github: mock.github, repository })).size,
    0,
  );
  assert.equal(mock.calls.length, 0);
});

test("matches the exact HTTPS Fly app origin, across all status records", async () => {
  const id = "site-preview-abc";
  const routes = associationRoutes([id], [pr(42)]);
  for (const url of [
    `https://${id}.fly.dev.evil.test/`,
    `https://other.fly.dev/${id}`,
    `http://${id}.fly.dev/`,
    `https://${id}.fly.dev:8443/`,
    "bad URL",
    "",
  ]) {
    routes[`${repoPath}/deployments/1/statuses`] = [{ environment_url: url }];
    assert.equal((await closed([app(id)], routes)).result.size, 0);
  }
  routes[`${repoPath}/deployments/1/statuses`] = [
    { environment_url: "" },
    { environment_url: `https://${id}.fly.dev/` },
  ];
  assert.equal((await closed([app(id)], routes)).result.size, 1);
});

test("paginates deployment, status, and PR lists and uses state=all and owner-qualified head", async () => {
  const id = "site-preview-abc";
  const routes = associationRoutes([id], [pr(1), pr(2), pr(3, "open")]);
  routes[`${repoPath}/deployments`] = (url) =>
    url.searchParams.get("environment") === "preview-frontend"
      ? [
          { id: 2, ref: "ignored" },
          { id: 3, ref: "ignored" },
          { id: 1, ref: "feature" },
        ]
      : [];
  routes[`${repoPath}/deployments/1/statuses`] = [
    { environment_url: "" },
    { environment_url: "" },
    { environment_url: `https://${id}.fly.dev/` },
  ];
  const { result, calls } = await closed([app(id)], routes, { pageSize: 2 });
  assert.equal(result.size, 0);
  for (const suffix of ["/deployments", "/deployments/1/statuses", "/pulls"]) {
    assert.ok(
      calls.some(
        ({ url }) =>
          url.pathname.endsWith(suffix) && url.searchParams.get("page") === "2",
      ),
    );
  }
  const pullCall = calls.find(({ url }) => url.pathname.endsWith("/pulls"));
  assert.equal(pullCall.url.searchParams.get("state"), "all");
  assert.equal(pullCall.url.searchParams.get("head"), "example:feature");
  assert.equal(pullCall.options.headers.Authorization, "Bearer test-token");
});

for (const suffix of ["/deployments", "/deployments/1/statuses", "/pulls"]) {
  test(`skips PR-based deletion if ${suffix} fails`, async () => {
    const id = "site-preview-abc";
    const routes = associationRoutes([id], [pr(42)]);
    routes[`${repoPath}${suffix}`] = { status: 403 };
    const { result, warnings } = await closed([app(id)], routes);
    assert.equal(result.size, 0);
    assert.ok(warnings.length);
  });
}

test("a later failed status page invalidates earlier matches", async () => {
  const id = "site-preview-abc";
  const routes = associationRoutes([id], [pr(42)]);
  routes[`${repoPath}/deployments/1/statuses`] = (url) =>
    url.searchParams.get("page") === "1"
      ? [{ environment_url: `https://${id}.fly.dev/` }]
      : { status: 500 };
  const { result, warnings } = await closed([app(id)], routes, { pageSize: 1 });
  assert.equal(result.size, 0);
  assert.ok(warnings.length);
});

test("one environment's GitHub failure does not block the other environment", async () => {
  const id = "cms-preview-abc";
  const routes = associationRoutes([id], [pr(42)], {
    environment: "preview-cms",
  });
  const deployments = routes[`${repoPath}/deployments`];
  routes[`${repoPath}/deployments`] = (url) =>
    url.searchParams.get("environment") === "preview-frontend"
      ? { status: 429 }
      : deployments(url);
  const { result, warnings } = await closed(
    [app("site-preview-abc"), app(id)],
    routes,
  );
  assert.deepEqual([...result.keys()], [id]);
  assert.match(warnings[0], /HTTP 429/);
});

test("a failed branch lookup keeps that branch while other branches are cleaned", async () => {
  const ids = ["site-preview-one", "site-preview-two"];
  const routes = associationRoutes(ids, []);
  routes[`${repoPath}/deployments`] = (url) =>
    url.searchParams.get("environment") === "preview-frontend"
      ? [
          { id: 1, ref: "feature" },
          { id: 2, ref: "other" },
        ]
      : [];
  routes[`${repoPath}/pulls`] = (url) =>
    url.searchParams.get("head") === "example:feature"
      ? { status: 500 }
      : [pr(42, "closed", "other")];
  const { result, warnings } = await closed(
    ids.map((id) => app(id)),
    routes,
  );
  assert.deepEqual([...result.keys()], [ids[1]]);
  assert.equal(warnings.length, 1);
});

test("invalid GitHub list responses fail conservatively", async () => {
  const github = githubClient({
    token: "token",
    request: async () => ({
      ok: true,
      json: async () => ({ unexpected: true }),
    }),
  });
  const warnings = [];
  const result = await closedPrCandidates(
    previewApps([app("site-preview-one")], prefixes, now),
    {
      github,
      repository,
      warn: (message) => warnings.push(message),
    },
  );
  assert.equal(result.size, 0);
  assert.match(warnings[0], /invalid list/);
});
