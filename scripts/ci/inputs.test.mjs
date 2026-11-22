import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { baseline, detect, snapshot } from "./inputs.mjs";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "ci-inputs-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const put = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  git("init", "-q");
  git("config", "user.email", "ci@example.test");
  git("config", "user.name", "CI tests");
  const packages = {
    "apps/frontend": {
      name: "@lapuertahostels/frontend",
      dependencies: {
        "@lapuertahostels/payload-types": "workspace:*",
        "@lapuertahostels/rich-text": "workspace:*",
      },
    },
    "apps/cms": { name: "@lapuertahostels/cms" },
    "libs/payload-types": { name: "@lapuertahostels/payload-types" },
    "libs/rich-text": {
      name: "@lapuertahostels/rich-text",
      dependencies: { "@lapuertahostels/nested": "workspace:*" },
    },
    "libs/nested": {
      name: "@lapuertahostels/nested",
      dependencies: { "@lapuertahostels/rich-text": "workspace:*" },
    },
    "tests/e2e": {
      name: "@lapuertahostels/e2e",
      devDependencies: {
        "@lapuertahostels/payload-types": "workspace:*",
        "@lapuertahostels/rich-text": "workspace:*",
      },
    },
  };
  for (const [dir, pkg] of Object.entries(packages)) {
    put(`${dir}/package.json`, JSON.stringify(pkg));
    put(`${dir}/src/index.ts`, "original");
  }
  put("apps/cms/src/payload-types.ts", "original types");
  put("libs/payload-types/src/payload-types.ts", "original types");
  put("package.json", "{}");
  put("pnpm-lock.yaml", "original");
  const commit = () => {
    git("add", ".");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  return { cwd, git, put, commit, base: commit() };
}
const cases = [
  ["apps/frontend/app/routes/($locale).tsx", true, false, false],
  ["apps/cms/src/schema.ts", false, true, false],
  ["libs/payload-types/src/index.ts", true, false, true],
  ["libs/rich-text/src/index.ts", true, false, true],
  ["libs/nested/src/index.ts", true, false, true],
  ["package.json", true, true, true],
  ["pnpm-lock.yaml", true, true, true],
  ["pnpm-workspace.yaml", true, true, true],
  [".npmrc", true, true, true],
  ["patches/payload.patch", true, true, true],
  [".dockerignore", true, true, true],
  ["apps/frontend/Dockerfile", true, false, false],
  ["apps/cms/Dockerfile.dockerignore", false, true, false],
  [".github/workflows/build.yml", true, true, true],
  [".github/actions/setup/action.yml", true, true, true],
  ["scripts/ci/inputs.mjs", true, true, true],
  ["tests/e2e/tests/basic.spec.ts", false, false, true],
  ["README.md", false, false, false],
  ["docs/ci.md", false, false, false],
];
for (const [path, frontend, cms, e2e] of cases)
  test(`detect ${path}`, (t) => {
    const f = fixture(t);
    f.put(path, path === "package.json" ? '{"changed":true}' : "changed");
    f.commit();
    const plan = detect(f.cwd, f.base);
    assert.deepEqual(
      [plan.frontend_changed, plan.cms_changed, plan.e2e_changed],
      [frontend, cms, e2e],
    );
  });
