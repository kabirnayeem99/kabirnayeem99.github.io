# Goodreads Snapshot Updater

Typed Python utility to refresh:
- `astro/src/data/site-content/goodreads-snapshot.json`
- `astro/public/assets/images/goodreads/`

## Why this exists

The site renders local snapshot data first, then optionally refreshes live Goodreads data in the browser.
This script lets you regenerate the local snapshot/covers safely whenever you want.

## Safety behavior

- If any network/parse/download step fails, existing snapshot and images are preserved.
- Files are only replaced after all new data is downloaded and assembled successfully.

## Setup

Install [uv](https://docs.astral.sh/uv/) once (`brew install uv`). Both scripts declare Pillow as
inline script metadata (PEP 723) with a `uv run --script` shebang, so uv provisions a cached
environment on first run. No manual `pip install` needed.

## Run

From repo root:

```bash
scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

Without uv, fall back to `pip install -r scripts/goodreads_snapshot/requirements.txt` and
`python3 scripts/goodreads_snapshot/update_goodreads_snapshot.py`.

Every downloaded cover is re-encoded to WebP before it's written to
`astro/public/assets/images/goodreads/`, so local cover files always have a `.webp` extension.

Data comes from the Goodreads RSS shelf feed (`review/list_rss`), paginated automatically to
pull the full shelf. The feed key is baked in as a default; override it with `--rss-key` or the
`GOODREADS_RSS_KEY` env var if it ever needs to change.

Optional flags:

```bash
scripts/goodreads_snapshot/update_goodreads_snapshot.py \
  --user-id 45514357 \
  --shelf read \
  --timeout-seconds 20
```

## Lint / Type-check (optional)

If you have `ruff` and `mypy` installed:

```bash
ruff check scripts/goodreads_snapshot/update_goodreads_snapshot.py
mypy --config-file scripts/goodreads_snapshot/pyproject.toml scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

