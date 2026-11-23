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

## Structured data

Public CMS pages emit one JSON-LD graph through React Router's metadata API. The
graph is generated from the same published CMS records used to render the page;
it does not use an external lookup or an editable JSON field.

| Entity       | CMS fields                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organization | Parent `puerta` brand's `name`, homepage and `logo`; shared footer's Facebook/Instagram custom links as `sameAs`                                 |
| Brand        | Current brand's `id`, `name`, localized `rootPath` (or populated legacy `homeLink`) and `logo`                                                   |
| WebSite      | Parent brand's name, canonical site origin, published locale codes and Organization publisher                                                    |
| WebPage      | Existing computed page title, canonical URL, current locale, optional `seo.description` and `seo.image`, WebSite, publisher and Brand references |

Organization, Brand and WebSite IDs are stable across languages. Each localized
page has its own canonical `#webpage` ID. Canonical links and JSON-LD URLs
exclude query strings and fragments. Images use the configured ImageKit base;
page images use the same 1200×630 transformation as Open Graph images.
Unavailable images, unresolved home links, blank values and invalid URLs are
omitted. JSON-LD and social metadata share image validation and URL encoding; an
unresolved SEO image does not prevent page metadata from rendering.

Preview requests (including an empty `preview` parameter), maintenance mode,
login pages and error pages emit no graph. Client navigation replaces the graph.
WhatsApp conversation links are excluded from `sameAs`. The shared footer's
address is not assigned to properties. No postal addresses, phone numbers,
ratings, prices, amenities, legal names or lodging classifications are inferred.
New brands are supported without adding IDs to the graph builder.

### Validation

Run frontend typecheck, lint, `test --run`, formatting checks and build. The
structured-data unit/integration tests cover the CMS mappings, absent data,
localization, canonical URLs, actual React Router script escaping and client
navigation. Run
`pnpm --filter @lapuertahostels/e2e exec playwright test structured-data.spec.ts`
against the local CMS/frontend test stack to check the server response and
hydrated page with CMS fixtures.

For external validation, paste representative generated **HTML source** into
[Schema Markup Validator](https://validator.schema.org/) and
[Google Rich Results Test](https://search.google.com/test/rich-results). Check
Schema.org types, properties, reference IDs and errors. Record Google's actual
detected items and findings: a valid graph is not a guarantee of a rich result,
and “no eligible rich results” does not invalidate WebPage/Brand markup. After
deployment, repeat URL-mode validation for a parent page, a sub-brand page and
another language; verify public image URLs are accessible.

Validation on 2026-11-18 used the actual JSON-LD script extracted from the local
production frontend's CMS-backed E2E page, in code-snippet mode. Schema Markup
Validator resolved the WebPage and its linked WebSite, Organization and Brand
with **0 errors and 0 warnings**. Google Rich Results Test reported **“No items
detected”**; no Google rich-result eligibility is claimed. This was a markup
check with local canonical URLs, not a crawlability check of deployed pages.

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
