# Selective CI and image reuse

The Build workflow tracks frontend, CMS, and E2E inputs separately. Pull
requests compare against their merge base; pushes compare against the event's
`before` commit. Missing baselines and manual Build runs validate both apps
conservatively.

Each app includes its own directory and transitive workspace dependencies. The
frontend currently consumes `libs/payload-types` and `libs/rich-text`; the CMS
has no workspace dependencies. Root package manifests, lockfile, pnpm workspace
configuration, `.npmrc`, patches, shared formatting/Docker configuration, CI
helpers, and Actions configuration affect both apps. Changes inside an app's
directory are conservatively considered app changes, including its
documentation. Root `README.md` and `docs/` changes do not affect either app.

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
processes; interrupted builds never publish image outputs or aliases.

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
downstream skips. Staging and preview deployments depend on this gate; preview
cleanup runs only after a preview deployment. The existing required E2E check
also explicitly fails when prerequisite jobs fail or unexpectedly skip, while
permitting intentional CMS-verification skips.

The image-preparation job summaries record changes, build/reuse decisions,
required checks, tags, and resolved digests. To invalidate reuse after changing
the fingerprint algorithm, increment the schema identifiers in the helpers
together.

## Local verification

```bash
node --test scripts/ci/*.test.mjs
pnpm exec prettier --check scripts/ci .github/workflows/{build,prepare-image}.yml docs/ci-build-reuse.md
# Install actionlint separately, then:
actionlint -ignore 'unexpected key "queue" for "concurrency" section' .github/workflows/build.yml .github/workflows/prepare-image.yml
```

Actionlint 1.7.12 does not yet recognize GitHub's `queue` property. The narrow
exception above covers that property only; both queues use `max` with
`cancel-in-progress: false`, as required by GitHub.

The tests use isolated Git fixtures and simulated registries; they do not need
Fly credentials. Full workflow validation additionally requires a GitHub Actions
run with the existing Fly, Chromatic, and E2E secrets.

For live concurrency verification, overlap revisions of the same PR and image
jobs from different PRs. Confirm superseded image jobs are canceled, jobs for
the same staging app do not overlap, and frontend/CMS jobs can overlap. An
active deployment must finish independently of newer image requests. Main and
release image jobs must queue rather than cancel one another.

Compare the initial cold build with subsequent warm-cache builds. Record queue
time separately from builder startup, CMS compilation, runtime-file copying,
layer export, and registry upload. The investigated slow CMS job took 9m 28s,
including 140s copying runtime files and 220s exporting layers, while the CMS
build itself took 39s. Builder isolation addresses contention; Docker image
size, cache fingerprints, and check scheduling are unchanged.
