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
import map before Next builds the application.

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

The original image stays uncropped and byte-identical. Sharp generates
immutable, focal-aware image variants in Tigris. See
[media storage and migration](../../docs/media-storage.md) for configuration,
recipes, backfill, verification, backups, and the cutover runbook. The existing
Payload UI and server patches remain in place for focal editing and safe
original-file refetches.
