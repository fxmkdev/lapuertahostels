# Selective CI and image reuse

The Build workflow tracks frontend, CMS, and E2E inputs separately. Pull
requests compare against their merge base; pushes compare against the event's
`before` commit. Missing baselines and manual Build runs validate both apps
conservatively.

Each app includes its own directory and transitive workspace dependencies. The
frontend consumes `libs/payload-types`, `libs/rich-text`, and
`libs/live-preview`; the CMS also consumes `libs/live-preview`. Root package
manifests, lockfile, pnpm workspace configuration, `.npmrc`, patches, shared
formatting/Docker configuration, CI helpers, and Actions configuration affect
both apps. Changes inside an app's directory are conservatively considered app
changes, including its documentation. Root `README.md` and `docs/` changes do
not affect either app.

## Generated CMS types

Both generated Payload type files are committed. Frontend fingerprints include
`libs/payload-types/src/payload-types.ts` through its workspace dependency, so
CMS implementation changes with identical shared types do not invalidate
frontend. Schema changes that change the committed shared types invalidate
frontend and E2E.

The existing `Build / CMS: Verify Generated Types` job runs whenever CMS/type
inputs change or validation is forced. It regenerates both files and fails if
they differ from the committed versions. Missing baselines conservatively
require verification. No generated-type cache or artifact distribution is
needed.

## Images and versions

Each staging Fly registry repository stores successfully validated images under
`ci-v2-<content fingerprint>` tags. The fingerprint includes tracked input
paths, contents, file modes, and a cache schema version. It excludes the run's
injected `APP_VERSION`, allowing ordinary runs to reuse a prior build.

The two image-preparation jobs always resolve an image. A cache hit is pinned to
its digest and copied to the usual `v<version_with_sha>` tag without rebuilding.
A missing image triggers a build plus the app's checks and E2E, even when the
source comparison marked it unchanged. Authentication errors fail immediately;
transient registry errors receive bounded retries and persistent errors fail.
Builds use unique run/attempt tags before publishing the per-version alias.

An image is promoted to the fingerprint cache only after the final result gate
has verified all required checks and E2E. A failed build or validation cannot
seed the reuse cache. Per-version tags are published during image preparation,
as before; automatic deployment waits for validation. Manual deployment should
select a successful Build revision.

Reusing an image preserves its original embedded application version and image
labels. Frontend and CMS can therefore report different build versions during
ordinary development. Requested/new releases rebuild and validate both images
with the new release version. Manual Build also exposes `force_rebuild` (default
`false`) to refresh images, for example after an upstream base-image update.
Content fingerprints do not independently track mutable upstream Docker tags.

## Builder isolation and concurrency

Image preparation uses the reusable Prepare Image workflow. Fly builds select
`--depot-scope app` against the existing staging app, so frontend and CMS have
separate builders and persistent layer caches. Builder sizing is unchanged. The
first build for each app may be slower while its new builder cache warms;
validated registry images remain reusable without contacting a builder.

Each staging app has one image-preparation job running at a time across all PRs,
main pushes, and manual runs. Other jobs wait in a `queue: max` concurrency
group, covering registry inspection, building, and version-alias publication.
Frontend and CMS can prepare images concurrently on their separate builders.

The caller also has a separate cancellation group for each app and PR. Once a
new revision reaches image preparation, it cancels that PR's previous active or
pending image job for the same app. Other PRs are unaffected; main pushes and
manual runs have unique request groups and are not superseded. Cancellation does
not cover checks or deployments already underway. The existing preview lifecycle
lock continues to protect provisioning, deployment, and cleanup.

After prerequisites finish, an admission job checks the PR's current head with
GitHub before image requests can enter those cancellation groups. This rejects
known stale runs whose prerequisites finished after a newer revision's, and
rejects closed PRs. API errors fail closed. Main pushes and manual releases are
admitted without a PR lookup. The result gate also requires successful
admission, so rejected requests cannot promote images or deploy.

The caller's request group and callee's builder group must remain distinct:
reusing a group would make the nested workflow contend with or cancel itself. A
canceled image job fails the result gate and cannot promote an image into the
validated reuse cache or start deployment.

