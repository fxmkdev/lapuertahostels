# pnpm 12 upgrade verification

Verified on 2026-11-21 and 2026-11-22 from `origin/main` commit `d51e6dbc6`,
comparing pnpm 11.1.2 with stable pnpm 12.21.0 on Node 24.22.3. No application
dependency, override, patch, build approval, or Node runtime policy was changed.

## Migration details

- All four `packageManager` fields pin pnpm 12.21.0 with the same SHA-512
  digest, independently checked against the downloaded npm tarball and registry
  integrity.
- The first pnpm 12 frozen install rejected the old lockfile because its package
  manager dependency metadata was missing.
  `pnpm install --lockfile-only --no-frozen-lockfile` added a separate v9 YAML
  document recording pnpm and its platform binaries. The existing application
  lockfile document is byte-for-byte unchanged. Repeat lockfile-only and frozen
  installs leave the migrated file unchanged. Preserve pnpm's generated lockfile
  formatting.
- Docker installs the native executable using the root manifest's exact version.
  `--allow-scripts=pnpm` permits pnpm's binary setup with Node 24's bundled npm;
  it does not change workspace dependency build approvals.
- Frontend production pruning needs `allowUnusedPatches=true` for that command:
  the CMS-only Payload patch has no consumer in the pruned frontend subset.
  Ordinary installs still reject unused or changed patches.
- Final images set `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`. Dependencies are
  fixed during the build; runtime pnpm commands must not attempt to reinstall
  against the absent BuildKit cache store. This setting is limited to final
  image stages and does not disable build or CI install checks.
- CI retains `pnpm/action-setup@v6` and `actions/setup-node@v6`, asserts the
  manifest version, explicitly freezes installs, and reads Playwright's version
  from JSON rather than human-readable output.

## Install timings

Measured sequentially on the same macOS 27.2 arm64 machine using isolated stores
and identical application manifests and dependency graph. Each version uses its
own exact package-manager pin and corresponding lockfile metadata. pnpm
bootstrap and removal of old `node_modules` directories are outside the timed
interval.

| Scenario                                      | pnpm 11.1.2 | pnpm 12.21.0 |       Change |
| --------------------------------------------- | ----------: | -----------: | -----------: |
| Empty store, one install                      |    15.669 s |     13.066 s | 16.6% faster |
| Clean `node_modules`, warm store, median of 3 |     7.197 s |      3.198 s | 55.6% faster |
| Unchanged reinstall, median of 5              |     0.243 s |      0.052 s | 78.6% faster |

Individual warm-store times: 11.1.2 = **7.197, 6.838, 11.537 s**; 12.21.0 =
**3.488, 3.060, 3.198 s**. Individual unchanged times: 11.1.2 = **0.428, 0.229,
0.243, 0.238, 0.251 s**; 12.21.0 = **0.059, 0.049, 0.052, 0.051, 0.052 s**.

Command, with a separate initially empty store per version:

```bash
CI=true pnpm --config.store-dir=<isolated-store> install --frozen-lockfile
```

Every timed successful install preserved the lockfile. These are local
measurements, not estimates of GitHub-hosted runner performance. Cold downloads
include registry/network variance; the warm-store measurements provide the
stronger comparison. No measured install scenario regressed.

## Verification results

| Area                 | Result                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen installs      | Full workspace, frontend/CMS/E2E/root CI filters, repeated and offline installs passed. Changed application manifest, override, and patch content were rejected.                                                                                           |
| Dependency graph     | Identical 1,175 package directories in the virtual store, including peer variants; application lockfile document, all overrides, and both patch files unchanged.                                                                                           |
| Workspace injection  | Existing deduplicated links to `payload-types` and `rich-text` resolve identically for frontend and E2E under both versions. Separate fixtures with injection forced and deduplication disabled passed resolution and frozen installs under both versions. |
| Generated types      | CMS type/import-map generation passed without tracked artifact changes. Generated Payload types reached frontend and E2E; a clean artifact-before-install fixture matched CI order.                                                                        |
| Patches              | Both installed patches verified. Route discovery passed ordinary files, hidden-file exclusion, ignored files/folders, and retained folders. Browser global setup passed trusted CMS initialization and denied anonymous locale reads.                      |
| Frontend             | Typecheck, lint with zero warnings, formatting, 89 tests, production build, and Storybook build passed.                                                                                                                                                    |
| CMS                  | Lint with zero warnings, formatting, 35 tests, and production build passed.                                                                                                                                                                                |
| Local production E2E | Both pnpm 11.1.2 and pnpm 12.21.0 production builds passed all 13 existing tests without retries, with unchanged configuration/timeouts, one worker, and disposable MongoDB 8.0.38, Redis 8.4.8, and S3-compatible storage.                                |
| Docker E2E           | Suite exited successfully: 12 tests passed directly and one light/mobile link-drawer case passed on retry. Its initial click was intercepted by sticky document controls; test source, timeouts, and retry configuration were unchanged.                   |
| Dependency audits    | Full and production audits both returned zero advisories.                                                                                                                                                                                                  |
| CI compatibility     | Actionlint 1.7.12 passed; version assertion, Playwright JSON version extraction, filtered frozen installs, and read-only release-version command passed locally.                                                                                           |
| Docker               | Both final linux/amd64 images and cached rebuilds passed. Native pnpm worked offline without reinstall attempts; frontend dev tools were absent; Payload CLI info ran as uid 1001.                                                                         |

