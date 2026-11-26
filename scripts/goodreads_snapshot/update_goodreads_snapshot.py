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

The RSS feed key is a secret: pass it in GOODREADS_RSS_KEY. Without it, the widget is used.

Progress and errors go to stderr. Exit status: 0 updated, 1 failed (files preserved),
2 usage error, 130 interrupted.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from io import BytesIO
from pathlib import Path
from typing import TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - environment guard
    _MISSING_PILLOW = (
        "Pillow is required to convert cover images to WebP.\n"
        "Run it directly (uv), or: pip install -r scripts/goodreads_snapshot/requirements.txt"
    )
    raise SystemExit(_MISSING_PILLOW) from exc


DEFAULT_USER_ID = "45514357"
DEFAULT_SHELF = "read"
RSS_KEY_ENV_VAR = "GOODREADS_RSS_KEY"
RSS_PAGE_SIZE = 200
# The grid widget never returns more than ~200 books, whatever num_books asks for.
WIDGET_NUM_BOOKS = 300
SOURCES = ("auto", "rss", "widget")
# Length of a JavaScript `uXXXX` escape, without its backslash.
JS_UNICODE_ESCAPE_LENGTH = 5
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SNAPSHOT_PATH = REPO_ROOT / "astro/src/data/site-content/goodreads-snapshot.json"
DEFAULT_IMAGES_DIR = REPO_ROOT / "astro/public/assets/images/goodreads"
DEFAULT_TIMEOUT_SECONDS = 20
USER_AGENT = "Mozilla/5.0 (compatible; PersonPortfolioGoodreadsUpdater/1.0)"


class SnapshotUpdateError(RuntimeError):
    """Raised when snapshot generation fails."""


@dataclass(frozen=True, slots=True)
class BookEntry:
    """One book on the shelf."""

    title: str
    href: str
    alt: str
    image_url: str
    image_local: str
    image_file_name: str
    read_at: datetime | None


class SnapshotBook(TypedDict):
    """A book as written to the snapshot JSON."""

    title: str
    href: str
    alt: str
    imageUrl: str
    imageLocal: str
    imageFileName: str
    dateRead: str | None


class Snapshot(TypedDict):
    """The snapshot JSON file."""

    generatedAt: str
    books: list[SnapshotBook]


def _build_rss_url(user_id: str, rss_key: str, shelf: str, page: int) -> str:
    query = urlencode({"key": rss_key, "shelf": shelf, "per_page": RSS_PAGE_SIZE, "page": page})
    return f"https://www.goodreads.com/review/list_rss/{user_id}?{query}"


def _http_get(url: str, headers: dict[str, str], timeout_seconds: int) -> bytes:
    # S310: every URL is a Goodreads https URL built here, or one Goodreads returned;
    # the scheme is checked first.
    if not url.startswith("https://"):
        message = f"Refusing to fetch a non-https URL: {url}"
        raise SnapshotUpdateError(message)
    request = Request(url=url, headers=headers)  # noqa: S310
    with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310
        return bytes(response.read())


def _http_get_text(url: str, timeout_seconds: int) -> str:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    try:
        body = _http_get(url, headers, timeout_seconds)
    except (HTTPError, URLError, TimeoutError) as exc:
        message = f"Failed to fetch URL: {url}\n{exc}"
        raise SnapshotUpdateError(message) from exc
    return body.decode("utf-8", errors="replace")


def _safe_slug(value: str, max_length: int = 60) -> str:
    lowered = value.lower().strip()
    ascii_only = lowered.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return slug[:max_length] or "book"


