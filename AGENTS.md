# AGENTS.md

Guidance for coding agents and contributors working in this repository.

This repository is a pnpm workspace for the La Puerta Hostels website and CMS.
It includes:

- repository-wide collaboration rules
- package-specific development commands
- quality checks to run before finishing changes

## Repository-wide Guidelines

- Use `pnpm` as package manager.
- Before starting coding work, fetch and start from the latest `origin/main`.
  For existing pull request branches, rebase onto the latest `origin/main`
  before pushing updates.
- Keep changes focused and minimal; avoid unrelated refactors.
- Keep docs in sync when introducing new behavior, patterns, or conventions.
- The runtime target is Node 24. Keep `@types/node` aligned with the current
  runtime major and do not upgrade beyond Node 24 typings until the next runtime
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
pnpm --filter @lapuertahostels/frontend typecheck        # Generate React Router types and run tsc
pnpm --filter @lapuertahostels/frontend lint             # ESLint check
pnpm --filter @lapuertahostels/frontend test             # Vitest tests
pnpm --filter @lapuertahostels/frontend check-format     # Prettier check
pnpm --filter @lapuertahostels/frontend storybook        # Start Storybook
pnpm --filter @lapuertahostels/frontend build-storybook  # Build Storybook

pnpm --filter @lapuertahostels/cms dev                   # Start CMS dev server on port 3001
pnpm --filter @lapuertahostels/cms build                 # Generate Payload artifacts and build CMS
pnpm --filter @lapuertahostels/cms lint                  # Next lint check
pnpm --filter @lapuertahostels/cms check-format          # Prettier check
pnpm --filter @lapuertahostels/cms generate:types        # Generate Payload TypeScript types
pnpm --filter @lapuertahostels/cms generate:importmap    # Generate Payload admin import map

pnpm --filter @lapuertahostels/payload-types pull-payload-types # Refresh shared Payload types

pnpm --filter @lapuertahostels/e2e e2e                   # Run Playwright e2e UI
```

## Package Conventions

- Frontend imports from `app/` can use the `~/*` TypeScript path alias.
- Frontend route definitions are generated with `@react-router/fs-routes` from
  `apps/frontend/app/routes.ts`.
- Generated React Router type files are produced by the frontend `typecheck`
  script; do not commit generated cache/output unless already tracked and
  intentionally changed.
- Payload types are generated in `apps/cms/src/payload-types.ts`. Refresh the
  shared workspace package with
  `pnpm --filter @lapuertahostels/payload-types pull-payload-types` when schema
  changes need to be consumed outside the CMS.
- `@fxmk/cms-plugin` and `@fxmk/common` come from the same source repository.
  Always update them together to the same version wherever they are declared.
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
- Run `pnpm --filter @lapuertahostels/cms lint` and
  `pnpm --filter @lapuertahostels/cms check-format` when touching CMS source.
- Run `pnpm --filter @lapuertahostels/payload-types pull-payload-types` when
  Payload type changes need to be reflected in `libs/payload-types`.
- Run `pnpm --filter @lapuertahostels/e2e e2e` for changes with significant
  user-flow risk.
- Update relevant docs when behavior, workflows, or conventions change.