`pnpm peers check` reports the same existing Vite 6.4.5 expectations against
installed Vite 8.1.6 on the unchanged pnpm 11 baseline and pnpm 12. No peer
suppression or dependency changes were added.

The mobile click interception was observed only in the Docker run, not in either
local production suite. A pnpm 11 Docker browser comparison was not run, so this
report does not claim that the Docker flake predates the migration. The suite
exited successfully with its existing retry policy; no UI fix or test relaxation
is included.

The initial frontend typecheck ran before generating ignored CMS types; it
passed after generation in CI order. Chromium initially could not launch under
the macOS sandbox; the unchanged suite passed after granting the required
process access. These were verification setup issues.

A real GitHub Actions run was not dispatched. Publishing, deployment, and
production resources were not used.

## Docker timings and runtime checks

Both Debian/glibc frontend and Alpine/musl CMS final images built successfully.
Images target `linux/amd64` on arm64 Docker Desktop 27.4.0 (4 GB VM memory, 8
reported CPUs), using Node 24.22.3. These are diagnostic observations from
migration verification, separate from the controlled pnpm install comparison.

| Image    | First clean-builder build | Fully cached final build |
| -------- | ------------------------: | -----------------------: |
| Frontend |                 135.202 s |                 11.614 s |
| CMS      |                1370.797 s |                 62.356 s |

Builds overlapped and experienced substantial image-export contention. The CMS
clean build spent **868.4 s exporting**, including **547.5 s preparing layers**
and **320.8 s sending/loading the image**. A duplicate export was canceled;
final builds and cached rebuilds subsequently passed. The frontend clean-build
observation preceded the final runtime-only environment adjustment, which was
rebuilt and verified afterward. These timings cannot establish a pnpm
11-versus-12 Docker performance difference; no baseline Docker timing is
claimed.

Run each command twice with a separate initially empty builder per app:

```bash
docker buildx create --name <isolated-builder> --driver docker-container
docker buildx build --builder <isolated-builder> --load --platform linux/amd64 \
  --build-arg APP_VERSION=0.0.0-pnpm12 \
  -f apps/<app>/Dockerfile -t lapuerta-pnpm12-<app>:verify .
```

Final-image checks used `docker run --network none` to verify native ELF pnpm
12.21.0, Node 24.22.3, and no dependency reinstall attempts. The frontend
retained `react-router-serve` and removed Vite, Vitest, and TypeScript. The CMS
ran `pnpm --dir apps/cms payload info` as uid 1001. The tested images are
retained locally as `lapuerta-pnpm12-frontend:tested` and
`lapuerta-pnpm12-cms:tested`; their immutable IDs are in the evidence directory.
Container HTTP checks rejected anonymous locale reads and global updates
with 403.

The first Docker browser attempt ran before HTTP readiness. The subsequent
harness also needed its direct MongoDB fixture connection aligned with the
container database; no application or test-source changes were needed. The retry
uses HTTP readiness and the same database for API calls and direct seeds.

## Evidence

Raw benchmark samples, command output, diagnostic attempts, and verification
logs are retained locally in `/private/tmp/lapuerta-pnpm12-results/`. Benchmark
and verification scripts are in `/private/tmp/lapuerta-pnpm12-tools/`. Key
files: `benchmark.json`, `checks.jsonl`,
`dependency-graph-injection-patches.log`,
`frozen-reject-{manifest,override,patch}.log`, `route-patch-regression.log`,
`final-verification.json`, `playwright-e2e-baseline.log`,
`playwright-e2e-local-unsandboxed.log`, `playwright-e2e-docker.log`,
`docker-tested-images.json`, and the Docker build/runtime logs.

Installation and compatibility references:
[pnpm installation](https://pnpm.io/installation),
[pnpm 12.21.0 release notes](https://pnpm.io/blog/releases/12.21.0), and
[pnpm/action-setup](https://github.com/pnpm/action-setup).
