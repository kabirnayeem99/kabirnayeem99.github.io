# PersonPortfolio

Multilingual portfolio site built and deployed with Astro.

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
