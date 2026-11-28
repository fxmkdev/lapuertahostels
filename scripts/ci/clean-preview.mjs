import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { githubClient } from "./preview-github.mjs";

const day = 24 * 60 * 60 * 1000;
const environments = ["preview-frontend", "preview-cms"];

function execute(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function previewApps(apps, prefixes, now = Date.now()) {
  if (!Array.isArray(apps)) throw new Error("Fly returned an invalid app list");
  if (prefixes.length !== 2 || prefixes.some((prefix) => !prefix?.trim()))
    throw new Error("Both preview app prefixes are required");
  return apps.flatMap((app) => {
    const matches = prefixes.flatMap((prefix, index) =>
      typeof app.ID === "string" && app.ID.startsWith(`${prefix}-`)
        ? [environments[index]]
        : [],
    );
    if (!matches.length) return [];
    const released = app.CurrentRelease?.CreatedAt;
    const age = released == null ? null : (now - Date.parse(released)) / day;
    if (age !== null && !Number.isFinite(age))
      throw new Error(`Invalid release timestamp for ${app.ID}`);
    return [{ id: app.ID, age, environments: matches }];
  });
}

export function retentionCandidates(apps) {
  const candidates = new Map();
  const add = (app, reason) => {
    if (!candidates.has(app.id)) candidates.set(app.id, []);
    candidates.get(app.id).push(reason);
  };
  for (const app of apps) {
    if (app.age === null) add(app, "no release timestamp");
    else if (app.age > 4) add(app, "last release over 4 days ago");
  }
  // jq sorts null before numbers. Preserve that behavior, including ties and
  // the shared six-app limit across frontend and CMS, before unioning rules.
  const sorted = [...apps].sort(
    (a, b) => (a.age ?? -Infinity) - (b.age ?? -Infinity),
  );
  for (const app of sorted.slice(6)) add(app, "outside six most recent apps");
  return candidates;
}

function appFromUrl(value, apps) {
  try {
    const url = new URL(value);
    return apps.find((app) => url.origin === `https://${app.id}.fly.dev`);
  } catch {
    return undefined;
  }
}

async function deploymentBranches(github, repoPath, environment, apps) {
  const branches = new Map(apps.map((app) => [app.id, new Set()]));
  for await (const deployments of github.pages(`${repoPath}/deployments`, {
    environment,
  })) {
    // Inspect every record: conflicting source branches must not become a
    // deletion decision. Batch the status reads to keep history scans cheap.
    for await (const { deployment, statuses } of github.deploymentStatuses(
      repoPath,
      deployments,
    )) {
      for (const status of statuses) {
        const app = appFromUrl(status.environment_url, apps);
        if (app) branches.get(app.id).add(deployment.ref);
      }
    }
  }
  return branches;
}

async function pullRequestsForBranch(github, repository, branch) {
  const prs = [];
  const owner = repository.split("/")[0];
  for await (const page of github.pages(`/repos/${repository}/pulls`, {
    state: "all",
    head: `${owner}:${branch}`,
  })) {
    for (const pr of page) {
      if (
        pr.head?.repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
        pr.head?.ref !== branch ||
        !Number.isSafeInteger(pr.number) ||
        !["open", "closed"].includes(pr.state)
      )
        throw new Error("Ambiguous PR association");
      prs.push(pr);
    }
  }
  return prs;
}

export async function closedPrCandidates(
  apps,
  { github, repository, warn = console.warn },
) {
  const candidates = new Map();
  if (!apps.length) return candidates;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    warn("Skipping PR cleanup: invalid GITHUB_REPOSITORY");
    return candidates;
  }
  const repoPath = `/repos/${repository}`;
  const pullRequests = new Map();
  const lookup = (branch) => {
    if (!pullRequests.has(branch))
      pullRequests.set(
        branch,
        pullRequestsForBranch(github, repository, branch),
      );
    return pullRequests.get(branch);
  };
  for (const environment of environments) {
    // Overlapping prefix configurations are ambiguous for PR-based cleanup.
    const targets = apps.filter(
      (app) =>
        app.environments.length === 1 && app.environments[0] === environment,
    );
    if (!targets.length) continue;
    let branches;
    try {
      branches = await deploymentBranches(
        github,
        repoPath,
        environment,
        targets,
      );
    } catch (error) {
      warn(`Skipping PR cleanup for ${environment}: ${error.message}`);
      continue;
    }
    for (const app of targets) {
      const refs = [...branches.get(app.id)];
      if (refs.length !== 1) continue;
      try {
        const prs = await lookup(refs[0]);
        if (prs.length && prs.every((pr) => pr.state === "closed"))
          candidates.set(app.id, [
            `closed PR${prs.length === 1 ? "" : "s"} ${prs.map((pr) => `#${pr.number}`).join(", ")}`,
          ]);
      } catch (error) {
        warn(`Skipping PR cleanup for ${app.id}: ${error.message}`);
      }
    }
  }
  return candidates;
}

export async function cleanup({
  env = process.env,
  run = execute,
  request = fetch,
  now = Date.now(),
  log = console.log,
  warn = console.warn,
} = {}) {
  if (!env.FLY_ORG?.trim()) throw new Error("FLY_ORG is required");
  const prefixes = [
    env.FLY_PREVIEW_FRONTEND_APP_PREFIX,
    env.FLY_PREVIEW_CMS_APP_PREFIX,
  ];
  // Validate configuration even if Fly returns no apps.
  previewApps([], prefixes, now);
  const apps = previewApps(
    JSON.parse(run("flyctl", ["apps", "list", "--json", "--org", env.FLY_ORG])),
    prefixes,
    now,
  );
  const candidates = retentionCandidates(apps);
  const closed = await closedPrCandidates(
    apps.filter((app) => !candidates.has(app.id)),
    {
      github: githubClient({
        token: env.GITHUB_TOKEN,
        apiUrl: env.GITHUB_API_URL,
        request,
      }),
      repository: env.GITHUB_REPOSITORY,
      warn,
    },
  );
  for (const [id, reasons] of closed) candidates.set(id, reasons);
  for (const [id, reasons] of [...candidates].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    log(`Deleting ${id}: ${reasons.join("; ")}`);
    run("flyctl", ["apps", "destroy", "--yes", id]);
  }
  log(`Deleted ${candidates.size} preview app(s)`);
  return candidates;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await cleanup();
}
