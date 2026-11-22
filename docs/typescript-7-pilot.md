# TypeScript 7 adoption and compatibility

## Current workspace setup

This follow-up extends native checking beyond the frontend. **TypeScript 6 is
still required and has not been removed from the workspace.** Node 24.22.3, Node
24 typings, pnpm 12.21.0, application behavior, and Payload schemas remain
unchanged.

| Workspace                | Checking                                                  | Compiler API / integrated build                                    |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Frontend                 | TS7.0.2 `tsc`, after React Router typegen                 | TS6.0.3 API through the existing compatibility alias               |
| CMS                      | TS7.0.2 `tsc --noEmit`, after Next typegen                | TS6.0.3 API and Next build checker through the compatibility alias |
| Payload types, rich text | Direct TS7.0.2 dependency; consumed by app and E2E checks | No compiler API consumer in either library                         |
| E2E                      | TS7.0.2 `tsc --noEmit` before Playwright in CI            | Playwright retains its existing transpilation pipeline             |

Frontend and CMS use `@typescript/native: npm:typescript@7.0.2` for the `tsc`
executable and `typescript: npm:@typescript/typescript6@6.0.2` for tooling. The
compatibility package re-exports `@typescript/old`, an alias resolving to
`typescript@6.0.3`. It provides `tsc6`, avoiding an executable collision with
native `tsc`. Next 16.4.6 reads the package named `typescript` and its bin
metadata, so its integrated check still executes TS6 even though `pnpm exec tsc`
executes TS7. This is intentional while CMS ESLint requires the old API. The
separate native CMS check is required in CI alongside the build.

CMS removes `baseUrl` and `ignoreDeprecations: "6.0"`; both path mappings
already have relative targets. Strictness, file includes, exclusions, generated
types, and existing `skipLibCheck` settings are preserved. The frontend TS6
fallback script is removed. The compatibility executable remains available to
tooling.

```sh
pnpm install --frozen-lockfile
pnpm --filter @lapuertahostels/payload-types pull-payload-types
pnpm --filter @lapuertahostels/cms generate:importmap
pnpm --filter @lapuertahostels/frontend typecheck
pnpm --filter @lapuertahostels/cms typecheck
pnpm --filter @lapuertahostels/e2e typecheck
pnpm --filter @lapuertahostels/frontend benchmark:typecheck --output /tmp/ts7-current.json
```

The live benchmark measures native TS7 only: two batches, two warm-ups and seven
measured runs per scenario, covering compiler-only, retained route output, and
regenerated route output. It retains metadata, input hashes, exit statuses, raw
samples, and failure reporting. Historical TS6 reproduction requires the runner
from PR #433 at `74c2cc7285bcc9a235ef8fcd99bfcccb1bcf98aa`; the historical
commands below describe that version, not the current runner.

## Compatibility audit and removal blockers

Installed code and npm's current stable metadata were checked on 2026-11-22. No
unsupported overrides, prerelease upgrades, reduced lint rules, excluded
sources, or error suppressions are used to advance this migration.

