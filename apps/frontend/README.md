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
native TypeScript 7. `pnpm typecheck:ts6` runs the same check with TypeScript 6
as a fallback. Tools importing the `typescript` compiler API continue to use
TS6.

See the [TypeScript 7 adoption report](../../docs/typescript-7-pilot.md) for the
adoption decision, compatibility checks, and historical pilot benchmarks. The
TS6 API dependency and fallback are intentional parts of this setup; removing
TS6 across the workspace is a separate migration. Reproduce the benchmark
protocol with `pnpm benchmark:typecheck --output /tmp/ts7-pilot.json` after
generating shared Payload types.

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
