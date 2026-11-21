# Welcome to React Router!

- [React Router Docs](https://reactrouter.com/home)

## Development

From your terminal:

```sh
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

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
  authenticates locally without calling the CMS.
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