test("CMS implementation changes verify types without invalidating frontend", (t) => {
  const f = fixture(t);
  f.put("apps/cms/src/index.ts", "implementation change");
  f.commit();
  const plan = detect(f.cwd, f.base);
  assert.equal(plan.cms_changed, true);
  assert.equal(plan.types_changed, true);
  assert.equal(plan.frontend_changed, false);
});
test("committed CMS type changes invalidate frontend and E2E", (t) => {
  const f = fixture(t);
  f.put("apps/cms/src/payload-types.ts", "new types");
  f.put("libs/payload-types/src/payload-types.ts", "new types");
  f.commit();
  const plan = detect(f.cwd, f.base);
  assert.equal(plan.cms_changed, true);
  assert.equal(plan.types_changed, true);
  assert.equal(plan.frontend_changed, true);
  assert.equal(plan.e2e_changed, true);
});
test("unchanged committed types need no generation or baseline cache", (t) => {
  const f = fixture(t);
  const result = detect(f.cwd, f.base);
  assert.equal(result.frontend_changed, false);
  assert.equal(result.cms_changed, false);
  assert.equal(result.types_changed, false);
});
test("missing and invalid baselines validate both apps", (t) => {
  const f = fixture(t);
  for (const base of [null, "unavailable"]) {
    const plan = detect(f.cwd, base);
    assert.equal(plan.frontend_changed, true);
    assert.equal(plan.cms_changed, true);
  }
});
test("manual and release forcing validates both apps without changing content keys", (t) => {
  const f = fixture(t);
  const normal = detect(f.cwd, f.base);
  const forced = detect(f.cwd, f.base, true);
  assert.equal(forced.frontend_changed, true);
  assert.equal(forced.cms_changed, true);
  assert.equal(forced.e2e_changed, true);
  assert.equal(normal.frontend_key, forced.frontend_key);
});
test("deletions and renames invalidate dependants", (t) => {
  const f = fixture(t);
  rmSync(join(f.cwd, "libs/nested/src/index.ts"));
  f.commit();
  assert.equal(detect(f.cwd, f.base).frontend_changed, true);
  renameSync(
    join(f.cwd, "apps/cms/src/index.ts"),
    join(f.cwd, "apps/cms/src/renamed.ts"),
  );
  f.commit();
  assert.equal(detect(f.cwd, f.base).cms_changed, true);
});
test("workspace dependency graph changes invalidate an app", (t) => {
  const f = fixture(t);
  f.put(
    "apps/cms/package.json",
    JSON.stringify({
      name: "@lapuertahostels/cms",
      dependencies: { "@lapuertahostels/nested": "workspace:*" },
    }),
  );
  f.commit();
  // A subsequent shared-package edit must now affect CMS too.
  const previous = f.git("rev-parse", "HEAD");
  f.put("libs/nested/src/index.ts", "new");
  f.commit();
  assert.equal(detect(f.cwd, previous).cms_changed, true);
});
test("PR baseline uses merge base and push uses the full before revision", (t) => {
  const f = fixture(t);
  f.git("checkout", "-qb", "feature");
  f.put("README.md", "branch");
  f.commit();
  const feature = f.git("rev-parse", "HEAD");
  f.git("checkout", "-qb", "target", f.base);
  f.put("docs/new.md", "target");
  const target = f.commit();
  f.git("checkout", "-q", "feature");
  assert.equal(
    baseline(f.cwd, "pull_request", {
      pull_request: { base: { sha: target } },
    }),
    f.base,
  );
  assert.equal(baseline(f.cwd, "push", { before: feature }), feature);
  assert.equal(baseline(f.cwd, "push", { before: "0".repeat(40) }), null);
  assert.equal(baseline(f.cwd, "push", { before: "missing" }), null);
  assert.equal(baseline(f.cwd, "workflow_dispatch", {}), null);
});
test("untracked generated files do not perturb input fingerprints", (t) => {
  const f = fixture(t);
  const before = snapshot(f.cwd, "HEAD");
  f.put("libs/payload-types/src/payload-types.ts", "generated");
  assert.deepEqual(snapshot(f.cwd, "HEAD"), before);
});

test("type-generation wrapper changes require verification without rebuilding CMS", (t) => {
  const f = fixture(t);
  const before = snapshot(f.cwd, "HEAD");
  f.put(
    "libs/payload-types/package.json",
    JSON.stringify({
      name: "@lapuertahostels/payload-types",
      scripts: { "pull-payload-types": "new generator arguments" },
    }),
  );
  f.commit();
  const after = snapshot(f.cwd, "HEAD");
  assert.notEqual(before.types, after.types);
  assert.equal(before.cms, after.cms);
  assert.equal(detect(f.cwd, f.base).frontend_changed, true);
});
