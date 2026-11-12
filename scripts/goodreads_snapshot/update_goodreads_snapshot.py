#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10"]
# ///
"""Fetch Goodreads RSS shelf data and atomically refresh local snapshot assets.

Source: the RSS shelf feed (full shelf, with read dates). If the feed is unavailable
(Goodreads has returned 404 for it), the script falls back to the public grid widget
the site itself uses: newest ~200 books, no read dates. The fallback merges into the
existing snapshot - known books keep their dates and place, new books go on top undated.

This script is intentionally fail-safe:
- It never mutates the existing snapshot JSON or image folder until every fetch/download succeeds.
- If any step fails, current files remain untouched.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit(
        "Pillow is required to convert cover images to WebP.\n"
        "Run it directly (uv), or: pip install -r scripts/goodreads_snapshot/requirements.txt"
    ) from exc


DEFAULT_USER_ID = "45514357"
DEFAULT_SHELF = "read"
DEFAULT_RSS_KEY = "vczeXplDHew9rE4s_wldedzW9hHtIKtz82vXO2kqmwmXaDlI"
RSS_KEY_ENV_VAR = "GOODREADS_RSS_KEY"
RSS_PAGE_SIZE = 200
# The grid widget never returns more than ~200 books, whatever num_books asks for.
WIDGET_NUM_BOOKS = 300
SOURCES = ("auto", "rss", "widget")
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SNAPSHOT_PATH = REPO_ROOT / "astro/src/data/site-content/goodreads-snapshot.json"
DEFAULT_IMAGES_DIR = REPO_ROOT / "astro/public/assets/images/goodreads"
DEFAULT_TIMEOUT_SECONDS = 20


class SnapshotUpdateError(RuntimeError):
    """Raised when snapshot generation fails."""


@dataclass(frozen=True, slots=True)
class BookEntry:
    title: str
    href: str
    alt: str
    image_url: str
    image_local: str
    image_file_name: str
    read_at: datetime | None


def _build_rss_url(user_id: str, rss_key: str, shelf: str, page: int) -> str:
    query = urlencode({"key": rss_key, "shelf": shelf, "per_page": RSS_PAGE_SIZE, "page": page})
    return f"https://www.goodreads.com/review/list_rss/{user_id}?{query}"


def _http_get_text(url: str, timeout_seconds: int) -> str:
    request = Request(
        url=url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; PersonPortfolioGoodreadsUpdater/1.0)",
            "Accept": "*/*",
        },
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body: bytes = response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise SnapshotUpdateError(f"Failed to fetch URL: {url}\n{exc}") from exc
    return body.decode("utf-8", errors="replace")


def _safe_slug(value: str, max_length: int = 60) -> str:
    lowered = value.lower().strip()
    ascii_only = lowered.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return slug[:max_length] or "book"


def _item_text(item: ET.Element, tag: str) -> str:
    node = item.find(tag)
    return (node.text or "").strip() if node is not None else ""


def _parse_rss_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _parse_rss_items(rss_xml: str) -> list[BookEntry]:
    try:
        root = ET.fromstring(rss_xml)
    except ET.ParseError as exc:
        raise SnapshotUpdateError(f"Failed to parse Goodreads RSS feed: {exc}") from exc

    books: list[BookEntry] = []
    for item in root.iterfind("./channel/item"):
        title = _item_text(item, "title")
        href = _item_text(item, "link")
        book_id = _item_text(item, "book_id")
        image_url = _item_text(item, "book_large_image_url") or _item_text(
            item, "book_medium_image_url"
        )

        if not title or not href or not image_url:
            continue

        # Keyed by Goodreads' own book id (not shelf position), so re-running the script
        # never renames an unchanged book's cover. Every cover is re-encoded to WebP.
        book_id = book_id or hashlib.sha1(image_url.encode("utf-8")).hexdigest()[:10]
        file_name = f"{book_id}-{_safe_slug(title)}.webp"

        # RSS shelf order is "date added", not "date read" - match the live grid widget
        # (sort=date_read&order=d) by sorting on user_read_at ourselves. Books logged as
        # read without a specific date fall back to when they were added to the shelf.
        read_at = _parse_rss_date(_item_text(item, "user_read_at")) or _parse_rss_date(
            _item_text(item, "user_date_added")
        )

        books.append(
            BookEntry(
                title=title,
                href=href,
                alt=title,
                image_url=image_url,
                image_local=f"/assets/images/goodreads/{file_name}",
                image_file_name=file_name,
                read_at=read_at,
            )
        )

    return books


def _fetch_all_books(
    user_id: str, rss_key: str, shelf: str, timeout_seconds: int
) -> tuple[list[BookEntry], int]:
    books: list[BookEntry] = []
    page = 1
    while True:
        page_url = _build_rss_url(user_id, rss_key, shelf, page)
        page_xml = _http_get_text(page_url, timeout_seconds=timeout_seconds)
        page_books = _parse_rss_items(page_xml)
        books.extend(page_books)

        # A page short of a full RSS_PAGE_SIZE batch means there's nothing left to
        # fetch - a partial batch can only happen on the last page.
        if len(page_books) < RSS_PAGE_SIZE:
            break
        page += 1

    if not books:
        raise SnapshotUpdateError("No books were parsed from Goodreads RSS feed.")

    # Latest read first, matching the live grid widget's sort=date_read&order=d.
    # Undated books (read_at is None) sort last, in their original RSS order.
    books.sort(key=lambda book: book.read_at or datetime.min.replace(tzinfo=UTC), reverse=True)
    return books, page



def _build_widget_url(user_id: str, shelf: str) -> str:
    query = urlencode(
        {
            "cover_size": "medium",
            "hide_link": "",
            "hide_title": "true",
            "num_books": WIDGET_NUM_BOOKS,
            "order": "d",
            "shelf": shelf,
            "sort": "date_read",
            "widget_id": "snapshot",
        }
    )
    return f"https://www.goodreads.com/review/grid_widget/{user_id}?{query}"


# One JS string literal on one line: `var widget_code = '...'` (no trailing semicolon).
_WIDGET_CODE = re.compile(r"var widget_code = '(.*?)(?<!\\)';?[ \t]*$", re.M)
_JS_ESCAPE = re.compile(r"\\(u[0-9a-fA-F]{4}|.)", re.S)
_WIDGET_BOOK = re.compile(
    r'<a title="(?P<title>[^"]*)"[^>]*href="(?P<href>[^"]+)"[^>]*>\s*'
    r'<img alt="(?P<alt>[^"]*)"[^>]*src="(?P<src>[^"]+)"',
    re.S,
)
# Cover URLs end in /books/<timestamp><size>/<book id>[._SX98_].jpg
_COVER_BOOK_ID = re.compile(r"/books/\d+[a-z]/(\d+)")
_COVER_SIZE_SUFFIX = re.compile(r"\._S[XY]\d+_(?=\.\w+$)")
_REVIEW_ID = re.compile(r"/review/show/(\d+)")


def _unescape_js(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        token = match.group(1)
        if token.startswith("u") and len(token) == 5:
            return chr(int(token[1:], 16))
        return {"n": "\n", "t": "\t", "r": ""}.get(token, token)

    return _JS_ESCAPE.sub(replace, value)


def _parse_widget_books(widget_js: str) -> list[BookEntry]:
    match = _WIDGET_CODE.search(widget_js)
    if match is None:
        raise SnapshotUpdateError("Goodreads widget response had no widget_code.")
    markup = _unescape_js(match.group(1))

    books: list[BookEntry] = []
    for item in _WIDGET_BOOK.finditer(markup):
        title = html.unescape(item.group("title")).strip()
        href = html.unescape(item.group("href")).strip()
        image_url = _COVER_SIZE_SUFFIX.sub("", html.unescape(item.group("src")).strip())
        if not title or not href or not image_url:
            continue
        id_match = _COVER_BOOK_ID.search(image_url)
        book_id = id_match.group(1) if id_match else hashlib.sha1(image_url.encode("utf-8")).hexdigest()[:10]
        file_name = f"{book_id}-{_safe_slug(title)}.webp"
        books.append(
            BookEntry(
                title=title,
                href=href,
                alt=html.unescape(item.group("alt")).strip() or title,
                image_url=image_url,
                image_local=f"/assets/images/goodreads/{file_name}",
                image_file_name=file_name,
                read_at=None,
            )
        )
    return books


def _review_id(href: str) -> str | None:
    match = _REVIEW_ID.search(href)
    return match.group(1) if match else None


def _load_existing_books(snapshot_path: Path) -> list[BookEntry]:
    if not snapshot_path.is_file():
        return []
    try:
        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SnapshotUpdateError(f"Failed to read existing snapshot: {exc}") from exc

    books: list[BookEntry] = []
    for raw in payload.get("books", []):
        date_read = raw.get("dateRead")
        read_at = None
        if isinstance(date_read, str) and date_read:
            try:
                read_at = datetime.fromisoformat(date_read.replace("Z", "+00:00"))
            except ValueError:
                read_at = None
        books.append(
            BookEntry(
                title=raw["title"],
                href=raw["href"],
                alt=raw.get("alt") or raw["title"],
                image_url=raw["imageUrl"],
                image_local=raw["imageLocal"],
                image_file_name=raw["imageFileName"],
                read_at=read_at,
            )
        )
    return books


def _fetch_widget_books(
    user_id: str, shelf: str, snapshot_path: Path, timeout_seconds: int
) -> tuple[list[BookEntry], int]:
    """Newest books from the widget, merged over the existing snapshot.

    The widget is capped (~200) and carries no read dates, so it cannot replace the
    snapshot: books already known (matched by review id) keep their entry, date and
    order; books the snapshot has never seen are put on top, in the widget's
    newest-first order, without a date. Returns (books, new_book_count).
    """
    widget_js = _http_get_text(_build_widget_url(user_id, shelf), timeout_seconds=timeout_seconds)
    widget_books = _parse_widget_books(widget_js)
    if not widget_books:
        raise SnapshotUpdateError("No books were parsed from the Goodreads widget.")

    existing = _load_existing_books(snapshot_path)
    known = {_review_id(book.href) for book in existing}
    new_books = [book for book in widget_books if _review_id(book.href) not in known]
    return new_books + existing, len(new_books)



# Goodreads' `book_large_image_url` can be several thousand pixels tall for some
# editions, while every cover in the grid renders at well under 200px on screen
# (see .gr_grid_book_container in styles.source.css) - without a cap, those
# editions balloon to 500KB+ per cover for zero visible benefit.
MAX_COVER_HEIGHT = 475
WEBP_QUALITY = 75

# .gr_grid_book_container img sets `aspect-ratio: 2 / 3; object-fit: cover`, so
# any pixels outside that ratio are already invisible on the page - cropping to
# it here (rather than shipping the untrimmed source and letting CSS do it)
# means we don't pay to transfer bytes nobody ever sees.
CROP_ASPECT = 2 / 3


def _fit_cover(image: Image.Image) -> Image.Image:
    """Center-crop to CROP_ASPECT, then cap the height at MAX_COVER_HEIGHT."""
    width, height = image.size
    current_ratio = width / height

    if current_ratio > CROP_ASPECT:
        new_width = round(height * CROP_ASPECT)
        left = (width - new_width) // 2
        image = image.crop((left, 0, left + new_width, height))
    elif current_ratio < CROP_ASPECT:
        new_height = round(width / CROP_ASPECT)
        top = (height - new_height) // 2
        image = image.crop((0, top, width, top + new_height))

    if image.height > MAX_COVER_HEIGHT:
        new_width = round(image.width * MAX_COVER_HEIGHT / image.height)
        image = image.resize((new_width, MAX_COVER_HEIGHT), Image.LANCZOS)

    return image


def _convert_to_webp(content: bytes, url: str, quality: int = WEBP_QUALITY) -> bytes:
    try:
        with Image.open(BytesIO(content)) as image:
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            image = _fit_cover(image)
            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=quality, method=6)
            return buffer.getvalue()
    except Exception as exc:
        raise SnapshotUpdateError(f"Failed to convert image to WebP: {url}\n{exc}") from exc


def _reuse_cover(existing: Path, destination: Path) -> bool:
    """Copy an already-downloaded cover into place for this run.

    Older snapshots (or covers swapped in by hand, e.g. via
    prepare_book_cover.py) may predate the crop/size rules above - a file
    already cropped to CROP_ASPECT and within MAX_COVER_HEIGHT stays a
    byte-for-byte copy; anything else gets re-encoded to match. Returns True
    if the file was re-encoded rather than copied as-is.
    """
    with Image.open(existing) as image:
        width, height = image.size
        already_fitted = height <= MAX_COVER_HEIGHT and width == round(height * CROP_ASPECT)
        if already_fitted:
            shutil.copy2(existing, destination)
            return False

        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image = _fit_cover(image)
        image.save(destination, format="WEBP", quality=WEBP_QUALITY, method=6)
    return True


def normalize_images_dir(images_dir: Path) -> tuple[int, int]:
    """Re-encode every cover already on disk to the current crop/size rules,
    without touching the snapshot JSON or fetching anything from Goodreads.

    Returns (unchanged_count, normalized_count).
    """
    unchanged = 0
    normalized = 0

    with tempfile.TemporaryDirectory(prefix="goodreads-images-normalize-") as temp_root_str:
        temp_images_dir = Path(temp_root_str) / "goodreads-images"
        temp_images_dir.mkdir(parents=True, exist_ok=True)

        for existing in sorted(images_dir.glob("*.webp")):
            destination = temp_images_dir / existing.name
            if _reuse_cover(existing, destination):
                normalized += 1
            else:
                unchanged += 1

        _atomic_replace_dir(new_dir=temp_images_dir, target_dir=images_dir)

    return unchanged, normalized


def _download_image(url: str, destination: Path, timeout_seconds: int) -> None:
    request = Request(
        url=url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; PersonPortfolioGoodreadsUpdater/1.0)",
            "Accept": "image/*,*/*;q=0.8",
            "Referer": "https://www.goodreads.com/",
        },
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            content = response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise SnapshotUpdateError(f"Failed to download image: {url}\n{exc}") from exc

    if not content:
        raise SnapshotUpdateError(f"Downloaded empty image: {url}")

    destination.write_bytes(_convert_to_webp(content, url))


def _snapshot_payload(books: list[BookEntry]) -> dict[str, Any]:
    return {
        "generatedAt": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "books": [
            {
                "title": book.title,
                "href": book.href,
                "alt": book.alt,
                "imageUrl": book.image_url,
                "imageLocal": book.image_local,
                "imageFileName": book.image_file_name,
                "dateRead": book.read_at.isoformat().replace("+00:00", "Z")
                if book.read_at is not None
                else None,
            }
            for book in books
        ],
    }


def _atomic_replace_dir(new_dir: Path, target_dir: Path) -> None:
    target_parent = target_dir.parent
    backup_dir = target_parent / f".{target_dir.name}.backup"

    if backup_dir.exists():
        shutil.rmtree(backup_dir)

    if target_dir.exists():
        target_dir.rename(backup_dir)

    try:
        new_dir.rename(target_dir)
    except Exception as exc:  # pragma: no cover - rollback safety path
        if target_dir.exists():
            shutil.rmtree(target_dir)
        if backup_dir.exists():
            backup_dir.rename(target_dir)
        raise SnapshotUpdateError(f"Failed to replace image directory atomically: {exc}") from exc
    else:
        if backup_dir.exists():
            shutil.rmtree(backup_dir)


def update_snapshot(
    user_id: str,
    rss_key: str,
    shelf: str,
    snapshot_path: Path,
    images_dir: Path,
    timeout_seconds: int,
    source: str = "auto",
) -> tuple[int, str, int, int, int, int, str]:
    books: list[BookEntry] | None = None
    pages_fetched = 0
    source_url = ""
    source_note = ""

    if source in ("auto", "rss"):
        try:
            if not rss_key:
                raise SnapshotUpdateError(
                    f"Missing Goodreads RSS key. Pass --rss-key or set {RSS_KEY_ENV_VAR}."
                )
            books, pages_fetched = _fetch_all_books(
                user_id, rss_key, shelf, timeout_seconds=timeout_seconds
            )
            source_url = _build_rss_url(user_id, rss_key, shelf, page=1)
            source_note = "rss"
        except SnapshotUpdateError as exc:
            if source == "rss":
                raise
            print(f"[goodreads-snapshot] RSS unavailable, falling back to the grid widget.\n  {exc}")

    if books is None:
        books, new_count = _fetch_widget_books(
            user_id, shelf, snapshot_path, timeout_seconds=timeout_seconds
        )
        pages_fetched = 1
        source_url = _build_widget_url(user_id, shelf)
        source_note = f"widget ({new_count} new, undated; existing books and dates kept)"

    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    images_dir.parent.mkdir(parents=True, exist_ok=True)

    downloaded_count = 0
    reused_count = 0
    normalized_count = 0

    with tempfile.TemporaryDirectory(prefix="goodreads-snapshot-") as temp_root_str:
        temp_root = Path(temp_root_str)
        temp_images_dir = temp_root / "goodreads-images"
        temp_images_dir.mkdir(parents=True, exist_ok=True)

        for book in books:
            destination = temp_images_dir / book.image_file_name
            # Cover images are keyed by Goodreads' own book id, so an unchanged book's
            # file name never changes - if it's already on disk from a previous run,
            # reuse it instead of re-fetching and re-encoding the same cover.
            existing = images_dir / book.image_file_name
            if existing.is_file():
                if _reuse_cover(existing, destination):
                    normalized_count += 1
                else:
                    reused_count += 1
                continue

            _download_image(
                url=book.image_url,
                destination=destination,
                timeout_seconds=timeout_seconds,
            )
            downloaded_count += 1

        payload = _snapshot_payload(books)
        temp_snapshot = temp_root / "goodreads-snapshot.json"
        temp_snapshot.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        # Atomic-ish commit phase: only now mutate working files.
        temp_snapshot.replace(snapshot_path)
        _atomic_replace_dir(new_dir=temp_images_dir, target_dir=images_dir)

    return len(books), source_url, downloaded_count, reused_count, normalized_count, pages_fetched, source_note


def _parse_args() -> tuple[str, str, str, Path, Path, int, bool, str]:
    import argparse

    parser = argparse.ArgumentParser(
        description="Refresh Goodreads snapshot JSON and cover images."
    )
    parser.add_argument("--user-id", default=DEFAULT_USER_ID, help="Goodreads user id")
    parser.add_argument(
        "--rss-key",
        default=os.environ.get(RSS_KEY_ENV_VAR, DEFAULT_RSS_KEY),
        help=f"Goodreads RSS feed key (defaults to ${RSS_KEY_ENV_VAR} or the built-in key)",
    )
    parser.add_argument("--shelf", default=DEFAULT_SHELF, help="Goodreads shelf name")
    parser.add_argument(
        "--snapshot-path",
        type=Path,
        default=DEFAULT_SNAPSHOT_PATH,
        help="Snapshot JSON output path",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help="Cover images output directory",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout per request",
    )
    parser.add_argument(
        "--source",
        choices=SOURCES,
        default="auto",
        help="auto: RSS, falling back to the grid widget if the feed fails (default); "
        "rss: RSS only; widget: grid widget only (merged into the existing snapshot).",
    )
    parser.add_argument(
        "--images-only",
        action="store_true",
        help="Re-crop/re-cap covers already on disk to the current rules, without "
        "touching the snapshot JSON or contacting Goodreads.",
    )
    args = parser.parse_args()
    return (
        args.user_id,
        args.rss_key,
        args.shelf,
        args.snapshot_path,
        args.images_dir,
        args.timeout_seconds,
        args.images_only,
        args.source,
    )


def main() -> int:
    user_id, rss_key, shelf, snapshot_path, images_dir, timeout_seconds, images_only, source = _parse_args()

    if images_only:
        unchanged, normalized = normalize_images_dir(images_dir)
        print(
            f"[goodreads-snapshot] images-only pass: {unchanged} already fitted, "
            f"{normalized} re-cropped/re-capped."
        )
        print(f"[goodreads-snapshot] images: {images_dir}")
        return 0

    try:
        count, resolved_url, downloaded_count, reused_count, normalized_count, pages_fetched, source_note = update_snapshot(
            user_id=user_id,
            rss_key=rss_key,
            shelf=shelf,
            snapshot_path=snapshot_path,
            images_dir=images_dir,
            timeout_seconds=timeout_seconds,
            source=source,
        )
    except SnapshotUpdateError as exc:
        print(f"[goodreads-snapshot] failed: {exc}")
        print("[goodreads-snapshot] existing snapshot/images were preserved.")
        return 1

    redacted_url = resolved_url.replace(rss_key, "***") if rss_key else resolved_url
    print(
        f"[goodreads-snapshot] updated successfully with {count} books "
        f"across {pages_fetched} page(s), from {source_note}."
    )
    print(
        f"[goodreads-snapshot] covers: {downloaded_count} downloaded, "
        f"{reused_count} reused from existing files, "
        f"{normalized_count} shrunk to fit the {MAX_COVER_HEIGHT}px cap."
    )
    print(f"[goodreads-snapshot] source URL (page 1 shown, all pages fetched): {redacted_url}")
    print(f"[goodreads-snapshot] snapshot: {snapshot_path}")
    print(f"[goodreads-snapshot] images: {images_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
