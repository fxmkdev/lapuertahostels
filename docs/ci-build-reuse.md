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

Existing job names remain stable. `Build / Result` always runs and rejects
failed/cancelled dependencies and unexpectedly skipped required checks.
Configure it as a required branch-protection check so failures in prerequisite
jobs cannot be hidden by downstream skips. Staging and preview deployments
depend on this gate; Build runs preview cleanup after a preview deployment. The
existing required E2E check also explicitly fails when prerequisite jobs fail or
unexpectedly skip, while permitting intentional CMS-verification skips.

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
pnpm exec prettier --check scripts/ci .github/workflows/{build,clean-preview,clean-preview-reusable}.yml docs/ci-build-reuse.md
# Install actionlint separately. Version 1.7.12 needs this compatibility exclusion:
actionlint -ignore 'unexpected key "queue" for "concurrency" section' .github/workflows/{build,clean-preview,clean-preview-reusable}.yml
```

The exclusion covers the existing concurrency setting, which GitHub supports
with
[`queue: max`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency).
Remove it when actionlint supports that key.

The tests use isolated Git fixtures, simulated registries, and mocked GitHub/Fly
cleanup responses; they do not need Fly credentials. Full workflow validation
additionally requires a GitHub Actions run with the existing Fly, Chromatic, and
E2E secrets.
