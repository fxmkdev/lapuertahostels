import {
  cleanup,
  closedPrCandidates,
  githubClient,
  previewApps,
} from "../clean-preview.mjs";

export const now = Date.parse("2026-11-28T12:00:00Z");
export const prefixes = ["site-preview", "cms-preview"];
export const repository = "example/site";
export const repoPath = `/repos/${repository}`;
export const env = {
  FLY_ORG: "test-org",
  FLY_PREVIEW_FRONTEND_APP_PREFIX: prefixes[0],
  FLY_PREVIEW_CMS_APP_PREFIX: prefixes[1],
  GITHUB_REPOSITORY: repository,
  GITHUB_TOKEN: "test-token",
};
export const app = (id, age = 1) => ({
  ID: id,
  CurrentRelease:
    age === null
      ? null
      : {
          CreatedAt: new Date(now - age * 86_400_000).toISOString(),
        },
});
export const pr = (
  number,
  state = "closed",
  branch = "feature",
  extra = {},
) => ({
  number,
  state,
  head: { ref: branch, repo: { full_name: repository } },
  ...extra,
});

export function api(routes = {}, pageSize = 100) {
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

export function associationRoutes(
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

export async function closed(rawApps, routes, options = {}) {
  const mock = api(routes, options.pageSize);
  const warnings = [];
  const result = await closedPrCandidates(previewApps(rawApps, prefixes, now), {
    github: mock.github,
    repository,
    warn: (warning) => warnings.push(warning),
  });
  return { result, warnings, ...mock };
}

export async function runCleanup(rawApps, routes = {}, overrides = {}) {
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
