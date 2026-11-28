# Media storage, optimization, and migration

Media originals and immutable image derivatives live in Tigris Standard storage.
Public delivery goes directly to Tigris, independently of Fly app uptime.
Payload uses its S3-compatible adapter with an explicit endpoint; the AWS SDK is
a client library, and runtime requests use the configured Tigris endpoint.

## Configuration

Configure each CMS environment with `MEDIA_STORAGE_ENDPOINT` (normally
`https://t3.storage.dev`), `MEDIA_STORAGE_REGION=auto`, `MEDIA_STORAGE_BUCKET`,
`MEDIA_STORAGE_ACCESS_KEY_ID`, `MEDIA_STORAGE_SECRET_ACCESS_KEY`, and
`MEDIA_PUBLIC_BASE_URL`. The frontend requires only `MEDIA_PUBLIC_BASE_URL`.
Credentials belong in Fly/GitHub secrets; endpoints, bucket names, and public
URLs belong in environment variables. Runtime fails if configuration is missing.
Build/type-generation commands supply isolated placeholder settings and do not
need access to a live bucket or database.

Use separate production, staging, preview, and E2E buckets. Production uses
`https://media.lapuertahostels.co`; other environments can use their Tigris
public bucket domain. Point the production `media` CNAME to
`lapuertahostels-media.t3.tigrisbucket.io`, then attach that domain to the
bucket. The authenticated S3 endpoint is not a public delivery URL.

CI uses `E2E_TESTS_MEDIA_STORAGE_*` and `E2E_TESTS_MEDIA_PUBLIC_BASE_URL`
repository variables/secrets. Preview provisioning uses
`PREVIEW_MEDIA_STORAGE_ACCESS_KEY_ID` and
`PREVIEW_MEDIA_STORAGE_SECRET_ACCESS_KEY` secrets plus the preview CMS
configuration. Storybook uses `STORYBOOK_MEDIA_PUBLIC_BASE_URL`; fixture
documents without manifests use original files.

## Image behavior

Original bytes remain unchanged. Payload retains the focal-point editor and
media metadata. A before-change hook generates WebP quality 80 derivatives and
JPEG quality 85 social previews before publishing their manifest. The CMS
thumbnail uses the generated natural-size image. No request-time image processor
is needed.

Natural widths are 96, 192, 400, 800, 1200, 1600, 2400, and 3200px. Square, 4:3,
3:4, and 9:10 crops use 480, 960, 1600, and 2400px widths. There is a 32px
preview and social crops targeting 1200x630 and 2400x1200. All outputs are
capped at source resolution and duplicate sizes within a preset are omitted.
Actual dimensions are recorded. Transparency is preserved in WebP; JPEG previews
have white backgrounds. SVGs, animated images, and videos use original files.

Derivatives are EXIF-oriented and cropped around the saved focal point. Their
manifest stores the focal position after cropping so CSS cropping can preserve
it. Missing focal coordinates default to the center; legacy hero alignment
remains available on the frontend. Metadata-only saves do not re-encode images.

Immutable keys include a recipe version, original SHA-256, focal coordinates,
and output dimensions. Derivatives receive a one-year immutable Cache-Control
header. Encoding/upload work is limited to two jobs per CMS process. Failed
derivative generation aborts the media save. Already-uploaded orphan files are
safe to remove with the explicit cleanup command after 14 days. Advance the
recipe version when changing encoder settings or geometry, then run the
backfill.

## Maintenance commands

Run from the repository root with the target CMS/storage environment loaded:

```sh
pnpm --filter cms media inventory dry-run
pnpm --filter cms media copy dry-run
pnpm --filter cms media copy apply
pnpm --filter cms media verify-copy dry-run
pnpm --filter cms media backfill dry-run
pnpm --filter cms media backfill apply
pnpm --filter cms media verify dry-run
pnpm --filter cms media cleanup dry-run
pnpm --filter cms media benchmark dry-run /absolute/path/photo.jpg
```

