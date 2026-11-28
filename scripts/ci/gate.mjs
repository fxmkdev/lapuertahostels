import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const frontendChecks = [
  "frontend-lint",
  "frontend-check-format",
  "frontend-typecheck",
  "frontend-unit-tests",
  "frontend-publish-chromatic",
];
export const cmsChecks = [
  "cms-lint",
  "cms-check-format",
  "cms-typecheck",
  "cms-unit-tests",
];
function requireSuccess(needs, name) {
  if (needs[name]?.result !== "success")
    throw new Error(
      `Required job ${name}: ${needs[name]?.result ?? "missing"}`,
    );
}
export function validatePrerequisites(needs) {
  for (const name of [
    "version",
    "detect-changes",
    "ci-tests",
    "frontend-build-push",
    "cms-build-push",
  ])
    requireSuccess(needs, name);
  const changed = needs["detect-changes"].outputs;
  for (const flag of [
    "frontend_changed",
    "cms_changed",
    "e2e_changed",
    "types_changed",
    "force",
  ]) {
    if (!["true", "false"].includes(changed?.[flag]))
      throw new Error(`Missing change flag: ${flag}`);
  }
  if (changed.types_changed === "true")
    requireSuccess(needs, "verify-cms-types");
  else if (!["success", "skipped"].includes(needs["verify-cms-types"]?.result))
    throw new Error(
      "CMS type verification did not succeed or intentionally skip",
    );
  for (const app of ["frontend", "cms"]) {
    const { checks, built } = needs[`${app}-build-push`].outputs;
    if (
      !["true", "false"].includes(checks) ||
      !["true", "false"].includes(built)
    )
      throw new Error(`Missing ${app} image policy outputs`);
    if (
      (changed[`${app}_changed`] === "true" ||
        changed.force === "true" ||
        built === "true") &&
      checks !== "true"
    )
      throw new Error(`Missing required ${app} checks`);
  }
}
export function validate(needs) {
  validatePrerequisites(needs);
  for (const [app, checks] of [
    ["frontend", frontendChecks],
    ["cms", cmsChecks],
  ]) {
    if (needs[`${app}-build-push`].outputs.checks === "true")
      for (const name of checks) requireSuccess(needs, name);
  }
  const e2e =
    needs["detect-changes"].outputs.e2e_changed === "true" ||
    ["frontend", "cms"].some(
      (app) => needs[`${app}-build-push`].outputs.checks === "true",
    );
  if (e2e) requireSuccess(needs, "e2e-tests");
  for (const [name, job] of Object.entries(needs))
    if (!["success", "skipped"].includes(job.result))
      throw new Error(`Job ${name}: ${job.result}`);
  return e2e;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const needs = JSON.parse(process.env.NEEDS ?? readFileSync(0, "utf8"));
  if (process.argv[2] === "prerequisites") validatePrerequisites(needs);
  else validate(needs);
}
