# AGENTS.md

Guidance for coding agents and contributors working in this repository.

This repository is a pnpm workspace for the La Puerta Hostels website and CMS.
It includes:

- repository-wide collaboration rules
- package-specific development commands
- quality checks to run before finishing changes

## Repository-wide Guidelines

- Before starting any new work, run `git fetch origin` and base new branches and
  worktrees on the freshly fetched `origin/main`, rather than local `main`. New
  work means starting a new task or branch, not every resumed agent turn. If
  fetching fails, report the failure before proceeding from an unverified base.
  When continuing an existing PR, stay on its branch; this rule does not require
  resetting that branch or discarding local changes.
- Use `pnpm` as package manager.
- Keep changes focused and minimal; avoid unrelated refactors.
- Keep docs in sync when introducing new behavior, patterns, or conventions.
- The runtime target is Node 26. Keep `@types/node` aligned with the current
  runtime major and do not upgrade beyond Node 26 typings until the next runtime
  migration is planned.
- Pull request titles must follow Conventional Commits because squash merge
  commit messages are expected to come from the PR title.
  - Format: `<type>(optional-scope): <description>`
  - Example: `feat(frontend): add location gallery block`
  - Use descriptive commits inside the PR for review clarity; the PR title is
    the canonical squash commit message.
- When the current Codex/chat thread already has an open pull request, push any
  newly applied changes to that PR branch unless explicitly instructed
  otherwise.
- After you address a pull request review comment, resolve that conversation in
  the PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guidelines.

## Workspace Structure

- `apps/frontend`: React Router website.
- `apps/cms`: Payload CMS admin and API, built on Next.js.
- `libs/payload-types`: shared generated Payload types consumed by workspace
  packages.
- `tests/e2e`: Playwright end-to-end tests.

## Shell-sensitive Paths

React Router flat route filenames may contain shell-sensitive characters such as
`$`, `(`, `)`, `[`, and `]`. In shell commands, always treat these paths as
literals to avoid variable expansion or glob matching.

- Prefer wrapping such paths in single quotes, for example
  `cat 'apps/frontend/app/routes/$.tsx'`.
- Escape special characters only when quoting is awkward.
- For git commands, use `--` before paths, for example
  `git add -- 'apps/frontend/app/routes/$.tsx'`.

## Development Commands

```bash
pnpm --filter @lapuertahostels/frontend dev              # Start frontend dev server
pnpm --filter @lapuertahostels/frontend build            # Build frontend
pnpm --filter @lapuertahostels/frontend typecheck        # Generate React Router types and run TypeScript 7
pnpm --filter @lapuertahostels/frontend lint             # ESLint check
pnpm --filter @lapuertahostels/frontend test             # Vitest tests
pnpm --filter @lapuertahostels/frontend check-format     # Prettier check
pnpm --filter @lapuertahostels/frontend storybook        # Start Storybook
pnpm --filter @lapuertahostels/frontend build-storybook  # Build Storybook

pnpm --filter @lapuertahostels/cms dev                   # Start CMS dev server on port 3001
pnpm --filter @lapuertahostels/cms build                 # Generate admin import map and build CMS
pnpm --filter @lapuertahostels/cms typecheck             # Generate Next route types and run native TypeScript 7
pnpm --filter @lapuertahostels/cms lint                  # Next lint check
pnpm --filter @lapuertahostels/cms test                  # Vitest tests
pnpm --filter @lapuertahostels/cms check-format          # Prettier check
pnpm --filter @lapuertahostels/cms generate:types        # Generate Payload TypeScript types
pnpm --filter @lapuertahostels/cms generate:importmap    # Generate Payload admin import map

pnpm --filter @lapuertahostels/payload-types pull-payload-types # Refresh both committed Payload type files
pnpm --filter @lapuertahostels/payload-types check-payload-types # Verify committed types match the schema

pnpm --filter @lapuertahostels/e2e e2e                   # Run Playwright e2e UI
pnpm --filter @lapuertahostels/e2e typecheck             # Check E2E sources with native TypeScript 7
```

## Package Conventions

- Frontend imports from `app/` can use the `~/*` TypeScript path alias.
- Frontend route definitions are generated with `@react-router/fs-routes` from
  `apps/frontend/app/routes.ts`.
- Generated React Router type files are produced by the frontend `typecheck`
  script; do not commit generated cache/output unless already tracked and
  intentionally changed.
- Both generated Payload type files are committed:
  `apps/cms/src/payload-types.ts` and `libs/payload-types/src/payload-types.ts`.
  After schema changes or Payload dependency changes that affect generated
  types, run `pnpm --filter @lapuertahostels/payload-types pull-payload-types`
  and commit both files. Keep Payload's generated formatting; do not edit them
  by hand. Fresh checkouts do not need CMS generation before frontend or E2E
  checking. CI verifies freshness without distributing generated type artifacts.
- Keep CMS configuration and custom blocks close to `apps/cms/src/`, and keep
  frontend rendering concerns in `apps/frontend/app/`.

## Quality Checklist

- Run `pnpm --filter @lapuertahostels/frontend typecheck` when touching frontend
  TypeScript, routes, loaders, components, or shared frontend data access.
- Run `pnpm --filter @lapuertahostels/frontend lint` when touching frontend
  source.
- Run `pnpm --filter @lapuertahostels/frontend test` when touching tested
  frontend logic.
- Run `pnpm --filter @lapuertahostels/frontend check-format` when touching
  frontend formatting-sensitive files.
- Run `pnpm --filter @lapuertahostels/cms build` when touching Payload schema,
  CMS config, CMS custom components, or generated Payload artifacts.
- Run `pnpm --filter @lapuertahostels/cms typecheck` after generating the admin
  import map when touching CMS TypeScript or configuration.
- Run `pnpm --filter @lapuertahostels/cms lint` and
  `pnpm --filter @lapuertahostels/cms check-format` when touching CMS source.
- Run `pnpm --filter @lapuertahostels/cms test` when touching tested CMS logic.
- Run `pnpm --filter @lapuertahostels/payload-types pull-payload-types` after
  schema or relevant Payload dependency changes and commit both generated files.
  Run `pnpm --filter @lapuertahostels/payload-types check-payload-types` to
  verify the committed types match the schema.
- Run `pnpm --filter @lapuertahostels/e2e e2e` for changes with significant
  user-flow risk.
- Run `pnpm --filter @lapuertahostels/e2e typecheck` when touching E2E
  TypeScript.
- Update relevant docs when behavior, workflows, or conventions change.
