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

## Generated CMS Types

Both generated Payload type files are committed, so frontend builds, Storybook,
and frontend/E2E typechecks can consume them immediately after installation. CMS
checking still requires generating the admin import map.

After changing the CMS schema or Payload dependencies that affect generated
output, refresh both files from the repository root:

```bash
pnpm --filter @lapuertahostels/payload-types pull-payload-types
```

Commit both generated files with the change. Do not edit or reformat them by
hand. To verify that the committed types match the current schema, run:

```bash
pnpm --filter @lapuertahostels/payload-types check-payload-types
```

This regenerates both files and compares them with `HEAD`, exiting with a diff
if either committed file is stale. CI runs this check independently of builds
and typechecks and requires it before staging or preview deployment. The
existing required E2E check also fails if verification fails, so stale types
block merging without requiring a separate branch-protection change.

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

Frontend, CMS, and E2E `typecheck` commands use native TypeScript 7. Both shared
libraries also declare TS7. Frontend and CMS keep the `typescript` compatibility
alias for the TypeScript 6 API required by ESLint and installed docgen tooling.
Next's integrated CMS build check still selects TS6 from that alias; the
separate CMS native check is also required in CI. Generate the admin import map
before running CMS checking. Keep this compiler/API separation when updating
dependencies. See the [adoption report](docs/typescript-7-pilot.md) for current
commands, exact removal blockers, validation, and historical pilot measurements.

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
