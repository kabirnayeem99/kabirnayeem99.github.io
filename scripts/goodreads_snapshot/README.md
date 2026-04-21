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

## Run

From repo root:

```bash
python3 scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

Optional flags:

```bash
python3 scripts/goodreads_snapshot/update_goodreads_snapshot.py \
  --num-books 300 \
  --timeout-seconds 20
```

## Lint / Type-check (optional)

If you have `ruff` and `mypy` installed:

```bash
ruff check scripts/goodreads_snapshot/update_goodreads_snapshot.py
mypy --config-file scripts/goodreads_snapshot/pyproject.toml scripts/goodreads_snapshot/update_goodreads_snapshot.py
```

