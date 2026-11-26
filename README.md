# PersonPortfolio

Multilingual portfolio site built and deployed with Astro.

## Workspace

- App source: `astro/src`
- Static assets: `astro/public`
- Styles: `astro/src/styles` (entry `index.css`)
- Content data: `astro/src/data/site-content/`

## Development

```bash
cd astro
npm ci
npm run dev
```

`dev`, `build` and `check` bundle `astro/src/styles` into `astro/public/assets/css/styles.css`
(generated, not tracked); `dev` rebuilds it as you edit.

## Static data refresh

Goodreads snapshot and cover images:

```bash
scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

GitHub stats snapshot:

```text
No standalone generator script is checked into this repository right now.
The bundled GitHub snapshot data used by the site lives in astro/src/scripts/modules/stats-snapshots.ts.
```

## Validation

```bash
cd astro
npm run verify # every check; --help lists the faster groups
```

## Deployment

GitHub Actions builds `astro/dist` and deploys it to GitHub Pages.