`copy` and `verify-copy` also require explicit source settings:
`SOURCE_STORAGE_ENDPOINT`, `SOURCE_STORAGE_REGION`, `SOURCE_STORAGE_BUCKET`,
`SOURCE_STORAGE_ACCESS_KEY_ID`, and `SOURCE_STORAGE_SECRET_ACCESS_KEY`.
Alternatively, omit the source credential pair and use an existing
`AWS_PROFILE`; the default credential chain is used only by the migration source
client. Inventory lists database media records; with source settings supplied,
it also lists source objects. Copy commands do not initialize Payload or access
the database. Copy and verification compare actual bytes with SHA-256, including
multipart objects; ETags are not checksums. Existing matching targets are left
alone. A retry scans again and only writes missing/changed files, retaining keys
and prefixes. Target-only files are retained.

Set `MEDIA_MIGRATION_REPORT` to a private absolute JSON file path to persist
progress atomically after each object/document. A failure exits nonzero and
records the affected item. Source credentials are temporary migration inputs and
must not remain configured on the finished apps.

Backfill reads originals sequentially from Tigris and preserves document IDs,
filenames, localized text, relationships, and focal metadata. Current manifests
are skipped. Set `MEDIA_REGENERATE_ALL=true` to repair missing derivatives or
force regeneration. Verification checks originals, derivative hashes, saved
focal points, the recipe version, and any referenced legacy thumbnails. It fails
on missing objects or incomplete static-image manifests.

`MEDIA_WRITES_PAUSED=true` blocks media create/update/delete operations on the
CMS, including focal saves. Maintenance backfills use a server-only request
context to continue. Before applying cleanup, pause writes on all CMS machines
and stop any backfill or other maintenance writers. Set this variable in the
cleanup process too; cleanup and backfill must not run concurrently. Cleanup
only removes unreferenced `optimized/` objects whose retirement tags are at
least 14 days old; originals are protected. The first applied cleanup marks
newly unreferenced files for retirement. A later cleanup may delete them after
the window; file creation age alone never permits deletion. Regenerating/reusing
a key clears its retirement tag before publishing the new reference. This also
protects in-progress generations. Inspect the dry-run report first.

`backup.sh` and `restore.sh` use these Tigris settings with the AWS-compatible
CLI. They retain the existing database settings and store objects in
`.media-backup`. A restore replaces the target bucket contents, so run it only
against the intended restore target. Keep backup data private and test
restoration in a separate bucket and database before production cutover.

## Cutover runbook

1. Record all source buckets and corresponding databases; take database and
   object backups. Rehearse the remaining steps in staging, including restore
   and rollback.
2. Copy all source objects to the matching Tigris buckets. Run `verify-copy` and
   retain its checksum report. Keep the old services and configuration
   available.
3. Prepare GitHub variables/secrets and stage the new Fly settings. Deployments
   build with no live credentials. Confirm the production media domain serves
   the target bucket over HTTPS before changing production delivery.
4. Announce the short editing pause and set `MEDIA_WRITES_PAUSED=true` on the
   CMS. Take the final database backup, repeat the object copy, and verify
   again. The website stays available on the old deployment throughout
   preparation.
5. Deploy the frontend and CMS with Tigris settings. Original-file fallback lets
   the new frontend work while manifests are absent. Run `backfill apply` as a
   separate maintenance process, outside `payload migrate` and deploy timeouts.
6. Run `verify`, invalidate frontend content caches, and inspect mobile/desktop
   heroes, logos, cards, galleries, social previews, and video/range requests.
   Confirm browser requests contain no old-service hosts. Save a new upload,
   replace one, and edit a focal point with warm browser caches; confirm changed
   derivatives use new URLs and originals remain intact.
7. Benchmark on the actual Fly VM and record time, peak RSS (KiB), output count,
   total derivative bytes, and resulting storage growth. Keep existing VM sizing
   unless these measurements show it is insufficient.
8. Resume media editing. Retain AWS data, the prior release, and private
   migration reports for 14 days. Before editing resumes, rollback can restore
   the previous deployment and database. After editing resumes, retain Tigris
   and roll back to original-file delivery so newly uploaded media remains
   available. To disable image processing during recovery, set
   `MEDIA_OPTIMIZATION_ENABLED=false` on the CMS and
   `MEDIA_USE_DERIVATIVES=false` on the frontend.

## Final retirement checklist

After the rollback window, verify the final release, backups/restores, media
checksums, and traffic again. Remove old AWS/ImageKit runtime and CI credentials
and variables, retire the ImageKit endpoint/subscription, and delete source
buckets only after confirming the independent backups are complete. Remove
private temporary credential files after migration. Run derivative cleanup
separately; it never deletes original media.
