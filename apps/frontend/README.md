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
