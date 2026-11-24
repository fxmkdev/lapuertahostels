# CMS

## Type checking

Generate Payload types and the admin import map, then run
`pnpm --filter @lapuertahostels/cms typecheck`. This generates Next route types
and checks the complete configured project with native TypeScript 7. CI runs
this gate alongside the existing TS6 check inside `next build`. The package
named `typescript` still supplies the TS6 API for ESLint; Next also selects its
build checker from that package. See the
[workspace compatibility report](../../docs/typescript-7-pilot.md) for remaining
removal blockers and rollback instructions.

## Internal links and anchors

For an internal link, choose the target page and select an Element ID in the
Anchor field. To enter a custom anchor, type its value without `#` and select
**Use …**. Clear the field to link to the whole page.

Query string and Anchor share a row on wide screens and stack on narrow screens.
Each field has an info button with more detail, available by hover, keyboard
focus, or tap; press Escape or move focus away to close it.

Suggestions use Element IDs from the target page's saved hero and content
blocks. Save anchor changes on the target page, then reopen the link editor to
refresh suggestions. Existing fragments remain unchanged even if an anchor is
renamed or deleted, the target page changes, or suggestions cannot load.
Renaming an Element ID does not update incoming links automatically.

The selector is shared by structured links and rich-text internal links.
Fragments remain plain strings; no content migration is needed.

## Tests

Run `pnpm --filter @lapuertahostels/cms test` for anchor extraction and fragment
field tests. Frontend link-rendering regressions are covered by
`pnpm --filter @lapuertahostels/frontend test --run`.

CI runs the CMS unit suite in the **Build / CMS: Unit Tests** job. Browser
regressions for structured and rich-text links run in the existing E2E suite.
The E2E CMS advertises `http://localhost:3001` so the host browser can reach its
API; container-to-container requests use `http://cms:3001`.

## Image focal points

Open a media image, choose **Edit Image**, and drag the focal-point marker onto
the subject (or enter X and Y percentages). Apply the changes and save the
media. The point belongs to the image and applies to every placement and locale,
including room thumbnails and social previews. A saved point takes precedence
over hero-slide Image Alignment; that setting remains a fallback for older
images without focal metadata. New uploads default to a centered point.

The original image stays uncropped. Payload stores the point and retains the
existing admin-thumbnail configuration; ImageKit handles frontend resizing and
cropping. The metadata migration `20261124_000000_media_display_dimensions`
backfills existing JPEG display dimensions; no bulk image regeneration is
needed. The website caches CMS data for one minute and refreshes stale entries
in the background, so a focal edit may require a subsequent page load after that
interval to appear. Use `?skipcache=true` when checking a saved change
immediately.

The existing Payload UI patch also preserves zero-valued focal coordinates when
reopening the editor and omits crop edits when cropping is disabled. These
workarounds apply to both the individual modules and the bundled client export.

Payload refetches the stored original when saving a focal edit. The media
collection allows that fetch only at the configured CMS server's media-file
endpoint (including its protocol, explicit port, and API path), so local and
private deployments can save edits without disabling fetch protection for other
URLs.

The fetch forwards session cookies and API authorization only to the configured
CMS origin, including protocol and port. Cookie-authenticated refetches also
include that origin for Payload’s CSRF check. Other destinations receive no
credentials. This works around Payload treating its absolute upload URLs as
external URLs.

The Payload server patch measures refetched files from the downloaded buffer,
preserving their size when a storage response omits `Content-Length`. It also
ensures an empty URL port matches only the default port, keeping private
refetches on other ports outside the allowlist.

### EXIF orientation

`displayWidth` and `displayHeight` describe the image after EXIF orientation,
matching the editor and ImageKit. Uploads, replacements and focal refetches read
these dimensions with Sharp metadata only; no image pixels or raw width/height
are rewritten. Sharp is not registered as Payload's image processor.

The deployment's normal `payload migrate` release command backfills JPEGs
missing valid display dimensions. It reads originals from the configured S3
bucket, including their optional storage object folders, and updates only these
two fields. Valid records are skipped on retries. Missing objects or invalid
JPEG metadata fail the migration with the affected media ID; correct the source
or storage access and rerun the migration. The migration helper also supports a
`dryRun` option for an audit without database writes. This work may read each
legacy JPEG once from S3. It does not rotate or regenerate originals/thumbnails.
