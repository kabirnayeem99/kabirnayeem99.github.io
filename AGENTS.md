# AGENTS.md

Repository guidance for AI/code agents.

## Agent index

- `.claude/agents/writing-translation-localization.md` - writing, rewriting, translation, localization, style adaptation, and website/article rewrites
- `.codex/agents`, `.gemini/agents`, and `.opencode/agents` should mirror `.claude/agents`

## Stack and scope

- The site is Astro-only; `scripts/` holds Python maintenance tools.
- Do not re-introduce Python rendering or legacy root HTML generation.
- Source of truth lives under `astro/`.
- TypeScript only, strictest settings. Node runs `astro/scripts` and `astro/tests` directly, so
  they (and what they import) use erasable syntax and `.ts` extensions, with
  `with { type: "json" }` on JSON imports.
- Scripts delivered as text (`src/inline/`, `src/sw/`) are compiled by
  `scripts/compile-script.ts`; `src/inline/` must stay lowerable to ES5 (`var`, no classes).
- An `eslint-disable` comment needs a reason after `--`.

## Key paths

- App/pages/components: `astro/src`
- Content data: `astro/src/data/site-content/`
- Public assets: `astro/public/assets`
- Styles: `astro/src/styles/` (entry `index.css`); `public/assets/css/styles.css` is generated, never edit it
- Workflow configs: `.github/workflows`

## Done means verified

From `astro/`, after `npm ci` (which also points git at `.githooks/`):

```bash
npm run verify              # everything; the same command CI and deploy run
npm run verify -- --app     # fast: lint, CSS lint, format, types, unused code, unit tests
npm run verify -- --help    # the other groups: --python, --shell, --site
```

A change is not done until `npm run verify` passes. The list of checks lives only in
`astro/scripts/verify.ts`. The git hooks run `--app` (plus `--python` / `--shell` when those
files are staged) on commit and `--site` on push. See `.githooks/README.md`.

## Rules

- No `as` casts (`as const` is fine), `any`, non-null assertions, `# type: ignore` or lint
  disables to get past a check. Validate the data instead (Zod schemas in
  `src/lib/content-schema.ts`, guards in `src/scripts/modules/guards.ts`). If a disable is
  truly unavoidable, state why on the same line (`eslint-disable-next-line rule -- reason`,
  `# noqa: CODE` with a comment above).
- Do not loosen a compiler flag, lint rule, accessibility allow-list or size budget to make a
  change pass. Ask first.
- CSS: edit `astro/src/styles/` only (entry `index.css`). `public/assets/css/styles.css` is
  generated and untracked.
- Content: every JSON file under `src/data` has a schema; add the field to the schema and to
  all four languages.
- Visual changes: screenshot the affected pages at desktop (1440) and phone (390) width, light
  and dark, and look at them. If the change is intended, run `npm run test:visual:update` and
  commit the new baselines (macOS only for now; Linux skips the screenshot comparison).
- Scripts: `-h`/`--help` that does nothing else, long `--kebab-case` flags, diagnostics on
  stderr, exit status 0 done, 1 failed, 2 usage error.
- Python (`scripts/`): uv, Ruff and ty, configured in `scripts/pyproject.toml`.
- Shell: Bash that runs on 3.2, clean under `.shellcheckrc` and `shfmt`.
- Secrets come from the environment (`GOODREADS_RSS_KEY`), never from the repo.

## Deployment

- GitHub Pages deploys from `astro/dist`.
- Keep route stability for public pages:
  - `/index.html`
  - `/work.html`
  - `/project.html`
  - `/blog.html`
  - `/stats.html`
  - localized pages in `/bn`, `/ar`, `/ur`
