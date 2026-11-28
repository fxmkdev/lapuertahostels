import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanup,
  closedPrCandidates,
  githubClient,
  previewApps,
  retentionCandidates,
} from "./clean-preview.mjs";

const now = Date.parse("2026-11-28T12:00:00Z");
const prefixes = ["site-preview", "cms-preview"];
const repository = "example/site";
const repoPath = `/repos/${repository}`;
const env = {
  FLY_ORG: "test-org",
  FLY_PREVIEW_FRONTEND_APP_PREFIX: prefixes[0],
  FLY_PREVIEW_CMS_APP_PREFIX: prefixes[1],
  GITHUB_REPOSITORY: repository,
  GITHUB_TOKEN: "test-token",
};
const app = (id, age = 1) => ({
  ID: id,
  CurrentRelease:
    age === null
      ? null
      : {
          CreatedAt: new Date(now - age * 86_400_000).toISOString(),
        },
});
const pr = (number, state = "closed", branch = "feature", extra = {}) => ({
  number,
  state,
  head: { ref: branch, repo: { full_name: repository } },
  ...extra,
});

function api(routes = {}, pageSize = 100) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    const route = routes[url.pathname];
    if (route instanceof Error) throw route;
    const result = typeof route === "function" ? route(url) : (route ?? []);
    if (!Array.isArray(result))
      return { ok: false, status: result.status ?? 403 };
    const offset = (Number(url.searchParams.get("page")) - 1) * pageSize;
    return {
      ok: true,
      json: async () => result.slice(offset, offset + pageSize),
    };
  };
  return {
    calls,
    request,
    github: githubClient({ token: env.GITHUB_TOKEN, request, pageSize }),
  };
}

function associationRoutes(
  ids,
  prs,
  { branch = "feature", environment = "preview-frontend" } = {},
) {
  return {
    [`${repoPath}/deployments`]: (url) =>
      url.searchParams.get("environment") === environment
        ? ids.map((_, i) => ({ id: i + 1, ref: branch }))
        : [],
    ...Object.fromEntries(
      ids.map((id, i) => [
        `${repoPath}/deployments/${i + 1}/statuses`,
        [{ environment_url: `https://${id}.fly.dev/` }],
      ]),
    ),
    [`${repoPath}/pulls`]: prs,
  };
}

async function closed(rawApps, routes, options = {}) {
  const mock = api(routes, options.pageSize);
  const warnings = [];
  const result = await closedPrCandidates(previewApps(rawApps, prefixes, now), {
    github: mock.github,
    repository,
    warn: (warning) => warnings.push(warning),
  });
  return { result, warnings, ...mock };
}

async function runCleanup(rawApps, routes = {}, overrides = {}) {
  const mock = api(routes);
  const commands = [];
  const logs = [];
  const warnings = [];
  const result = await cleanup({
    env,
    now,
    request: mock.request,
    run: (command, args) => {
      commands.push({ command, args });
      return args[1] === "list" ? JSON.stringify(rawApps) : "";
    },
    log: (line) => logs.push(line),
    warn: (line) => warnings.push(line),
    ...overrides,
  });
  return { result, commands, logs, warnings, ...mock };
}

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

test("network failure skips PR cleanup while retaining age-based deletion", async () => {
  const routes = {
    [`${repoPath}/deployments`]: new Error("network unavailable"),
  };
  const { commands, warnings, result } = await runCleanup(
    [app("site-preview-new"), app("site-preview-old", 5)],
    routes,
  );
  assert.deepEqual([...result.keys()], ["site-preview-old"]);
  assert.ok(warnings.length);
  assert.deepEqual(commands.at(-1).args, [
    "apps",
    "destroy",
    "--yes",
    "site-preview-old",
  ]);
});

test("combines PR and retention candidates, deleting each app exactly once with reasons", async () => {
  const id = "site-preview-closed";
  const raw = [
    app(id),
    ...Array.from({ length: 7 }, (_, i) => app(`cms-preview-${i}`, i)),
  ];
  const { commands, logs, result } = await runCleanup(
    raw,
    associationRoutes([id], [pr(42)]),
  );
  const deleted = commands
    .filter(({ args }) => args[1] === "destroy")
    .map(({ args }) => args.at(-1));
  assert.deepEqual(deleted, ["cms-preview-5", "cms-preview-6", id]);
  assert.equal(new Set(deleted).size, result.size);
  assert.ok(logs.some((line) => line.includes("closed PR #42")));
  assert.ok(
    logs.some(
      (line) =>
        line.includes("over 4 days") && line.includes("six most recent"),
    ),
  );
});

test("no apps makes no GitHub or destroy requests", async () => {
  const { result, calls, commands } = await runCleanup([]);
  assert.equal(result.size, 0);
  assert.equal(calls.length, 0);
  assert.equal(commands.length, 1);
});

test("Fly discovery and deletion failures propagate", async () => {
  await assert.rejects(
    runCleanup(
      [],
      {},
      {
        run: () => {
          throw new Error("Fly discovery failed");
        },
      },
    ),
    /Fly discovery failed/,
  );
  await assert.rejects(
    runCleanup(
      [],
      {},
      {
        run: (_, args) => {
          if (args[1] === "list")
            return JSON.stringify([app("site-preview-old", 5)]);
          throw new Error("Fly destruction failed");
        },
      },
    ),
    /Fly destruction failed/,
  );
});

test("missing GitHub credentials or repository skips only PR-based cleanup", async () => {
  for (const overrides of [{ GITHUB_TOKEN: "" }, { GITHUB_REPOSITORY: "" }]) {
    const { result, warnings, calls } = await runCleanup(
      [app("site-preview-new"), app("site-preview-old", 5)],
      {},
      { env: { ...env, ...overrides } },
    );
    assert.deepEqual([...result.keys()], ["site-preview-old"]);
    assert.ok(warnings.length);
    assert.equal(calls.length, 0);
  }
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

test("retention-only cleanup does not require GitHub lookup and deduplicates reasons", async () => {
  const { result, calls, commands } = await runCleanup([
    ...Array.from({ length: 8 }, (_, i) => app(`site-preview-${i}`, i + 5)),
  ]);
  assert.equal(result.size, 8);
  assert.equal(calls.length, 0);
  assert.equal(commands.filter(({ args }) => args[1] === "destroy").length, 8);
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
