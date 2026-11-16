# AGENTS.md

Repository guidance for AI/code agents.

## Agent index

- `.claude/agents/writing-translation-localization.md` - writing, rewriting, translation, localization, style adaptation, and website/article rewrites
- `.codex/agents`, `.gemini/agents`, and `.opencode/agents` should mirror `.claude/agents`

## Stack and scope

- This repository is Astro-only.
- Do not re-introduce Python rendering or legacy root HTML generation.
- Source of truth lives under `astro/`.

## Key paths

- App/pages/components: `astro/src`
- Content data: `astro/src/data/site-content/`
- Public assets: `astro/public/assets`
- Workflow configs: `.github/workflows`

## Build and validation

Run from `astro/`:

1. `npm ci` (also points git at `.githooks/`)
2. `npm run lint` (ESLint: `.ts`, `.astro`, scripts)
3. `npm run lint:css` (Stylelint: `styles.source.css`)
4. `npm run format:check` (Prettier: `src/data/**/*.json`; `npm run format` to fix)
5. `npm run check`
6. `npm run test`
7. `npm run build`
8. `npm run test:smoke` (every page at desktop and phone width; needs the build)

The git hooks in `.githooks/` run 2–6 on commit (auto-fixing staged files first) and 7–8 on
push. See `.githooks/README.md`.

## Deployment

- GitHub Pages deploys from `astro/dist`.
- Keep route stability for public pages:
  - `/index.html`
  - `/work.html`
  - `/project.html`
  - `/blog.html`
  - `/stats.html`
  - localized pages in `/bn`, `/ar`, `/ur`
