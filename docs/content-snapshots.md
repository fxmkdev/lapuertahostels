# Content snapshots for preview and staging

Production publishes a content snapshot after each successful deployment when
`SNAPSHOT_PUBLISH_ENABLED=true` in the `production-cms` GitHub environment. The
**Publish Content Snapshot** workflow also refreshes content manually from the
default branch, using the currently deployed production CMS image. Neither path
passes a production database URI through GitHub.

Preview and staging deployments restore the latest completed snapshot when
`SNAPSHOT_RESTORE_ENABLED=true` in their respective CMS GitHub environments.
Both flags are disabled when absent. CMS edits after publishing wait for another
production deployment or manual refresh.

## Storage and credentials

Create the **private** `lapuertahostels-content-snapshots` Tigris bucket in the
`lapuertahostels` organization. Do not attach it as the CMS media bucket. Give
the production publisher access to list, read, write and delete objects in this
bucket. Give a separate reader key only list/read access to this bucket; disable
default permissions and access to other buckets. The website's public media
credentials must not grant access to snapshots.

Configure these non-secret GitHub variables in each CMS environment, including
production (they become Fly environment variables on deployment):

| Variable                   | Value                                                         |
| -------------------------- | ------------------------------------------------------------- |
| `SNAPSHOT_ENDPOINT`        | `https://fly.storage.tigris.dev`                              |
| `SNAPSHOT_REGION`          | `auto`                                                        |
| `SNAPSHOT_BUCKET`          | `lapuertahostels-content-snapshots`                           |
| `SNAPSHOT_TARGET_DATABASE` | Exact destination MongoDB database name; staging/preview only |

The repository's `FLY_PREVIEW_CMS_APP_PREFIX` supplies the preview allowlist.
Repository variables `SNAPSHOT_PRODUCTION_APP` and `SNAPSHOT_STAGING_APP`
default to `lapuertahostels-cms` and `lapuertahostels-cms-staging`. Change these
explicitly if renaming apps; production and preview/staging allowlists must not
overlap.

Stage publisher credentials as `SNAPSHOT_ACCESS_KEY_ID` and
`SNAPSHOT_SECRET_ACCESS_KEY` on the production Fly app. Stage reader credentials
under those same names on staging. Store the reader key in the `staging-cms` and
`preview-cms` GitHub environments as `SNAPSHOT_READ_ACCESS_KEY_ID` and
`SNAPSHOT_READ_SECRET_ACCESS_KEY`. Preview provisioning installs that reader key
on new preview CMS apps. GitHub preflight uses the reader to verify the snapshot
inside the target CMS image before maintenance starts.

Maintenance uses the app's existing `DATABASE_URI` and `MEDIA_S3_*` settings.
`MEDIA_S3_ENDPOINT` is optional for an S3-compatible media source/destination;
absent means AWS. Snapshot storage has independent credentials and endpoint.
Local S3 tests additionally set `SNAPSHOT_FORCE_PATH_STYLE` and
`MEDIA_S3_FORCE_PATH_STYLE`; production does not need them.

## Snapshot contract

Each immutable `snapshots/<id>/` prefix contains `database.archive.gz`, media
objects, and a format-version-1 `manifest.json`. Media objects have numbered
snapshot keys; the manifest retains their original destination keys, content
types, metadata, SHA-256 checksums and sizes. It also records source database,
deployed image/version, applied migrations and included collections.

An explicit content collection allowlist includes globals, content versions and
`payload-migrations`. It excludes users, API keys, preferences, authentication
sessions, document locks, jobs, and unknown future collections. Add new content
collections to that allowlist deliberately when changing the schema.

The publisher reads artifacts back and verifies them before updating
`latest.json`. Publication failure leaves the previous latest snapshot
available; the workflow fails without rolling back production. The latest five
completed snapshots are retained. Successful publications also clean incomplete
uploads older than 24 hours. Individual objects must be smaller than 5 GB.

These exports are for content refreshes, not point-in-time disaster recovery.
Production editing remains available during export, so concurrent edits can span
different collection/media read times. Missing referenced media or a change to
production migration history fails publication. Full recovery backups, including
production credentials, need separate storage and access controls.

## Restoration and downtime

Preflight pins one snapshot ID and checks every artifact's checksum and
migration compatibility against the target image. A source migration absent from
the target image fails preflight, which also prevents restoring newer schemas
into older branches. No missing-snapshot fallback silently skips restoration.

