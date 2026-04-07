# Astro Migration Workspace

This folder contains Phase 1 and the start of Phase 2 from `../astro_migration.md`.

## Scope so far

- Astro scaffold isolated in `astro/`.
- TypeScript strict mode enabled.
- GitHub Pages settings configured (`site` and `base`).
- Baseline lint rule enabled: `@typescript-eslint/no-explicit-any`.
- Legacy pages are routed through Astro with exact HTML snapshot parity for:
  - `/index.html`, `/work.html`, `/project.html`, `/blog.html`, `/stats.html`
  - `/bn/index.html`, `/bn/work.html`, `/bn/project.html`
  - `/ar/index.html`, `/ar/work.html`, `/ar/project.html`
  - `/ur/index.html`, `/ur/work.html`, `/ur/project.html`
- Static files are synced from the legacy root into `astro/public` via `npm run sync:legacy-static` (auto-runs in `predev`, `precheck`, `prebuild`).

## Commands

```bash
cd astro
npm install
npm run dev
npm run check
npm run lint
```

## Assumption

`base` is currently `/` because production URLs resolve under `https://kabirnayeem99.github.io` without a repo subpath.
