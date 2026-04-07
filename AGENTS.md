# AGENTS.md

Repository guidance for AI/code agents.

## Stack and scope

- This repository is Astro-only.
- Do not re-introduce Python rendering or legacy root HTML generation.
- Source of truth lives under `astro/`.

## Key paths

- App/pages/components: `astro/src`
- Content data: `astro/src/data/site-content.json`
- Public assets: `astro/public/assets`
- Workflow configs: `.github/workflows`

## Build and validation

Run from `astro/`:

1. `npm ci`
2. `npm run lint`
3. `npm run check`
4. `npm run test`
5. `npm run build`

## Deployment

- GitHub Pages deploys from `astro/dist`.
- Keep route stability for public pages:
  - `/index.html`
  - `/work.html`
  - `/project.html`
  - `/blog.html`
  - `/stats.html`
  - localized pages in `/bn`, `/ar`, `/ur`
