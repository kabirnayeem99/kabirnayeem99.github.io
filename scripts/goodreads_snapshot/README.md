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
pull the full shelf. The feed key is a secret and is not stored in the repo. Set it in the
environment (My Books -> read shelf -> RSS link at the bottom, the `key=` value):

```bash
export GOODREADS_RSS_KEY='...'
```

Without a key the script falls back to the grid widget (see below).

## Command-line conventions

All scripts here take `-h`/`--help` and long `--kebab-case` flags, write progress and errors to
stderr, and exit with 0 (done), 1 (failed) or 2 (usage error).

Optional flags:

```bash
scripts/goodreads_snapshot/update_goodreads_snapshot.py \
  --user-id 45514357 \
  --shelf read \
  --timeout-seconds 20
```

## Format, lint, type-check, test

One toolchain, configured in `scripts/pyproject.toml`: Ruff (format and lint, `ruff server` for
editors) and ty (type check, `ty server`), pinned and run through uv. From `scripts/`:

```bash
uv run ruff format --check .
uv run ruff check .
uv run ty check
uv run python -m unittest discover -s tests
```

## When the RSS feed is down

Goodreads has started returning 404 for the RSS feed. With the default `--source auto`, the
script then falls back to the public grid widget (the same one the site loads live). The widget
is capped at about 200 books and carries no read dates, so it is merged into the existing
snapshot rather than replacing it:

- books already in the snapshot (matched by review id) keep their entry, date and order;
- books the snapshot has never seen go on top, newest first, with no `dateRead`;
- nothing is removed (the widget cannot show the whole shelf).

`--source rss` disables the fallback; `--source widget` skips RSS. A fresh RSS key (My Books ->
read shelf -> RSS link at the bottom) restores full data with dates for every book.
