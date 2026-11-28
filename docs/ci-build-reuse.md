# Selective CI and image reuse

The Build workflow tracks frontend, CMS, and E2E inputs separately. Pull
requests compare against their merge base; pushes compare against the event's
`before` commit. Missing baselines and manual Build runs validate both apps
conservatively.

Each app includes its own directory and transitive workspace dependencies. The
frontend consumes `libs/payload-types`, `libs/rich-text`, and
`libs/live-preview`; the CMS consumes `libs/payload-types` and
`libs/live-preview`. Shared media helpers are exported from the payload-types
package, so their changes invalidate both application images. Root package
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
depend on this gate; preview cleanup runs only after a preview deployment. The
existing required E2E check also explicitly fails when prerequisite jobs fail or
unexpectedly skip, while permitting intentional CMS-verification skips.

The image-preparation job summaries record changes, build/reuse decisions,
required checks, tags, and resolved digests. To invalidate reuse after changing
the fingerprint algorithm, increment the schema identifiers in the helpers
together.

## Local verification

```bash
node --test scripts/ci/*.test.mjs
pnpm exec prettier --check scripts/ci .github/workflows/build.yml docs/ci-build-reuse.md
# Install actionlint separately, then:
actionlint .github/workflows/build.yml
```

The tests use isolated Git fixtures and simulated registries; they do not need
Fly credentials. Full workflow validation additionally requires a GitHub Actions
run with the existing Fly, Chromatic, and E2E secrets.
