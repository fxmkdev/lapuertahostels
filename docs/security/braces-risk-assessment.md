# Braces Advisory Risk Assessment

## Decision

Assessed on 2026-10-09 for
[PR #410](https://github.com/fxmkdev/lapuertahostels/pull/410), using the
dependency graph and application code at commit `e07d1a3`.

The practical risk of this advisory to the current application is assessed as
low: no path from public requests, CMS content, or uploads to the vulnerable
brace-processing operations was identified. The repository owner accepted this
assessment on 2026-10-09 and authorized treating it as non-blocking for this PR.

This is an application-specific reachability assessment, not a claim that the
library is fixed or that every possible denial-of-service issue is ruled out.
The advisory remains visible; no audit suppression, alert dismissal, dependency
change, or custom security patch was introduced for this decision.

## Advisory and Installed Version

- [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  concerns stack exhaustion from deeply nested, attacker-controlled brace
  patterns passed to recursive AST walkers.
- The installed version is `braces@3.0.3`. Both full and production dependency
  audits report this high-severity advisory.
- As of the assessment date, npm's latest release is `3.0.3`. The npm audit
  response advertises a patched range of `>=3.0.4`, but `3.0.4` is not
  available; the GitHub advisory lists no patched release.
- The [upstream discussion](https://github.com/micromatch/braces/issues/70)
  disputes aspects of the advisory. This assessment does not rely on that
  dispute to dismiss the risk.

## Dependency Paths and Reachability

### Sass File Watching

Payload and Next.js bring in `sass@1.77.4`, which depends on `chokidar@3.6.0`
and therefore `braces@3.0.3`.

The installed Sass implementation's `watchDir` calls Chokidar with
`disableGlobbing: true`. Chokidar consequently sets `hasGlob` to false and
returns from `getDirParts` before its `braces.expand` call. This path is
stylesheet build/watch tooling, not a parser for incoming HTTP or CMS data.

### Payload Cloud Storage

`@payloadcms/plugin-cloud-storage@3.90.2` declares `find-node-modules@2.1.3`,
which depends on `findup-sync@4.0.0`, then `micromatch@4.0.8`, then `braces`.

No import of `find-node-modules` was found in the cloud-storage plugin's shipped
JavaScript or TypeScript files. The dependency appears unused in this version.
Additionally, `find-node-modules` defaults to the literal search string
`node_modules`, which takes the non-glob branch in `findup-sync`. Even the glob
branch calls `micromatch.matcher`, which delegates to Picomatch rather than the
`braces.compile` or `braces.expand` operations covered by this advisory.

### ESLint Configuration

The CMS's Next.js ESLint plugin uses `fast-glob`, whose pattern expansion can
call `micromatch.braces` with `expand: true`. Its inputs come from trusted
repository ESLint configuration (`settings.next.rootDir`), not public requests,
CMS content, or uploads. This is development/lint tooling.

## Evidence and Limitations

The investigation included `pnpm why braces --recursive`, full and production
audits, direct application-source searches, and inspection of the installed
consumers and production build output. No direct application calls or relevant
library names/files were found in the inspected frontend server bundle or CMS
server/standalone traced output.

The CMS Docker runner copies the full build tree, including installed
dependencies. The absence of these libraries from traced request-handling output
does **not** mean the package is absent from the image. Similarly, a production
audit classification alone does not establish an exploitable path.

Bounded compile/expand tests of deeply nested patterns on Node 24 did not
reproduce the reported stack overflow. That result does not disprove the
advisory on other runtimes, stack sizes, or patterns. The risk decision rests on
the lack of attacker-controlled glob reachability, not on these tests.

## Maintenance and Reassessment

Reassess this decision when:

- A feature accepts user-controlled glob or brace patterns.
- CMS content, upload names, or request parameters are passed to file-discovery
  or watcher APIs.
- Sass, Chokidar, the cloud-storage plugin, or ESLint consumers change their
  input handling or dependency paths.
- The advisory changes or a maintained fix becomes available.

Optional dependency hygiene is to test a compatible Sass upgrade using Chokidar
4/5 and pursue removal of the cloud-storage plugin's unused dependency. These
changes could reduce dependency paths, but would need frozen-install, build, and
E2E verification; the lint-tooling path may still remain.

A custom depth-guard patch would require its own compatibility and security
tests and would not automatically clear version-based audit warnings. It is not
required for the accepted current-app assessment.