The deployment then disables autostart/restart and stops the affected CMS
Machines. Staging has its own deployment lock. All previews share the existing
database, media bucket and preview lifecycle lock, including preview cleanup.
Consequently every preview CMS pauses during a preview content reset. Keep edits
out of these environments during deployments: staging/preview content is
replaced.

The release command validates the pinned snapshot again, performs a MongoDB
restore dry run, copies media, removes stale target media, replaces content and
restores source migration history with explicit source/destination namespace
mapping. It preserves target `users`, `api-keys` and `payload-preferences`,
clears transient locks/jobs, and then runs Payload migrations. Application
environment secrets and external API keys remain configured on their existing
Fly apps.

Only explicitly enabled staging/preview app names and the configured target
database are accepted. Production's release command runs migrations without a
restore. After successful deployment, paused Machines resume and each affected
frontend invalidates its cache through its existing authenticated endpoint. The
invalidation secret is evaluated within each frontend Machine and never printed.

## Failure and recovery

Cancellation cleanup stops any active release-command worker before pausing app
Machines, preventing a background restore from outliving the workflow lock.

On restore, migration, deployment or invalidation failure after maintenance
begins, the workflow keeps affected CMS apps offline, including newly created
Machines. Each paused Machine retains original autostart/restart settings and
the pinned snapshot ID in `content_snapshot_maintenance` metadata. The workflow
also uploads a `snapshot-recovery-<environment>-<sha>` artifact containing
Machine IDs, original settings and snapshot ID; it contains no database
credentials.

Rerun the failed deployment: preflight reads the maintenance markers and its
saved workflow pin artifact, reusing the same snapshot even if latest has
advanced or the failed deployment had no surviving CMS Machine. Pin upload must
succeed before deployment can proceed. The **Deploy** workflow also accepts an
explicit `snapshot_id` for staging recovery. A different snapshot is rejected
while recovery markers remain. Do not manually enable autostart or disable
restoration to bypass an incomplete restore. The restore is repeatable and
preserves target users/keys even if a previous attempt dropped content before
failing.

If a publisher fails, inspect its Fly logs. The orchestration waits for the
actual process exit code, fails on a nonzero/missing exit status or a 30-minute
timeout, and removes the temporary Machine afterward. A launch/start event alone
never counts as a successful publication.

## Initial rollout and validation

1. Provision the bucket and scoped credentials with both enable flags absent or
   `false`. Staging and preview retain their existing deployment behavior.
2. Merge and deploy the maintenance-capable CMS image to production. Publish the
   first snapshot manually; confirm preflight succeeds. Set production
   `SNAPSHOT_PUBLISH_ENABLED=true` for subsequent production deployments.
3. Configure the staging database allowlist and reader credentials, enable
   staging restoration, and deploy staging. Check existing admin login, frontend
   API authentication, restored content/media and cache freshness.
4. Enable preview restoration only after staging validation. Confirm all
   existing previews pause, resume and invalidate their caches together.

Shared previews still affect one another through edits and application versions.
The lifecycle lock prevents concurrent restores/migrations, not schema
isolation. The repository-wide Fly deployment token remains privileged
infrastructure access; read-only snapshot credentials do not reduce that
existing token's permissions.

## Local tests

Run `pnpm --filter @lapuertahostels/cms test:snapshots` for snapshot unit tests;
integration tests skip unless their local service environment is supplied.

```sh
docker compose -f tests/snapshots/compose.yml up --wait
SNAPSHOT_TEST_MONGODB_URI=mongodb://127.0.0.1:27141 \
SNAPSHOT_TEST_S3_ENDPOINT=http://127.0.0.1:9014 \
pnpm --filter @lapuertahostels/cms test:snapshots
docker compose -f tests/snapshots/compose.yml down --volumes
```

Host execution requires `mongodump` and `mongorestore`. CI runs these tests
inside the built CMS image, which includes the tools, against disposable MongoDB
and MinIO. CI helper tests cover app allowlists, maintenance/recovery ordering,
completion status checking and invalidation across shared previews.

The MinIO fixture is built from its pinned September 2025 upstream source commit
and verified archive checksum because its community image/binary downloads are
no longer available. CI caches that test image. Fixture changes under
`tests/snapshots/` trigger the required E2E job without forcing application
rebuilds.
