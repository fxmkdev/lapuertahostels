# Welcome to React Router!

- [React Router Docs](https://reactrouter.com/home)

## Development

From your terminal:

```sh
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Type checking

`pnpm typecheck` generates React Router types and checks the frontend with
native TypeScript 7. Tools importing the `typescript` compiler API continue to
use TS6; supported upstream releases are still required for full removal.

See the [TypeScript 7 adoption report](../../docs/typescript-7-pilot.md) for the
adoption decision, compatibility checks, and historical pilot benchmarks. The
TS6 API dependency remains intentional compatibility support. Measure current
native checking with `pnpm benchmark:typecheck --output /tmp/ts7-current.json`
after generating shared Payload types. The live runner measures TS7 only;
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
cookies or authorization credentials are sent to Plausible.

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
