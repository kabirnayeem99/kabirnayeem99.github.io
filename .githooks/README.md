# .githooks

The repo's git hooks: the local gate for every commit and push. There is no CI gate for these;
they run on your machine.

| Hook | Runs |
|---|---|
| `pre-commit` | Auto-fixes the staged files (Prettier for `src/data/**/*.json`, `eslint --fix`, `stylelint --fix`) and re-stages them, then runs ESLint, Stylelint, the Prettier check, `astro check` and the unit tests. A staged `styles.source.css` also rebuilds and stages `styles.css`. |
| `pre-push` | Builds the site and runs the smoke test (`tests/smoke.test.mjs`: every page at desktop and phone width), then the global `pre-push` (Git LFS). |
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

Skip once with `git commit --no-verify` / `git push --no-verify`.