| Consumer                | Installed evidence and supported upgrade boundary                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint in both apps     | Frontend typescript-eslint 8.59.4 and CMS eslint-config-next 16.4.6 → typescript-eslint 8.71.1 use typescript-estree, project-service, and ts-api-utils. Latest stable typescript-eslint 8.73.0 still peers on TypeScript `>=4.8.4 <6.1.0`. Its experimental TS7.1 backend still requires a side-by-side TS6 installation. This blocks full removal even without type-aware lint configuration.                                                                                        |
| React lint integrations | @eslint-react/eslint-plugin 5.8.3 and its packages use the classic API and typescript-eslint utilities. Stable 5.30.6 still depends on typescript-eslint utilities; upgrading it does not remove the core blocker.                                                                                                                                                                                                                                                                     |
| React Router            | @react-router/dev 8.5.2 accepts TS7; installed runtime JavaScript has no import of the TypeScript compiler API. Type generation and production builds must continue to pass. A resolved TS6 peer here is not evidence of a required TS6 API.                                                                                                                                                                                                                                           |
| Storybook / docgen      | @storybook/react-vite 10.6.2 installs the 0.7.0 docgen plugin and react-docgen-typescript 2.4.0, which call `ts.sys`, `parseJsonConfigFileContent`, and `createProgram`. The current default is Babel-based `react-docgen`, so the typed backend is installed but inactive. Storybook 10.6.8 still depends on the 0.7 line. Plugin 0.9.1 adds experimental native support requiring TS7.1 prereleases; it does not make stable TS7.0 API-compatible. Preserve current docgen behavior. |
| Next.js                 | Installed/current stable 16.4.6 defaults to its CLI checker and supports TS7 directly. This workspace intentionally retains its TS6 build check because CMS ESLint still needs `typescript` to expose the old API. No Next upgrade is necessary for the new separate native gate.                                                                                                                                                                                                      |
| Payload / generation    | Installed/current stable Payload 3.94.1 generates types through json-schema-to-typescript 15.0.3, Prettier, and string postprocessing; this pipeline does not load the TypeScript compiler API. Import-map generation also has no compiler API requirement. Lexical and ts-essentials contribute TypeScript peers, which must be distinguished from runtime API imports.                                                                                                               |
| Other peers             | i18next 26.2.0 and react-i18next 17.0.8 declare `^5 \|\| ^6`. Stable major upgrades add TS7 peer support, but are unnecessary for this partial migration while the frontend API alias remains TS6. Broad peers from Valibot, Lexical, and ts-essentials alone do not establish compiler API use.                                                                                                                                                                                       |

