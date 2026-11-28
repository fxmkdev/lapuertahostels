import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function pinArtifactPrefix(env) {
  assert(env.DEPLOYMENT_SHA, "Missing deployment SHA");
  return `snapshot-pin-${env.DEPLOYMENT_ENVIRONMENT}-${env.DEPLOYMENT_SHA}-`;
}
export async function recoverWorkflowPin(env, run) {
  if (!env.GITHUB_RUN_ID || Number(env.GITHUB_RUN_ATTEMPT) <= 1) return;
  assert(env.GITHUB_REPOSITORY, "Missing workflow repository");
  const artifacts = JSON.parse(
    run(
      "gh",
      [
        "api",
        `repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/artifacts?per_page=100`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    ),
  ).artifacts;
  const artifact = artifacts
    .filter(({ name }) => name.startsWith(pinArtifactPrefix(env)))
    .sort((a, b) => b.id - a.id)[0];
  // A preflight that failed before pinning never modified the destination.
  if (!artifact) return;
  assert(
    !artifact.expired,
    "Recovery snapshot pin expired; recover explicitly rather than selecting latest",
  );
  const dir = await mkdtemp(join(tmpdir(), "workflow-snapshot-pin-"));
  try {
    run(
      "gh",
      [
        "run",
        "download",
        env.GITHUB_RUN_ID,
        "--repo",
        env.GITHUB_REPOSITORY,
        "--name",
        artifact.name,
        "--dir",
        dir,
      ],
      { stdio: "inherit" },
    );
    return (await readFile(join(dir, "snapshot-id"), "utf8")).trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