def _url_digest(url: str) -> str:
    """Short stable file-name id for a cover without a Goodreads book id."""
    return hashlib.sha1(url.encode("utf-8"), usedforsecurity=False).hexdigest()[:10]


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
        # S314: the feed comes from Goodreads over https, and the bundled expat limits
        # entity expansion; not worth a dependency.
        root = ET.fromstring(rss_xml)  # noqa: S314
    except ET.ParseError as exc:
        message = f"Failed to parse Goodreads RSS feed: {exc}"
        raise SnapshotUpdateError(message) from exc

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
        book_id = book_id or _url_digest(image_url)
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
        message = "No books were parsed from Goodreads RSS feed."
        raise SnapshotUpdateError(message)

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
_WIDGET_CODE = re.compile(r"var widget_code = '(.*?)(?<!\\)';?[ \t]*$", re.MULTILINE)
_JS_ESCAPE = re.compile(r"\\(u[0-9a-fA-F]{4}|.)", re.DOTALL)
_WIDGET_BOOK = re.compile(
    r'<a title="(?P<title>[^"]*)"[^>]*href="(?P<href>[^"]+)"[^>]*>\s*'
    r'<img alt="(?P<alt>[^"]*)"[^>]*src="(?P<src>[^"]+)"',
    re.DOTALL,
)
# Cover URLs end in /books/<timestamp><size>/<book id>[._SX98_].jpg
_COVER_BOOK_ID = re.compile(r"/books/\d+[a-z]/(\d+)")
_COVER_SIZE_SUFFIX = re.compile(r"\._S[XY]\d+_(?=\.\w+$)")
_REVIEW_ID = re.compile(r"/review/show/(\d+)")