Primary references:
[Microsoft's side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60),
[typescript-eslint native backend requirements](https://typescript-eslint.io/packages/parser/#experimental_backend),
[Next's CLI behavior](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli),
[docgen compatibility and native mode](https://github.com/joshwooding/vite-plugin-react-docgen-typescript#typescript-compatibility),
and
[react-docgen-typescript's TS7 blocker](https://github.com/styleguidist/react-docgen-typescript/issues/538).

Complete removal requires supported stable releases for all active API
consumers, compatible peers throughout the graph, and unchanged lint/docgen
behavior. Only then remove the aliases and compatibility packages, switch Next's
selected compiler, and prove that no TS6 compiler or compatibility package
remains in the complete lockfile and a clean installed graph. A TS7 version from
the frontend executable alone is insufficient evidence.

## Follow-up validation and rollback

The [follow-up raw evidence](typescript-native-workspace-results.json) records
all 156 timing invocations, CLI/API resolution, and every reachable compiler
edge after a clean install. Both lockfile documents were inspected, including
all 20 TS7 platform packages. The only compiler/API versions are TS7.0.2,
`@typescript/typescript6@6.0.2`, and its TS6.0.3 implementation. All five
workspaces resolve `tsc` to 7.0.2. Frontend/CMS tooling resolves functional
TS6.0.3 APIs; Next's bin metadata selects `tsc6` and reports 6.0.3. No package
versions were added, removed, or upgraded relative to PR #433; only direct
compiler declarations and peer snapshots changed.

Local checks passed: a clean frozen install, frontend/CMS/E2E native checking, a
non-incremental CMS check, Payload types and import map, shared-type refresh,
both apps' lint with zero warnings, frontend tests (89 in 8 files), CMS tests
(36 in 4 files), and formatting. The runner also passed failure checks for
package-manager, compiler, typegen, wrong compiler version, and missing output.
`pnpm peers check` still exits 1 for the same existing Vite peer-range
mismatches as PR #433. These are not TypeScript peer failures. Production
builds, Storybook, and browser E2E use CI; final-head results and run links are
recorded in the PR description.

Performance was measured on the same Apple M2 / 8 GiB machine with Node 24.22.3
and pnpm 12.21.0, sequentially without competing local validation commands. The
first comparison used two batches of two warm-ups plus seven measured runs per
scenario on each revision (108 invocations). Medians in seconds were:

| Batch / scenario       | Before | After |
| ---------------------- | ------ | ----- |
| 1 / compiler           | 1.200  | 8.159 |
| 1 / routes-warm        | 2.037  | 9.615 |
| 1 / routes-regenerated | 3.010  | 8.038 |
| 2 / compiler           | 3.353  | 2.503 |
| 2 / routes-warm        | 2.216  | 4.646 |
| 2 / routes-regenerated | 3.986  | 2.915 |

The apparent initial slowdown required investigation. Host load varied sharply
(observed load averages approximately 15–25 on 8 CPUs), and candidate timings
improved markedly between batches. A fresh reference worktree at merged PR #433
(`1b4df6a63`) has the same tree as the original pilot head. An alternating
control used one warm-up pair and seven measured pairs for each scenario (48
additional invocations), with matching source, config, generated Payload types,
compiler, runtime, and package-manager fingerprints:

| Scenario           | Reference median (s) | Candidate median (s) | Median paired candidate/reference |
| ------------------ | -------------------- | -------------------- | --------------------------------- |
| compiler           | 2.534                | 2.037                | 1.007×                            |
| routes-warm        | 4.805                | 4.680                | 1.083×                            |
| routes-regenerated | 3.259                | 2.783                | 0.864×                            |

All timing invocations passed. The control did not reproduce a median paired
regression above the 10% investigation threshold. The noisy ranges do not
establish a precise speed difference, and these local samples are not a Linux CI
performance claim. Original pilot measurements and raw data below remain
historical and unchanged.

Rollback this follow-up by reverting its commits, installing the restored
lockfile with `pnpm install --frozen-lockfile`, refreshing shared Payload types,
and rerunning checking. This restores PR #433's compiler setup and frontend
fallback. Do not revert the original frontend adoption to roll back only this
follow-up. No data migration is involved.

## Historical frontend adoption: PR #433

The following report and its [raw results](typescript-7-pilot-results.json) are
preserved as historical evidence. References to fallback commands and the paired
TS6/TS7 runner describe PR #433. They are superseded by the current setup above
and are not current workspace instructions.

### Adoption decision and compiler setup

The frontend adopts native TypeScript 7.0.2 for the standard `typecheck` command
and CI. This decision follows the pilot and validation recorded below. The
adopted setup keeps the TypeScript 6.0.3 JavaScript compiler API for existing
tools. CMS, shared libraries, and E2E retain their existing TS6 dependencies.
The adoption was validated with Node 24.22.3, Node 24 typings, and pnpm 12.21.0.
These versions describe the adoption baseline; see
[Workspace Setup](../CONTRIBUTING.md#workspace-setup) for current runtime
requirements.

The TS6 API dependency and fallback are intentional compatibility support.
Removing TS6 across the workspace is a separate migration. Merging the frontend
adoption PR enables this setup for the team; no additional feature flag or
production rollout step is required.

The frontend follows Microsoft's
[side-by-side migration guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60):

| Dependency           | Exact specifier                     | Purpose                       |
| -------------------- | ----------------------------------- | ----------------------------- |
| `@typescript/native` | `npm:typescript@7.0.2`              | Native `tsc` executable       |
| `typescript`         | `npm:@typescript/typescript6@6.0.2` | TS6 API and `tsc6` executable |

The compatibility package is version 6.0.2; its implementation dependency
`@typescript/old` resolves to `typescript@6.0.3` in the lockfile. Runtime
inspection confirms `version === "6.0.3"` and functional
`createProgram`/`createSourceFile` exports from the frontend,
`typescript-eslint`, its parser, React Router dev, Storybook React Vite, and
`react-docgen-typescript` package contexts.

`baseUrl` and its `ignoreDeprecations: "6.0"` suppression are removed from the
frontend config. Both existing path mappings already have relative targets, so
`~/*` and the React types override retain their resolution. Strictness, project
includes, generated route types, `skipLibCheck`, and `noEmit` are preserved.

Compared with current main, the lockfile adds only TypeScript 7, its platform
packages, and the TS6 compatibility package. pnpm also refreshes peer snapshots,
including optional peers; no existing package versions are upgraded or removed.
No global compiler override or application API change is introduced.

### Commands and fallback

```sh
pnpm --filter @lapuertahostels/payload-types pull-payload-types
pnpm --filter @lapuertahostels/frontend typecheck
pnpm --filter @lapuertahostels/frontend typecheck:ts6
pnpm --filter @lapuertahostels/frontend exec tsc --version
pnpm --filter @lapuertahostels/frontend exec tsc6 --version
pnpm --filter @lapuertahostels/frontend benchmark:typecheck --output /tmp/ts7-pilot.json
```

Both checking commands generate route types first. The existing Linux CI
typecheck job continues to invoke `typecheck`, so it checks TS7 only. The TS6
command is an explicit local fallback and parity check, not a second CI gate.
For a full rollback, revert the frontend adoption PR; selecting `typecheck:ts6`
is sufficient for an immediate local fallback.

### Correctness and tooling

Validation uses generated Payload types from the normal workspace command and
identical generated React Router inputs for both compilers. Both clean checks
exit successfully with no diagnostics. `--listFilesOnly` produces the same 170
project files after excluding dependency and standard-library files. This
comparison covers application sources, tests, stories, route output, and shared
workspace sources; it does not claim identical compiler library declarations.

A temporary `app/ts7-pilot-probe.tsx` contains these exported assignments:

```tsx
import { Heading } from "~/common/heading";
import type { Page } from "@lapuertahostels/payload-types";
import type { Route } from "./routes/+types/$";
export const invalidProps = <Heading as="not-a-heading" size="medium" />;
export const invalidPayload: Page["id"] = 42;
export const invalidRoute: Route.LoaderArgs["params"] = { "*": 42 };
```

Both compilers reject all three assignments with TS2322 at the same locations.
The only diagnostic difference is the order of `"h1"` through `"h6"` in the
printed JSX union. Sorting union members and diagnostics produces identical
results. The probe is removed before the final checks and measurements. No
errors are suppressed and no project files are excluded to obtain parity.

Local validation passes:

- Baseline TS6 checking, migrated TS6 checking, and native TS7 checking.
- Frozen-lockfile installation with the pinned package manager.
- ESLint with `--max-warnings=0` and frontend Prettier check.
- Vitest in run mode: 8 files, 89 tests.
- Frontend production build and Storybook production build.

Installation reports Vite peer-range warnings from existing tooling; the
declared versions and overrides for those tools are unchanged. Production and
Storybook builds retain bundle-size warnings. These are not compiler failures.

### Benchmark protocol

Measurements were taken on 2026-11-22 from baseline commit
`e053b86e76ee62a480f4617be1e3fecce9640d6b`, in a separate worktree. Hardware is
an Apple M2 with 8 logical CPUs and 8 GiB RAM, running Darwin 27.2.0 arm64. Both
setups use Node 24.22.3 and pnpm 12.21.0. Native compiler concurrency is left at
its default.

The baseline is measured before changing dependencies or compiler options. The
pilot compares `tsc6` with `tsc` against the same migrated config, source, and
Payload types. Every scenario has two batches, each with two warm-up pairs and
seven measured pairs. The baseline has one compiler per pair. Compiler order
alternates in the pilot, and all commands run sequentially without competing
local checks.

| Scenario           | Timed command                                    | Route output before each sample       |
| ------------------ | ------------------------------------------------ | ------------------------------------- |
| Compiler           | `pnpm exec tsc` or `pnpm exec tsc6`              | Already generated                     |
| Routes warm        | `pnpm run typecheck` or `pnpm run typecheck:ts6` | Retained                              |
| Routes regenerated | Same complete checking command                   | `.react-router` deleted before timing |

Times include process and pnpm startup. Complete commands include route
generation. Installation, Payload generation, and deletion of route output are
excluded. No incremental compilation is enabled. OS filesystem caches are
uncontrolled; regenerated-route runs are not described as cold-cache runs.

The benchmark command writes metadata, compiler versions, raw samples, exit
statuses, and a failure record if a command fails, including during metadata
collection. To reproduce the original baseline, copy
`apps/frontend/scripts/benchmark-typecheck.mjs` into the same location in a
clean worktree at the baseline commit, install its frozen lockfile, generate
Payload types, and run:

```sh
node apps/frontend/scripts/benchmark-typecheck.mjs --baseline --output /tmp/ts6-baseline.json
```

The pilot command shown above measures both compilers. Run the two worktrees
sequentially with the same runtime, package manager, and generated Payload
types. The report records config, lockfile, and Payload type hashes so the
inputs can be checked.

### Results and adoption decision

All 162 baseline and pilot invocations, including warm-ups, exit successfully.
The [raw results](typescript-7-pilot-results.json) include machine metadata,
input hashes, every sample, API-resolution evidence, project inventory, and the
raw and normalized probe diagnostics.

Times below are median seconds, with minimum–maximum in parentheses. Each cell
contains seven measured runs; warm-ups are excluded.

| Batch / scenario       | Original TS6        | Pilot TS6           | Pilot TS7           | Paired speedup | Seconds saved |
| ---------------------- | ------------------- | ------------------- | ------------------- | -------------- | ------------- |
| 1 / compiler           | 4.092 (3.986–4.203) | 4.742 (4.477–5.998) | 1.527 (1.287–2.124) | 3.11×          | 3.215         |
| 1 / routes-warm        | 4.513 (4.484–4.612) | 5.846 (5.072–7.514) | 2.034 (1.689–2.605) | 2.87×          | 3.812         |
| 1 / routes-regenerated | 4.522 (4.465–5.438) | 5.710 (4.802–6.090) | 1.930 (1.763–3.241) | 2.96×          | 3.780         |
| 2 / compiler           | 3.965 (3.913–4.087) | 3.974 (3.902–4.058) | 1.184 (1.121–1.408) | 3.36×          | 2.791         |
| 2 / routes-warm        | 4.462 (4.424–4.586) | 5.784 (4.634–6.576) | 1.878 (1.767–2.382) | 3.08×          | 3.906         |
| 2 / routes-regenerated | 4.489 (4.439–4.533) | 6.584 (6.118–9.063) | 2.610 (2.030–3.943) | 2.52×          | 3.975         |

**Decision: adopt native TypeScript 7 for frontend type checking.** Both batches
show faster compiler-only and complete-command checks. Every measured TS7 run is
faster than its paired TS6 run; the full-command ranges within each batch do not
overlap. Correctness and tooling checks pass without reducing coverage.

The original baseline is measured separately, so it is a reference rather than
an interleaved comparison. Pilot TS6 timings vary more than the original
baseline; system load, thermal state, and filesystem caches are uncontrolled.
Use the paired pilot measurements as the primary comparison, and keep the
absolute savings against original main visible. These are local measurements on
one 8 GiB machine, not a Linux CI speed claim or proof of parity for every
TypeScript program.

The PR retains the existing Linux checks, including TS7 type checking, frontend
lint/tests/builds, CMS checks, and browser E2E coverage. Their final results and
run link are recorded in the PR description. Local browser E2E is not repeated
for this compiler-only change; the existing CI suite provides that coverage.
Keep the TS6 API dependency and fallback until its tooling consumers support a
later API. Revert the PR if a compiler or tooling regression is found.

### Self-review integration

Self-review integrated main at `905f7a8bc` (the upstream Vitest 5 upgrade) to
resolve a lockfile conflict. The original two-batch results above predate that
integration and retain their original source and lockfile fingerprints. No
measurement has been relabeled as a run on the newer dependency graph.

After regenerating the lockfile from main, frozen installation, both frontend
compiler commands, and all 89 frontend tests pass with Vitest 5. Existing main
package metadata and non-frontend compiler dependencies are preserved; only the
expected 22 TypeScript package entries are added relative to main.

A targeted follow-up used one warm-up pair and three alternating measured pairs
of the complete checking commands, sequentially on the same machine. TS7's
median was 4.749s (range 2.128–5.263s); TS6's median was 8.278s (range
6.941–10.413s), a 1.74× median speedup. All eight invocations passed and TS7 was
faster in every measured pair. This is a small regression check after the merge,
not a replacement for the original protocol or a timing comparison against
unchanged Vitest 5 main. The raw follow-up samples are in `selfReviewVitest5` in
the results JSON; the same system-load and cache limitations apply.

The benchmark runner also now records JSON failure reports when preflight
metadata commands fail. Targeted checks cover package-manager version failure,
compiler version failure, type-generation failure, and the required output
argument. The timed sampling loop is unchanged. Final-revision CI results are
recorded separately in the PR description.
