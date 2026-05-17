# Contributing

This workspace uses squash merges to `main`. The squash commit message should
come from the pull request title, so PR title quality matters.

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

- Keep `@types/node` on the Node 24 line until the next runtime migration is
  scheduled.

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