Cancellation may leave a unique `ci-build-<run>-<attempt>` image tag in the
registry. These unvalidated tags are not fingerprint-cache entries and are never
selected for reuse by another run.

The image step replaces its shell with the Node helper, which forwards `SIGINT`
and `SIGTERM` to Fly and waits for it to exit. This gives Fly an opportunity to
cancel its remote build session before the runner forcibly cleans up orphan
processes. A signal received during a Fly build fails image preparation even if
the CLI exits successfully, preventing subsequent alias publication. If Fly
ignores cancellation or the one-hour build deadline, the helper forces
termination after a five-second grace period so its app's queue can advance.

## Checks and deployments

Lint, formatting, typechecks, unit tests, and frontend Chromatic run only for
changed apps or required rebuilds. E2E runs for either affected app or changes
to E2E inputs. E2E and automatic deployments both use the immutable digests
selected by the image-preparation jobs, so concurrent tag updates cannot change
the tested/deployed image pair. The reusable deployment workflow accepts
optional `frontend_image` and `cms_image` inputs; manual Deploy keeps its
version-tag fallback and existing interface.

Docs-only changes with warm caches publish per-version image aliases but skip
app checks, E2E, previews, staging deployment, and preview cleanup. Those
aliases keep the existing manual Deploy interface usable from the docs-only
revision. Cold or evicted image caches require app builds/validation.

Image-preparation job IDs and outputs remain stable; their check names now
include the reusable workflow's `Prepare image` job. `Build / Result` retains
its existing name, always runs, and rejects failed/cancelled dependencies and
unexpectedly skipped required checks. Configure it as a required
branch-protection check so failures in prerequisite jobs cannot be hidden by
downstream skips. Staging and preview deployments depend on this gate; Build
runs preview cleanup after a successful preview deployment. The E2E prerequisite
guard also explicitly fails when prerequisite jobs fail or unexpectedly skip,
while permitting intentional CMS-verification skips.

The image-preparation job summaries record changes, build/reuse decisions,
required checks, tags, and resolved digests. To invalidate reuse after changing
the fingerprint algorithm, increment the schema identifiers in the helpers
together.

## Preview cleanup

The Clean Preview workflow runs when a PR closes (including a merge), daily at
02:00 UTC, and on manual dispatch. Build also calls the same reusable cleanup
workflow after a successful preview deployment. Cleanup and preview deployment
share the `fly-preview-lifecycle` concurrency group, so cleanup holds the lock
before listing apps through the final deletion.

Cleanup only considers app names beginning with the configured frontend or CMS
preview prefix followed by `-`. It preserves the existing retention rules:
delete apps with no release timestamp, apps last released more than four days
ago, and apps outside the six most recent releases across frontend and CMS
combined. The count is computed before applying the other deletion rules, with
missing timestamps sorted first, as in the original cleanup.

For remaining apps, cleanup reads GitHub deployments in `preview-frontend` and
`preview-cms`, matching exact HTTPS Fly app origins from deployment status URLs.
It uses the deployment's source branch to find all matching PRs from this
repository. If every matching PR is closed, the app is deleted and its PR
numbers are logged. This supports existing SHA-based app names and multiple
previews for a PR without a migration. Any open or reopened PR on a reused
branch keeps the app from PR-based deletion. Missing or conflicting source
branches, missing PRs, and overlapping prefix configurations also skip PR-based
deletion. Existing age/count rules still apply to these apps.

Deployment and PR lists are paginated. Deployment statuses are fetched in
GraphQL batches of 50 deployments, with REST pagination for histories exceeding
100 statuses, so scanning deployment history does not require one request per
deployment. Partial or mismatched batch responses skip PR-based deletion. A
GitHub lookup failure logs a warning and skips PR-based deletion for the
affected environment or branch; retention cleanup continues. Fly discovery and
deletion failures fail the job. Each app is deleted at most once, with its
deletion reasons logged. Shared databases and media are not deleted.

