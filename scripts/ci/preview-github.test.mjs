import { test } from "node:test";
import assert from "node:assert/strict";
import { githubClient } from "./preview-github.mjs";

const repoPath = "/repos/example/site";
const deployment = (id) => ({ id, node_id: String(id), ref: "feature" });
const statusNode = (id, { hasNextPage = false } = {}) => ({
  databaseId: id,
  statuses: {
    nodes: [{ environmentUrl: `https://site-preview-${id}.fly.dev/` }],
    pageInfo: { hasNextPage },
  },
});
const collect = async (iterator) => {
  const items = [];
  for await (const item of iterator) items.push(item);
  return items;
};

test("batches status queries in groups of fifty without per-deployment REST calls", async () => {
  const calls = [];
  const github = githubClient({
    token: "token",
    request: async (url, options) => {
      calls.push({ url, options });
      assert.equal(url.pathname, "/graphql");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Type"], "application/json");
      const { variables } = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          data: { nodes: variables.ids.map((id) => statusNode(Number(id))) },
        }),
      };
    },
  });
  const deployments = Array.from({ length: 101 }, (_, index) =>
    deployment(index + 1),
  );
  const records = await collect(
    github.deploymentStatuses(repoPath, deployments),
  );
  assert.equal(records.length, 101);
  assert.deepEqual(
    calls.map(({ options }) => JSON.parse(options.body).variables.ids.length),
    [50, 50, 1],
  );
  assert.deepEqual(records[100], {
    deployment: deployments[100],
    statuses: [{ environment_url: "https://site-preview-101.fly.dev/" }],
  });
});

test("paginates unusually long status histories through REST without truncation", async () => {
  const paths = [];
  const github = githubClient({
    token: "token",
    pageSize: 2,
    request: async (url) => {
      paths.push(url.pathname + url.search);
      const data =
        url.pathname === "/graphql"
          ? { data: { nodes: [statusNode(1, { hasNextPage: true })] } }
          : url.searchParams.get("page") === "1"
            ? [
                { environment_url: "https://site-preview-first.fly.dev/" },
                { environment_url: "" },
              ]
            : [{ environment_url: "https://site-preview-last.fly.dev/" }];
      return { ok: true, json: async () => data };
    },
  });
  const records = await collect(
    github.deploymentStatuses(repoPath, [deployment(1)]),
  );
  assert.ok(
    records
      .flatMap(({ statuses }) => statuses)
      .some(
        ({ environment_url }) =>
          environment_url === "https://site-preview-last.fly.dev/",
      ),
  );
  assert.deepEqual(paths, [
    "/graphql",
    `${repoPath}/deployments/1/statuses?per_page=2&page=1`,
    `${repoPath}/deployments/1/statuses?per_page=2&page=2`,
  ]);
});

for (const [description, response] of [
  [
    "partial GraphQL errors",
    { data: { nodes: [statusNode(1)] }, errors: [{ message: "unavailable" }] },
  ],
  ["missing response data", {}],
  ["missing deployment nodes", { data: { nodes: [] } }],
  ["inaccessible deployment", { data: { nodes: [null] } }],
  ["mismatched deployment identity", { data: { nodes: [statusNode(2)] } }],
  [
    "missing pagination evidence",
    { data: { nodes: [{ databaseId: 1, statuses: { nodes: [] } }] } },
  ],
]) {
  test(`rejects ${description} instead of accepting incomplete status evidence`, async () => {
    const github = githubClient({
      token: "token",
      request: async () => ({ ok: true, json: async () => response }),
    });
    await assert.rejects(
      collect(github.deploymentStatuses(repoPath, [deployment(1)])),
      /deployment status/,
    );
  });
}

test("fails a complete batch before yielding if one deployment is missing", async () => {
  const github = githubClient({
    token: "token",
    request: async () => ({
      ok: true,
      json: async () => ({ data: { nodes: [statusNode(1), null] } }),
    }),
  });
  const records = github.deploymentStatuses(repoPath, [
    deployment(1),
    deployment(2),
  ]);
  await assert.rejects(records.next(), /invalid deployment status/);
});

test("missing deployment identity prevents status queries", async () => {
  let calls = 0;
  const github = githubClient({
    token: "token",
    request: async () => {
      calls++;
    },
  });
  await assert.rejects(
    collect(github.deploymentStatuses(repoPath, [{ id: 1, ref: "feature" }])),
    /Invalid deployment/,
  );
  assert.equal(calls, 0);
});

test("GraphQL authorization failures propagate to conservative cleanup handling", async () => {
  const github = githubClient({
    token: "token",
    request: async () => ({ ok: false, status: 403 }),
  });
  await assert.rejects(
    collect(github.deploymentStatuses(repoPath, [deployment(1)])),
    /HTTP 403/,
  );
});
