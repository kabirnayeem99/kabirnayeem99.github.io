# PersonPortfolio

Multilingual portfolio site built and deployed with Astro.

## AI tooling (lean-ctx + jcodemunch)

- Shared agent policy: `LEAN-CTX.md`
- Gemini project MCP config: `.gemini/settings.json`
- Local jCodeMunch index storage: `.code-index/`

First-time index from repo root:

```bash
CODE_INDEX_PATH="$PWD/.code-index" jcodemunch-mcp index "$PWD"
```

## Workspace

- App source: `astro/src`
- Static assets: `astro/public`
- Content data: `astro/src/data/site-content/`

## Development

```bash
cd astro
npm ci
npm run dev
```

## Static data refresh

Goodreads snapshot and cover images:

```bash
python3 scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

GitHub stats snapshot:

```text
No standalone generator script is checked into this repository right now.
The bundled GitHub snapshot data used by the site lives in astro/src/scripts/modules/stats-snapshots.ts.
```

## Validation

```bash
cd astro
npm run lint
npm run check
npm run test
npm run build
```

## Deployment

GitHub Actions builds `astro/dist` and deploys it to GitHub Pages.
