# CMS

## Type checking

Generate the admin import map, then run
`pnpm --filter @lapuertahostels/cms typecheck`. This generates Next route types
and checks the complete configured project with native TypeScript 7. CI runs
this gate alongside the existing TS6 check inside `next build`. The package
named `typescript` still supplies the TS6 API for ESLint; Next also selects its
build checker from that package. See the
[workspace compatibility report](../../docs/typescript-7-pilot.md) for remaining
removal blockers and rollback instructions.

## Generated Payload types

The CMS and shared-library generated types are committed. Fresh checkouts can
use them without running type generation, and CMS builds generate only the admin
import map before Next builds the application. The import map is committed;
regenerate it with `pnpm --filter @lapuertahostels/cms generate:importmap` when
custom component registrations change. The bridge component is registered
unconditionally so build-time generation also works without runtime preview
settings.

After schema changes or Payload dependency changes that affect generated types,
run this command from the repository root and commit both generated files:

```bash
pnpm --filter @lapuertahostels/payload-types pull-payload-types
```

Use `pnpm --filter @lapuertahostels/payload-types check-payload-types` to
regenerate and compare both files with `HEAD`. CI rejects stale committed types
before staging or preview deployment. Keep the generator's formatting and do not
edit these files by hand. The CMS's `generate:types` command remains the
low-level generator; use `pull-payload-types` to synchronize the shared copy
too.

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
needed. Saving media notifies the frontend to invalidate cached content,
including pages with populated images. After successful invalidation, the next
navigation or reload loads the saved focal point. If notification fails, the
one-minute freshness check remains the fallback; requests wait for the refresh
rather than refreshing in the background. See
[CMS content freshness](../frontend/README.md#cms-content-freshness) for failure
limits and configuration. `?skipcache=true` bypasses caching for diagnostics.

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

## Live preview authentication

Pages and Brands register a nonvisual `LivePreviewBridge` before the document
controls. It accepts population requests only from the active preview iframe or
popup at the exact `LIVE_PREVIEW_URL` origin, for the current document and
locale. It reads unsaved data directly from the form and populates it with the
existing same-origin Payload document endpoint and CMS session cookie. The
preview never receives credentials and cannot choose an arbitrary endpoint or
document.

The protocol is shared with the website in `@lapuertahostels/live-preview`. It
supports relationship depths zero through three, cancels requests on navigation,
and sanitizes failures to status codes. Existing access control, cookie
settings, and CSRF/CORS restrictions remain in force. No content or database
migration is required. Deploy the website and CMS together; incompatible
versions show a connection error while keeping the last loaded content.

CMS tests cover request validation and iframe/popup wiring. The E2E preview test
uses a fresh cookie-authenticated editor context without the suite's API-key
headers. With the CMS on `localhost` and the website on `127.0.0.1`, it verifies
that a direct cross-site request fails while unsaved edits appear in both
preview modes through same-origin CMS requests.

## Map locations

A Map block has an optional, translated **Heading** above its ordered
**Locations** list. The heading appears once above the frontend tabs and remains
the same when selecting another location. Clear it to omit the heading entirely.
Add an address (including the business name) and an overlay with text, optional
directions label, and position for each location. Addresses must identify a
place on Google Maps. The first available location is selected initially.
Selecting a pin or a location tab switches its details and directions
destination.

Each location also has an optional, translated **Name** for its tab and pin.
This is independent of the shared heading. Empty or whitespace-only names fall
back to the address for new content. Existing unnamed locations can still use
their old location headings as labels.

The frontend shows themed tabs above the details when multiple locations
resolve. The Google Maps directions link remains a separate action button. The
tab list screen-reader label can be translated under **UI Labels → Map →
Locations**.

Single-location maps retain their configured zoom. Maps with multiple locations
fit all available pins, reserving room for the desktop overlay; **Zoom Level**
limits how closely they zoom in. Failed lookups are omitted, and a map with no
resolved locations is hidden.

Existing single-address blocks and historical versions remain compatible. Field
hooks present their address and overlay as the first editable location. When the
shared heading is absent, the first nonblank old location heading (or the
original single-address heading) initializes it, preserving translations.
Explicitly cleared headings stay cleared. Saving persists the location list and
shared heading. Explicit location lists take precedence over legacy fields. No
bulk migration is needed. Deploy the updated frontend before the CMS (or deploy
both together), since older frontends cannot render the new list.
