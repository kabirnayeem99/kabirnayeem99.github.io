# .githooks

The repo's git hooks: the local gate for every commit and push. Pull requests (all groups) and deploys (app and site) run the same
checks with `npm run verify`; the list lives only in `astro/scripts/verify.ts`.

| Hook | Runs |
|---|---|
| `pre-commit` | Auto-fixes the staged files (Prettier for `src/data/**/*.json`, `eslint --fix`, `stylelint --fix`, `ruff format`) and re-stages them, then `npm run verify -- --app`. Adds `--python` when files under `scripts/` are staged, and `--shell` when `.githooks/`, `.shellcheckrc` or `.editorconfig` are. Without `uv` the commit fails if Python files (`*.py`, `pyproject.toml`, `uv.lock`) are staged, and otherwise skips the Python checks with a warning. |
| `pre-push` | `npm run verify -- --site` (build, then smoke, accessibility, visual and size-budget checks), then the global `pre-push` (Git LFS). |
| `commit-msg` | Subject ≤ 72 chars, Conventional Commits, types `fix feat refactor perf chore build`. |
| `post-checkout`, `post-commit`, `post-merge` | Hand over to the global hook of the same name (Git LFS). |

A staged file that also has unstaged edits is checked but not auto-fixed, so the fix can't
sweep those edits into the commit.

## Setup

`npm ci` (or `npm install`) in `astro/` runs the `prepare` script, which sets
`core.hooksPath` to `.githooks` for this clone. By hand:

```bash
git config core.hooksPath .githooks
```

The checks need [uv](https://docs.astral.sh/uv/), ShellCheck and shfmt
(`brew install uv shellcheck shfmt`) and Chromium (`npx playwright install chromium` in
`astro/`).

Skip once with `git commit --no-verify` / `git push --no-verify`.

## Changing a hook

Every hook answers `-h`/`--help` and exits with 0 (passed), 1 (failed) or 2 (usage error).
They are bash that also runs on macOS's 3.2; shared helpers are in `lib.sh`. Keep them clean
under [ShellCheck](https://www.shellcheck.net) (settings in `.shellcheckrc`) and
[shfmt](https://github.com/mvdan/sh) (settings in `.editorconfig`):

```bash
cd astro && npm run verify -- --shell
```

A check command run through `run_check` reads `/dev/null`, which leaves `pre-push`'s stdin
(the ref list) for Git LFS.
