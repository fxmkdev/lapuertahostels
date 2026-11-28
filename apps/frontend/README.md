# Welcome to React Router!

- [React Router Docs](https://reactrouter.com/home)

## Development

From your terminal:

```sh
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

Shared Payload types are committed, so frontend development, builds, typechecks,
and Storybook do not require running CMS type generation first. If a CMS schema
or relevant Payload dependency changes, run
`pnpm --filter @lapuertahostels/payload-types pull-payload-types` from the
repository root and commit both generated files. CI checks that they are
current.

## Type checking

`pnpm typecheck` generates React Router types and checks the frontend with
native TypeScript 7. Tools importing the `typescript` compiler API continue to
use TS6; supported upstream releases are still required for full removal.

See the [TypeScript 7 adoption report](../../docs/typescript-7-pilot.md) for the
adoption decision, compatibility checks, and historical pilot benchmarks. The
TS6 API dependency remains intentional compatibility support. Measure current
native checking with `pnpm benchmark:typecheck --output /tmp/ts7-current.json`
using the committed shared Payload types. The live runner measures TS7 only;
historical TS6 reports and their raw samples remain in the adoption report.

## Root document layout

The root route's `Layout` export owns the shared HTML document for normal,
maintenance, and error screens. Keep document metadata and framework scripts in
`Layout`; screen components render content and their own titles. Read loader
data in `Layout` with `useRouteLoaderData("root")` and handle missing data so
root loader failures can still render the fatal error screen.

## Banner dismissal

Banner dismissals are stored in `localStorage` under
`lapuertahostels:banner-dismissal:v1:` keys scoped to the CMS banner ID and
language. They survive refreshes and browser restarts on the same origin. Brands
using the same banner share its dismissal within a language.

A different banner ID, message, or visible call-to-action (visibility, label, or
resolved destination) shows the banner again. Timestamp-only saves, edits to a
hidden call-to-action, and unrelated linked-page edits do not reset dismissal.
Each key stores only the latest dismissed content signature. Clearing site
storage also resets dismissal; there is no automatic expiry or synchronization
between open tabs.

The banner waits until hydration checks storage before appearing. If storage is
blocked or full, or a banner has no ID, dismissal works only in memory for the
current mount.

## Navbar scrolling

The sticky navbar hides when scrolling down past 100px and reappears when
scrolling up or navigating to another page. At widths of 640px and above, the
desktop booking button stays in its top-right position while the navbar
background and other controls slide away over 500ms. The same button remains
mounted, with its size and shape unchanged; its shadow strengthens over 500ms
with ease-in-out easing when the navbar is hidden. The transparent header area
lets clicks reach the page underneath.

At widths below 640px, the floating booking button is always available at the
bottom right. Both versions use the brand's CMS booking configuration.

Keyboard focus on other navbar controls reveals the navbar and keeps it visible
while those controls are focused. Focusing the stationary desktop booking button
preserves the collapsed state. All transitions respect reduced-motion
preferences. Try this behavior in Storybook under `layout/Navbar → Scrollable`,
which also includes a dismissible banner.

## Live preview

All CMS live previews, including popup windows, populate content through the
signed-in CMS window. The website sends a versioned request over `postMessage`;
the CMS uses its own current unsaved form and same-origin session cookie to
populate relationships, then returns the document. This works across separate
`.fly.dev` sites without cross-site cookies or DNS changes. Credentials remain
in the CMS, and document read permissions are unchanged.

Both ends validate the other window and exact configured origin. The CMS accepts
only its active document and language with relationship depths from zero through
three. Replies include document data on success or a sanitized HTTP status on
failure. Requests time out after ten seconds in the CMS and fifteen seconds in
the website. Switching document, language, or preview window cancels pending
work.

The website retains the last valid document on failed updates, rejects stale or
invalid replies, and shows an English/Spanish alert until a later update
succeeds. Valid empty block arrays still remove content intentionally. Open live
preview from the CMS; there is no direct cross-site request fallback. Deploy the
CMS and website together; mixed versions retain content and show a connection
alert.

`PAYLOAD_CMS_BASE_URL` is used for server-to-server requests. Set optional
`PAYLOAD_CMS_PUBLIC_URL` when the browser must use a different address;
otherwise it defaults to `PAYLOAD_CMS_BASE_URL`. The public URL must match the
CMS address used by editors. The disposable E2E services use `http://cms:3001`
internally, `http://localhost:3001` in the browser, and `http://127.0.0.1:3000`
for the preview.

## Plausible analytics

Analytics is optional. Set the server-side `ANALYTICS_SCRIPT_URL` to the
site-specific script URL from Plausible → Site settings → General → Site
installation. For `lapuertahostels.co`, the current value is:

```text
https://plausible.io/js/pa-mNmGQe_APpMrQMvTp8u6q.js
```

This replaces `ANALYTICS_DOMAIN`: the current script already contains the site
domain. Set the `ANALYTICS_SCRIPT_URL` GitHub environment variable in
`production-frontend` before deploying this change. Leave it unset in staging,
preview, and local development unless deliberately testing analytics. Missing or
invalid configuration disables the snippet and returns 404 from both proxy
endpoints. Only HTTPS script URLs on `plausible.io` directly under `/js/` are
accepted; credentials, query strings, and fragments are rejected.

The browser loads `/js/script.js` and sends events to `/api/event` on the same
origin. These resource routes bypass CMS translation loading. The script proxy
preserves Plausible's cache policy; event responses and errors use `no-store`.
Upstream requests time out after ten seconds and do not follow redirects. No
cookies or authorization credentials are sent to Plausible. Event bodies larger
than 64 KiB return an uncached 413 response before any upstream request. The
limit is enforced while reading the upload, including chunked requests and
requests with an incorrect `Content-Length`.

The event proxy assumes visitors connect **directly through Fly Proxy**. It
validates `Fly-Client-IP` and forwards it as `X-Forwarded-For`, together with
the browser identification headers recommended by Plausible. Missing or invalid
IPs return 400; caller-supplied forwarding headers are ignored. If another CDN
or reverse proxy is introduced ahead of Fly, review this trust boundary before
enabling tracking: `Fly-Client-IP` would then identify that proxy. Do not expose
the application port directly to untrusted clients.

### Automated tracking verification

Run frontend unit tests with
`pnpm --filter @lapuertahostels/frontend test --run`. They check forwarding,
credential filtering, IP validation, failures, CMS independence, document
rendering, and initialization.

For the real tracker browser smoke, set `ANALYTICS_SCRIPT_URL` to the value
above on both the production-built test frontend and the test runner, start the
disposable E2E services, and run:

```sh
pnpm --filter @lapuertahostels/e2e exec playwright test analytics.spec.ts
```

Use the normal E2E environment variables described below. The test enables
localhost capture only in its browser, fetches the real script through the
frontend proxy, and intercepts event POSTs so test visits never enter Plausible.
It checks initial pageviews, client navigation, back/forward navigation, custom
events, same-origin requests, and duplicate initialization. It requires access
to Plausible's script CDN and skips when `ANALYTICS_SCRIPT_URL` is unset.

### Later deployment verification

Automated verification does not establish live ingestion or clear Plausible's
outdated-script warning; those require deploying the updated installation. After
a later deployment, check browser requests use the two same-origin paths. For an
IP diagnostic, POST a normal event payload to `/api/event` from the real
visitor's browser with `X-Debug-Request: true`. The proxy forwards this
diagnostic header; Plausible returns the IP it sees without recording that
request. For normal events, check that `x-plausible-dropped: 1` is absent, then
confirm a test visit in the dashboard. HTTP 202 alone does not prove an event
was recorded. Do not log visitor IPs or event payloads during these checks.

See Plausible's
[script migration guide](https://plausible.io/docs/script-update-guide),
[proxy requirements](https://plausible.io/docs/proxy/introduction), and
[Events API diagnostics](https://plausible.io/docs/events-api), plus Fly's
[visitor IP documentation](https://fly.io/docs/networking/request-headers/).

## Deployment

First, build your app for production:

```sh
pnpm build
```

Then run the app in production mode:

```sh
pnpm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying node applications, the built-in React Router
app server is production-ready.

Make sure to deploy the output of `react-router build`

- `build/`

## React compatibility checks

Run `pnpm test --run`, `pnpm typecheck`, `pnpm build`, and
`pnpm build-storybook` after updating React and React DOM together.

The root document fixture hydrates server-rendered markup and throws on
recoverable hydration errors. Its error-navigation test expects exactly one
React 19.3 development warning when React Router remounts script elements at the
root error boundary; other unexpected console errors still fail the suite.

The workspace E2E suite checks both hydration scheduling paths, client
navigation, browser history, and mobile locale switching against the production
applications. Run it headlessly with
`pnpm --filter @lapuertahostels/e2e exec playwright test` after starting the
[disposable test services](../../tests/e2e/docker-compose.yml) and setting
`FRONTEND_BASE_URL`, `CMS_BASE_URL`, and `CMS_API_KEY`. The fixture helpers also
need access to that test MongoDB instance through `CMS_DATABASE_URI` (or the
default `mongodb://localhost:27017/website-cms`). Hydration tests stub external
font CSS so third-party availability cannot fail the interaction checks.

## Image focal points

`MediaImage` reads Payload's `focalX`/`focalY` percentages and orientation-aware
display dimensions (falling back to raw dimensions for legacy records). The
shared image layer maps them to ImageKit `xc`/`yc` coordinates after scaling and
clamps the crop within the image. Each responsive/DPR URL gets its own crop
coordinates. Any CSS `object-fit: cover` crop uses the focal point remapped into
the ImageKit output, keeping the subject visible through both crop stages.
Room-gallery thumbnails and social preview URLs use the same geometry.

Missing, incomplete, or invalid metadata preserves the existing cropping and
hero alignment. A valid saved point overrides automatic/custom ImageKit focus
and hero alignment. Full-image lightboxes, uncropped logos, and videos retain
their existing presentation. See the CMS README for the editor workflow and
cache-refresh timing.

## CMS content freshness

CMS content is cached in Redis for one minute. Once an entry reaches one minute
old, the request waits for fresh CMS data. If the CMS is unreachable, times out
(after five seconds), or returns HTTP 5xx, the request may return the previous
value only while it is less than five minutes old in total. Failed refreshes do
not reset that age. Redis entries expire at five minutes; missing content and
non-transient errors such as 401/403 do not use stale fallback. Malformed cache
entries are treated as misses. Redis failures bypass caching.

CMS content saves and deletes invalidate the whole content cache across locales,
including populated relationships: editing a banner invalidates brands that
embed it, and editing a page invalidates links pointing to it. Saves inside a
transaction notify the frontend only after the outer commit, including nested
brand home-link updates. Rollbacks do not notify. Without transactions,
notification runs at the end of the save/delete hooks. Notifications are awaited
with a three-second timeout. Failure logs a CMS warning but does not fail the
save; the one-minute freshness check remains the fallback. During a simultaneous
CMS outage, the five-minute stale limit still applies.

The next page request after successful invalidation loads current content. An
already-running request may finish with its prior result. Open pages require
navigation or reload to request new data; this does not change banner dismissal.

Server translation resources are isolated per request, so CMS UI labels follow
the same invalidation and expiry rules. The UI-label endpoint uses `no-store` to
prevent browser caching from keeping old translations after a reload.

Cache keys are isolated by CMS origin and a random Redis generation.
Invalidation rotates that generation, so an earlier in-flight request cannot
restore active stale content. Old generations expire naturally. The
authenticated manual purge uses the same operation and no longer flushes
unrelated Redis data. `?skipcache=true` bypasses cache reads and writes and has
no stale fallback.

### Configuration and rollout

- Frontend: set `CMS_CACHE_INVALIDATION_SECRET` to a random secret.
- CMS: set the same `CMS_CACHE_INVALIDATION_SECRET` and set
  `FRONTEND_CACHE_INVALIDATION_URL` to the frontend's complete
  `/api/invalidate-cms-cache` URL.
- The callback is a server-to-server `POST` with
  `Authorization: Bearer <secret>`. It returns 204 on success, 401 on invalid
  credentials, and 503 when unconfigured or Redis invalidation fails. It
  bypasses CMS-backed translation middleware and authenticates locally without
  calling the CMS, including when the CMS is unavailable.
- Missing CMS configuration logs a startup warning and disables immediate
  invalidation; timed expiry still works.

Provision matching Fly secrets on both staging/production apps before rollout.
Deploy the frontend before the CMS so the callback exists before saves notify
it. The deployment workflow derives the callback URL from `LIVE_PREVIEW_URL`
(configure that URL without a trailing slash). For each preview app pair, a
shared provisioning job generates a fresh 32-byte invalidation secret, masks it,
and stages the same value on both Fly apps before deployment. Only the app names
are passed between jobs; the generated secret stays within provisioning. Preview
deployments do not require a separately configured invalidation secret. Staging
and production continue to use their persistent Fly secrets. The e2e Compose
stack uses a local test secret and callback URL.

Preview deployments and both cleanup paths share the `fly-preview-lifecycle`
concurrency group. The lock covers provisioning and both app deployments, so
cleanup cannot delete a newly created app while it is waiting to be deployed.
Pending operations queue with `queue: max` (up to GitHub's 100-item limit) and
do not cancel running operations. Builds, tests, staging, and production remain
outside this queue; cleanup retention rules are unchanged.

When rolling out this coordination, let workflows using the old definitions
finish first. Refresh older PR branches before rerunning their preview workflows
so all deployments and cleanup jobs use the same concurrency group.

After rollout, warm a page, save a related banner, reload once, and confirm the
new content. Check CMS logs for invalidation warnings and frontend logs for
Redis failures. No Payload schema migration is required. Legacy cache keys are
ignored; they had no Redis TTL and can be removed separately during maintenance.

## Maps with multiple locations

Map blocks render each configured location as a selectable pin, with a location
button alternative for keyboard users and coincident pins. Selecting a location
switches its overlay and directions link while retaining an overview of all
resolved locations. Bounds refit when the map or desktop overlay changes size;
the configured zoom is the maximum for an overview and the exact zoom for one
resolved location. Old single-address responses remain supported.

Address lookups are debounced, repeated addresses share one lookup, failed
locations are omitted, and stale responses after edits are ignored. When every
lookup fails, the block is hidden. Map unit tests use mocked Google Maps APIs;
Storybook includes legacy, single-location, and multiple-location examples for
checking real Maps rendering with `STORYBOOK_GOOGLE_MAPS_API_KEY` configured.
