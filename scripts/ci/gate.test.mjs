import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmsChecks,
  frontendChecks,
  validate,
  validatePrerequisites,
} from "./gate.mjs";
function fixture(frontend = false, cms = false, e2e = false) {
  const needs = Object.fromEntries(
    [
      "version",
      "detect-changes",
      "verify-cms-types",
      "frontend-build-push",
      "cms-build-push",
      "ci-tests",
      "admit-images",
    ].map((name) => [name, { result: "success", outputs: {} }]),
  );
  needs["admit-images"].outputs.current = "true";
  for (const [app, required, names] of [
    ["frontend", frontend, frontendChecks],
    ["cms", cms, cmsChecks],
  ]) {
    needs[`${app}-build-push`].outputs = {
      checks: String(required),
      built: "false",
    };
    for (const name of names)
      needs[name] = { result: required ? "success" : "skipped" };
  }
  needs["detect-changes"].outputs = {
    frontend_changed: String(frontend),
    cms_changed: String(cms),
    e2e_changed: String(e2e),
    types_changed: String(cms),
    force: "false",
  };
  needs["verify-cms-types"].result = cms ? "success" : "skipped";
  needs["e2e-tests"] = {
    result: frontend || cms || e2e ? "success" : "skipped",
  };
  return needs;
}
test("docs-only intentional skips pass and do not deploy", () =>
  assert.equal(validate(fixture()), false));
for (const [frontend, cms, e2e] of [
  [true, false, false],
  [false, true, false],
  [true, true, false],
  [false, false, true],
]) {
  test(`required jobs pass: frontend=${frontend}, cms=${cms}, e2e=${e2e}`, () =>
    assert.equal(validate(fixture(frontend, cms, e2e)), true));
}
test("required checks cannot be skipped, failed, cancelled, or missing", () => {
  for (const state of ["skipped", "failure", "cancelled", undefined]) {
    const needs = fixture(true);
    needs["frontend-typecheck"].result = state;
    assert.throws(() => validate(needs), /frontend-typecheck/);
  }
});
test("core jobs cannot be skipped", () => {
  const needs = fixture();
  needs["detect-changes"].result = "skipped";
  assert.throws(() => validate(needs), /detect-changes/);
});
test("stale image admission blocks E2E and promotion even with successful image jobs", () => {
  const needs = fixture(true, true);
  needs["admit-images"].outputs.current = "false";
  assert.throws(() => validatePrerequisites(needs), /not admitted/);
  assert.throws(() => validate(needs), /not admitted/);
});
for (const app of ["frontend", "cms"]) {
  test(`superseded ${app} image preparation blocks E2E and promotion`, () => {
    const needs = fixture(true, true);
    needs[`${app}-build-push`] = { result: "cancelled", outputs: {} };
    assert.throws(() => validatePrerequisites(needs), /Required job/);
    assert.throws(() => validate(needs), /Required job/);
  });
}
test("unexpected failures and cancellations block the gate", () => {
  for (const result of ["failure", "cancelled"]) {
    const needs = fixture();
    needs["cms-lint"].result = result;
    assert.throws(() => validate(needs), /cms-lint/);
  }
});
test("E2E cannot be skipped when required", () => {
  const needs = fixture(false, false, true);
  needs["e2e-tests"].result = "skipped";
  assert.throws(() => validate(needs), /e2e-tests/);
});
test("missing image policy outputs fail closed", () => {
  const needs = fixture();
  delete needs["frontend-build-push"].outputs.checks;
  assert.throws(() => validate(needs), /policy outputs/);
});
test("changed or freshly built apps cannot suppress checks", () => {
  const needs = fixture();
  needs["detect-changes"].outputs.frontend_changed = "true";
  assert.throws(() => validate(needs), /required frontend checks/);
  needs["detect-changes"].outputs.frontend_changed = "false";
  needs["frontend-build-push"].outputs.built = "true";
  assert.throws(() => validate(needs), /required frontend checks/);
});

test("stale generated types block E2E prerequisites and deployment", () => {
  const needs = fixture(false, true);
  needs["verify-cms-types"].result = "failure";
  assert.throws(() => validatePrerequisites(needs), /verify-cms-types/);
  assert.throws(() => validate(needs), /verify-cms-types/);
});
test("verification cannot unexpectedly skip when type inputs changed", () => {
  const needs = fixture(false, true);
  needs["verify-cms-types"].result = "skipped";
  assert.throws(() => validatePrerequisites(needs), /verify-cms-types/);
});
test("missing or failed core prerequisites fail the existing required E2E check", () => {
  for (const job of [
    "ci-tests",
    "admit-images",
    "detect-changes",
    "version",
    "frontend-build-push",
    "cms-build-push",
  ]) {
    const needs = fixture();
    needs[job].result = "skipped";
    assert.throws(() => validatePrerequisites(needs), /Required job/);
  }
});
test("missing change flags cannot silently skip validation", () => {
  const needs = fixture();
  delete needs["detect-changes"].outputs.types_changed;
  assert.throws(() => validate(needs), /Missing change flag/);
});