def _unescape_js(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        token = str(match.group(1))
        if token.startswith("u") and len(token) == JS_UNICODE_ESCAPE_LENGTH:
            return chr(int(token[1:], 16))
        return {"n": "\n", "t": "\t", "r": ""}.get(token, token)

    return _JS_ESCAPE.sub(replace, value)


def _parse_widget_books(widget_js: str) -> list[BookEntry]:
    match = _WIDGET_CODE.search(widget_js)
    if match is None:
        message = "Goodreads widget response had no widget_code."
        raise SnapshotUpdateError(message)
    markup = _unescape_js(str(match.group(1)))

    books: list[BookEntry] = []
    for item in _WIDGET_BOOK.finditer(markup):
        title = html.unescape(str(item.group("title"))).strip()
        href = html.unescape(str(item.group("href"))).strip()
        image_url = _COVER_SIZE_SUFFIX.sub("", html.unescape(str(item.group("src"))).strip())
        if not title or not href or not image_url:
            continue
        id_match = _COVER_BOOK_ID.search(image_url)
        book_id = str(id_match.group(1)) if id_match else _url_digest(image_url)
        file_name = f"{book_id}-{_safe_slug(title)}.webp"
        books.append(
            BookEntry(
                title=title,
                href=href,
                alt=html.unescape(str(item.group("alt"))).strip() or title,
                image_url=image_url,
                image_local=f"/assets/images/goodreads/{file_name}",
                image_file_name=file_name,
                read_at=None,
            )
        )
    return books


def _review_id(href: str) -> str | None:
    match = _REVIEW_ID.search(href)
    return str(match.group(1)) if match else None


def _required_text(raw: dict[object, object], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str):
        message = f"Existing snapshot has a book without a text {key!r}."
        raise SnapshotUpdateError(message)
    return value


def _parse_snapshot_date(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _entry_from_snapshot(raw: object) -> BookEntry:
    if not isinstance(raw, dict):
        message = "Existing snapshot has a book that is not an object."
        raise SnapshotUpdateError(message)
    title = _required_text(raw, "title")
    alt = raw.get("alt")
    return BookEntry(
        title=title,
        href=_required_text(raw, "href"),
        alt=alt if isinstance(alt, str) and alt else title,
        image_url=_required_text(raw, "imageUrl"),
        image_local=_required_text(raw, "imageLocal"),
        image_file_name=_required_text(raw, "imageFileName"),
        read_at=_parse_snapshot_date(raw.get("dateRead")),
    )


def _load_existing_books(snapshot_path: Path) -> list[BookEntry]:
    if not snapshot_path.is_file():
        return []
    try:
        payload: object = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        message = f"Failed to read existing snapshot: {exc}"
        raise SnapshotUpdateError(message) from exc

    books: object = payload.get("books", []) if isinstance(payload, dict) else None
    if not isinstance(books, list):
        message = "Existing snapshot is not an object with a list of books."
        raise SnapshotUpdateError(message)
    return [_entry_from_snapshot(raw) for raw in books]


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
        message = "No books were parsed from the Goodreads widget."
        raise SnapshotUpdateError(message)

    existing = _load_existing_books(snapshot_path)
    known = {_review_id(book.href) for book in existing}
    new_books = [book for book in widget_books if _review_id(book.href) not in known]
    return new_books + existing, len(new_books)


# Goodreads' `book_large_image_url` can be several thousand pixels tall for some
# editions, while every cover in the grid renders at well under 200px on screen
# (see .gr_grid_book_container in src/styles/widgets/bookshelf.css) - without a cap, those
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
        image = image.resize((new_width, MAX_COVER_HEIGHT), Image.Resampling.LANCZOS)

    return image


def _normalized_cover(source: Image.Image) -> Image.Image:
    """`source` in a WebP-friendly mode, cropped and capped."""
    if source.mode not in ("RGB", "RGBA"):
        source = source.convert("RGBA" if "A" in source.getbands() else "RGB")
    return _fit_cover(source)


def _convert_to_webp(content: bytes, url: str, quality: int = WEBP_QUALITY) -> bytes:
    try:
        with Image.open(BytesIO(content)) as image:
            buffer = BytesIO()
            _normalized_cover(image).save(buffer, format="WEBP", quality=quality, method=6)
            return buffer.getvalue()
    except Exception as exc:
        message = f"Failed to convert image to WebP: {url}\n{exc}"
        raise SnapshotUpdateError(message) from exc


def _reuse_cover(existing: Path, destination: Path) -> bool:
    """Copy an already-downloaded cover into place for this run.

    Older snapshots (or covers swapped in by hand, e.g. via
    prepare_book_cover.py) may predate the crop/size rules above - a file
    already cropped to CROP_ASPECT and within MAX_COVER_HEIGHT stays a
    byte-for-byte copy; anything else gets re-encoded to match. Returns True
    if the file was re-encoded rather than copied as-is.
    """
    try:
        with Image.open(existing) as image:
            width, height = image.size
            already_fitted = height <= MAX_COVER_HEIGHT and width == round(height * CROP_ASPECT)
            if already_fitted:
                shutil.copy2(existing, destination)
                return False
            _normalized_cover(image).save(
                destination, format="WEBP", quality=WEBP_QUALITY, method=6
            )
    except OSError as exc:
        message = f"Failed to reuse cover: {existing}\n{exc}"
        raise SnapshotUpdateError(message) from exc
    return True


def normalize_images_dir(images_dir: Path) -> tuple[int, int]:
    """Re-encode every cover on disk to the current crop/size rules.

    The snapshot JSON is not touched and Goodreads is not contacted.

    Returns (unchanged_count, normalized_count).
    """
    unchanged = 0
    normalized = 0

    with _staging_dir(images_dir.parent) as staging:
        new_images = Path(staging) / images_dir.name
        new_images.mkdir()

        for existing in sorted(images_dir.glob("*.webp")):
            if _reuse_cover(existing, new_images / existing.name):
                normalized += 1
            else:
                unchanged += 1

        _publish(new_images, images_dir)

    return unchanged, normalized


def _download_image(url: str, destination: Path, timeout_seconds: int) -> None:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "image/*,*/*;q=0.8",
        "Referer": "https://www.goodreads.com/",
    }
    try:
        content = _http_get(url, headers, timeout_seconds)
    except (HTTPError, URLError, TimeoutError) as exc:
        message = f"Failed to download image: {url}\n{exc}"
        raise SnapshotUpdateError(message) from exc

    if not content:
        message = f"Downloaded empty image: {url}"
        raise SnapshotUpdateError(message)

    destination.write_bytes(_convert_to_webp(content, url))


def _isoformat(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _snapshot_payload(books: list[BookEntry]) -> Snapshot:
    return {
        "generatedAt": _isoformat(datetime.now(tz=UTC)),
        "books": [
            {
                "title": book.title,
                "href": book.href,
                "alt": book.alt,
                "imageUrl": book.image_url,
                "imageLocal": book.image_local,
                "imageFileName": book.image_file_name,
                "dateRead": None if book.read_at is None else _isoformat(book.read_at),
            }
            for book in books
        ],
    }


def _staging_dir(parent: Path) -> tempfile.TemporaryDirectory[str]:
    """Temporary directory next to the target, so renames never cross filesystems."""
    parent.mkdir(parents=True, exist_ok=True)
    return tempfile.TemporaryDirectory(prefix=".goodreads-staging-", dir=parent)


def _publish(new_images: Path, images_dir: Path, snapshot: tuple[Path, Path] | None = None) -> None:
    """Swap in the new cover folder and, optionally, the (new, target) snapshot JSON.

    Both change or neither does: the old folder is kept until the JSON is in place.
    """
    backup = images_dir.parent / f".{images_dir.name}.backup"
    # A run killed mid-swap leaves only the backup: restore it rather than delete it.
    if backup.exists() and not images_dir.exists():
        backup.rename(images_dir)
    if backup.exists():
        shutil.rmtree(backup)

    had_images = images_dir.exists()
    if had_images:
        images_dir.rename(backup)

    swapped = False
    try:
        new_images.rename(images_dir)
        swapped = True
        if snapshot is not None:
            new_json, target_json = snapshot
            new_json.replace(target_json)
    except BaseException as exc:  # an interrupt must roll back too
        if swapped:
            shutil.rmtree(images_dir)
        if had_images:
            backup.rename(images_dir)
        if not isinstance(exc, OSError):
            raise
        message = f"Failed to replace the snapshot files: {exc}"
        raise SnapshotUpdateError(message) from exc

    if had_images:
        shutil.rmtree(backup)


@dataclass(frozen=True, slots=True)
class Settings:
    """Where to fetch from and where to write."""

    user_id: str
    rss_key: str
    shelf: str
    snapshot_path: Path
    images_dir: Path
    timeout_seconds: int
    source: str = "auto"


@dataclass(frozen=True, slots=True)
class Fetched:
    """Books from whichever source answered."""

    books: list[BookEntry]
    pages: int
    url: str
    note: str


@dataclass(slots=True)
class CoverCounts:
    """What happened to the cover images."""

    downloaded: int = 0
    reused: int = 0
    normalized: int = 0


def _fetch_from_rss(settings: Settings) -> Fetched:
    if not settings.rss_key:
        message = f"Missing Goodreads RSS key. Set {RSS_KEY_ENV_VAR} or pass --rss-key."
        raise SnapshotUpdateError(message)
    books, pages = _fetch_all_books(
        settings.user_id,
        settings.rss_key,
        settings.shelf,
        timeout_seconds=settings.timeout_seconds,
    )
    url = _build_rss_url(settings.user_id, settings.rss_key, settings.shelf, page=1)
    return Fetched(books=books, pages=pages, url=url, note="rss")


def _fetch_from_widget(settings: Settings) -> Fetched:
    books, new_count = _fetch_widget_books(
        settings.user_id,
        settings.shelf,
        settings.snapshot_path,
        timeout_seconds=settings.timeout_seconds,
    )
    return Fetched(
        books=books,
        pages=1,
        url=_build_widget_url(settings.user_id, settings.shelf),
        note=f"widget ({new_count} new, undated; existing books and dates kept)",
    )


def _fetch(settings: Settings) -> Fetched:
    if settings.source == "widget":
        return _fetch_from_widget(settings)
    try:
        return _fetch_from_rss(settings)
    except SnapshotUpdateError as exc:
        if settings.source == "rss":
            raise
        reason = str(exc).replace(settings.rss_key, "***") if settings.rss_key else str(exc)
        _log(f"RSS unavailable, falling back to the grid widget.\n  {reason}")
    return _fetch_from_widget(settings)


def _collect_covers(settings: Settings, books: list[BookEntry], into: Path) -> CoverCounts:
    counts = CoverCounts()
    for book in books:
        destination = into / book.image_file_name
        # Cover images are keyed by Goodreads' own book id, so an unchanged book's
        # file name never changes - if it's already on disk from a previous run,
        # reuse it instead of re-fetching and re-encoding the same cover.
        existing = settings.images_dir / book.image_file_name
        if not existing.is_file():
            _download_image(book.image_url, destination, settings.timeout_seconds)
            counts.downloaded += 1
        elif _reuse_cover(existing, destination):
            counts.normalized += 1
        else:
            counts.reused += 1
    return counts


def update_snapshot(settings: Settings) -> tuple[Fetched, CoverCounts]:
    """Fetch the shelf and replace the snapshot JSON and covers together."""
    fetched = _fetch(settings)
    json_parent = settings.snapshot_path.parent

    with (
        _staging_dir(settings.images_dir.parent) as images_staging,
        _staging_dir(json_parent) as json_staging,
    ):
        new_images = Path(images_staging) / settings.images_dir.name
        new_images.mkdir()
        counts = _collect_covers(settings, fetched.books, new_images)

        new_json = Path(json_staging) / settings.snapshot_path.name
        new_json.write_text(
            json.dumps(_snapshot_payload(fetched.books), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        # Commit phase: only now mutate working files.
        _publish(new_images, settings.images_dir, (new_json, settings.snapshot_path))

    return fetched, counts


class Arguments(argparse.Namespace):
    """Typed command-line arguments."""

    user_id: str
    rss_key: str
    shelf: str
    snapshot_path: Path
    images_dir: Path
    timeout_seconds: int
    source: str
    images_only: bool


def _positive_int(value: str) -> int:
    number = int(value)
    if number <= 0:
        message = f"must be a positive integer, got {value}"
        raise argparse.ArgumentTypeError(message)
    return number


def _parse_args(argv: list[str] | None = None) -> Arguments:
    parser = argparse.ArgumentParser(
        description="Refresh the Goodreads snapshot JSON and cover images.",
        epilog=f"environment: {RSS_KEY_ENV_VAR} is the secret RSS feed key. "
        "exit status: 0 updated, 1 failed (files preserved), 2 usage error.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--user-id", default=DEFAULT_USER_ID, help="Goodreads user id (default: %(default)s)"
    )
    parser.add_argument(
        "--rss-key",
        default=os.environ.get(RSS_KEY_ENV_VAR, ""),
        help=f"RSS feed key; prefer ${RSS_KEY_ENV_VAR}, which stays out of the process list",
    )
    parser.add_argument(
        "--shelf", default=DEFAULT_SHELF, help="Goodreads shelf name (default: %(default)s)"
    )
    parser.add_argument(
        "--snapshot-path",
        type=Path,
        default=DEFAULT_SNAPSHOT_PATH,
        help="snapshot JSON output path",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help="cover images output directory",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=_positive_int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout per request (default: %(default)s)",
    )
    parser.add_argument(
        "--source",
        choices=SOURCES,
        default="auto",
        help="auto: RSS, falling back to the grid widget if the feed fails (default); "
        "rss: RSS only; widget: grid widget only (merged into the existing snapshot)",
    )
    parser.add_argument(
        "--images-only",
        action="store_true",
        help="re-crop and re-cap covers already on disk, without touching the snapshot "
        "JSON or contacting Goodreads",
    )
    return parser.parse_args(argv, namespace=Arguments())


def _log(message: str) -> None:
    """Progress and errors go to stderr; stdout stays free for data."""
    sys.stderr.write(f"[goodreads-snapshot] {message}\n")


def _run(args: Arguments) -> None:
    if args.images_only:
        unchanged, normalized = normalize_images_dir(args.images_dir)
        _log(f"images-only pass: {unchanged} already fitted, {normalized} re-cropped/re-capped.")
        _log(f"images: {args.images_dir}")
        return

    fetched, covers = update_snapshot(
        Settings(
            user_id=args.user_id,
            rss_key=args.rss_key,
            shelf=args.shelf,
            snapshot_path=args.snapshot_path,
            images_dir=args.images_dir,
            timeout_seconds=args.timeout_seconds,
            source=args.source,
        )
    )
    redacted_url = fetched.url.replace(args.rss_key, "***") if args.rss_key else fetched.url
    _log(
        f"updated successfully with {len(fetched.books)} books "
        f"across {fetched.pages} page(s), from {fetched.note}."
    )
    _log(
        f"covers: {covers.downloaded} downloaded, "
        f"{covers.reused} reused from existing files, "
        f"{covers.normalized} shrunk to fit the {MAX_COVER_HEIGHT}px cap."
    )
    _log(f"source URL (page 1 shown, all pages fetched): {redacted_url}")
    _log(f"snapshot: {args.snapshot_path}")
    _log(f"images: {args.images_dir}")


def main(argv: list[str] | None = None) -> int:
    """Run the command line; return the exit status."""
    args = _parse_args(argv)
    try:
        _run(args)
    except (SnapshotUpdateError, OSError) as exc:
        # An error can quote the feed URL, which carries the key.
        reason = str(exc).replace(args.rss_key, "***") if args.rss_key else str(exc)
        _log(f"failed: {reason}")
        _log("existing snapshot/images were preserved.")
        return 1
    except KeyboardInterrupt:
        _log("interrupted; existing snapshot/images were preserved.")
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
