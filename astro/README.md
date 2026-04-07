# Astro Migration Workspace

This folder starts Phase 1 of the migration described in `../astro_migration.md`.

## Scope in this phase

- Astro scaffold isolated in `astro/`.
- TypeScript strict mode enabled.
- GitHub Pages settings configured (`site` and `base`).
- Baseline lint rule enabled: `@typescript-eslint/no-explicit-any`.

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
