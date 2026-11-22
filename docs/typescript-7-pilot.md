# TypeScript 7 frontend adoption

## Adoption decision and compiler setup

The frontend adopts native TypeScript 7.0.2 for the standard `typecheck` command
and CI. This decision follows the pilot and validation recorded below. The
adopted setup keeps the TypeScript 6.0.3 JavaScript compiler API for existing
tools. CMS, shared libraries, and E2E retain their existing TS6 dependencies.
Node 24.22.3, Node 24 typings, and pnpm 12.21.0 are unchanged.

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

## Commands and fallback

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

## Correctness and tooling

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

## Benchmark protocol

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

## Results and adoption decision

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

## Self-review integration

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
