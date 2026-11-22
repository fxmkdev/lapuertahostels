# Contributing

This workspace uses squash merges to `main`. The squash commit message should
come from the pull request title, so PR title quality matters.

## Workspace Setup

Use Node 26.13.1 or newer within Node 26 and the exact pnpm version pinned in
`package.json`. Install native pnpm through npm, then install dependencies:

```bash
npm install -g --allow-scripts=pnpm "$(node -p 'require("./package.json").packageManager.split("+")[0]')"
pnpm --version
pnpm install --frozen-lockfile
```

If an existing Corepack shim owns the `pnpm` command, run
`corepack disable pnpm` before installing native pnpm. CI reads the same
manifest pin through `pnpm/action-setup`; Docker installs it through npm.
Neither requires Corepack. Project pnpm settings, overrides, patch declarations,
and dependency build approvals live in `pnpm-workspace.yaml`. Keep all workspace
`packageManager` fields synchronized when upgrading pnpm, and include `patches/`
in Docker builds. See the [pnpm 12 verification report](docs/pnpm-12-upgrade.md)
for migration details and measured install times.

## Starting New Work

Before starting any new work, run `git fetch origin` and base new branches and
worktrees on the freshly fetched `origin/main`, rather than local `main`:

```bash
git fetch origin
git switch -c codex/<task-name> origin/main
```

Replace `<task-name>` with a descriptive name for the task. New work means
starting a new task or branch, not every resumed agent turn. If fetching fails,
report the failure before proceeding from an unverified base.

When continuing an existing PR, stay on its branch. This rule does not require
resetting that branch or discarding local changes.

## Pull Request Title Convention

All pull request titles must follow Conventional Commits:

`<type>(optional-scope): <description>`

Examples:

- `feat(frontend): add location gallery block`
- `fix(cms): prevent invalid room list configuration`
- `docs: clarify local development setup`
- `chore(infra): update deployment settings`

Recommended types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `ci`
- `build`
- `perf`

## Commit Messages Inside the PR

Commits inside a pull request can stay descriptive for review flow and do not
need to be strictly Conventional Commit formatted.

## Pull Request Description Workflow

- Prefer `gh pr create --body-file <path>` over `--body` to avoid shell
  escaping/newline formatting issues in PR descriptions.
- Prefer `gh pr edit --body-file <path>` for updates.
- If `gh pr edit` fails with a GraphQL error mentioning `projectCards`
  deprecation, update the body through REST:
  `gh api -X PATCH repos/<owner>/<repo>/pulls/<number> -f body="$(cat <path>)"`.

## Scope Guidance

- Use an app or area scope when helpful, such as `frontend`, `cms`, `e2e`,
  `infra`, or `docs`.
- Keep descriptions concise, imperative, and behavior-focused.

## Runtime and Typings Policy

- Keep `@types/node` on the Node 26 line until the next runtime migration is
  scheduled.

## TypeScript Imports

Frontend `typecheck` uses native TypeScript 7; `typecheck:ts6` is the explicit
fallback. The frontend's `typescript` dependency supplies the TypeScript 6 API
for ESLint and framework tooling. Keep this separation when updating compiler
dependencies; CMS, shared libraries, and E2E retain TypeScript 6. See the
[adoption report](docs/typescript-7-pilot.md) for the decision, validation, and
historical pilot measurements. Removing TS6 across the workspace is a separate
migration.

Frontend and CMS TypeScript files must mark imports used only as types with
`import type` or an inline `type` modifier. Prefer separate `import type`
declarations when a module supplies both types and runtime values. ESLint's
`@typescript-eslint/consistent-type-imports` rule requires type-only imports and
uses separate declarations when automatically fixing mixed imports; existing
inline `type` modifiers also satisfy the rule.

## Review Comment Workflow

- If the current Codex/chat thread is linked to an open pull request, push newly
  applied changes to that PR branch unless explicitly instructed otherwise.
- After you address a pull request comment, resolve that conversation in the PR.

## Documentation Expectations

- Update relevant docs when introducing new behavior or conventions.
- Keep shared workspace docs at the repository root or in `docs/` if a shared
  docs directory is introduced later.
- Keep app/package docs alongside code, for example in an app-local `docs/`
  folder.