The close trigger uses `pull_request_target` restricted to `closed`. Every
cleanup caller pins the reusable workflow to this repository's `main`, and the
workflow explicitly checks out `main` with persisted credentials disabled. This
keeps the workflow and its helper in sync before merge; PR builds use the
currently deployed cleanup until the new helper lands. Cleanup never checks out
the PR's branch. Cleanup and its callers grant only `contents: read`,
`pull-requests: read`, and `deployments: read`. Authentication uses the existing
`GITHUB_TOKEN` and `FLY_API_TOKEN`; no new secrets are needed.

## Local verification

```bash
node --test scripts/ci/*.test.mjs
pnpm exec prettier --check scripts/ci .github/workflows/{build,prepare-image,clean-preview,clean-preview-reusable}.yml docs/ci-build-reuse.md
# Install actionlint separately, then:
actionlint -ignore 'unexpected key "queue" for "concurrency" section' .github/workflows/{build,prepare-image,clean-preview,clean-preview-reusable}.yml
```

Actionlint 1.7.12 does not yet recognize GitHub's `queue` property. The narrow
exception above covers that property only. Explicitly queued groups use `max`
with `cancel-in-progress: false`, as required by GitHub. Remove the exception
when actionlint supports the property.

The tests use isolated Git fixtures, simulated registries, and mocked GitHub/Fly
responses; they do not need credentials. Full workflow validation additionally
requires a GitHub Actions run with the existing Fly, Chromatic, and E2E secrets.

For live concurrency verification, overlap revisions of the same PR and image
jobs from different PRs. Confirm superseded image jobs are canceled, jobs for
the same staging app do not overlap, and frontend/CMS jobs can overlap. An
active deployment must finish independently of newer image requests. Main and
release image jobs must queue rather than cancel one another.

Compare the initial cold build with subsequent warm-cache builds. Record queue
time separately from builder startup, CMS compilation, runtime-file copying,
layer export, and registry upload. The investigated slow CMS job took 9m 28s,
including 140s copying runtime files and 220s exporting layers, while the CMS
build itself took 39s. Builder isolation bounds concurrent load; Docker image
size, cache fingerprints, and check scheduling are unchanged.

## Validation observations (2026-11-28)

Overlapping revisions of PR #451 and the disposable PR #452 verified that
frontend and CMS can run concurrently, requests from different PRs queue for the
same app, and superseded requests cancel only their own PR's image work. The
canceled run's result gate failed and skipped image promotion and deployment.
The disposable PR was closed and its branch removed after validation.

The runner logs for the
[original slow build](https://github.com/fxmkdev/lapuertahostels/actions/runs/46152748950/job/141002918410),
[first completed app-scoped build](https://github.com/fxmkdev/lapuertahostels/actions/runs/46155782505/job/141012266993),
and
[next app-scoped build](https://github.com/fxmkdev/lapuertahostels/actions/runs/46157328715/job/141017008078)
show the following CMS timings. Queueing time is excluded; the controlled
overlap test deliberately queued the first completed build behind the disposable
CMS test for about eleven minutes.

| Stage                     | Original slow build | First app-scoped build | Next app-scoped build |
| ------------------------- | ------------------- | ---------------------- | --------------------- |
| Runner log duration       | 9m 28s              | 7m 05s                 | 3m 44s                |
| Depot builder acquisition | 13s                 | 206s                   | 2s                    |
| Dependency installation   | 55s                 | 48s                    | 42s                   |
| CMS build                 | 39s                 | 43s                    | 49s                   |
| Copy runtime files        | 140s                | 26s                    | 28s                   |
| Export layers             | 220s                | 36s                    | 35s                   |
| Upload layers             | 7s                  | 18s                    | 17s                   |

All three images were approximately 474 MB. Layer processing improved in these
two runs, but a 3m 26s builder-acquisition delay still contributed to the first
run's total time. These individual measurements are not a guarantee of future
build duration. The
[disposable CMS test](https://github.com/fxmkdev/lapuertahostels/actions/runs/46155671149/job/141011882486)
was deliberately canceled after 10m 38s: acquisition took 0.6s, dependencies
took 66.9s, and Turbopack then remained in production compilation for almost
nine minutes without reaching runtime copying or export. Builder isolation does
not establish a fix for that separate observed compilation stall.

The earlier revision passed E2E and deployed both preview apps successfully
while the newer revision continued running, confirming that image requests do
not cancel the deployment lifecycle.
