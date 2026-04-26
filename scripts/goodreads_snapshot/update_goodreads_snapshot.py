#!/usr/bin/env python3
"""Fetch Goodreads widget data and atomically refresh local snapshot assets.

This script is intentionally fail-safe:
- It never mutates the existing snapshot JSON or image folder until every fetch/download succeeds.
- If any step fails, current files remain untouched.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import json
import re
import shutil
import tempfile
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


DEFAULT_WIDGET_URL = (
    "https://www.goodreads.com/review/grid_widget/"
    "45514357.Naimul's%20bookshelf:%20read"
    "?cover_size=medium&hide_link=&hide_title=true&num_books=300"
    "&order=d&shelf=read&sort=date_added&widget_id=1771265103"
)
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


def _build_widget_url(base_url: str, num_books: int) -> str:
    parsed = urlparse(base_url)
    query_items = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_items["num_books"] = str(num_books)
    new_query = urlencode(query_items, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))


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
            return response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise SnapshotUpdateError(f"Failed to fetch URL: {url}\n{exc}") from exc


def _extract_widget_html(widget_js: str) -> str:
    match = re.search(r"var widget_code = '([\s\S]*?)'\s*\n\s*var widget_div", widget_js)
    if not match:
        raise SnapshotUpdateError("Could not parse Goodreads widget payload from script response.")

    escaped = match.group(1)
    # Goodreads widget payload uses simple JS escaping.
    return (
        escaped.replace("\\n", "\n")
        .replace('\\"', '"')
        .replace("\\/", "/")
        .replace("\\'", "'")
    )


def _safe_slug(value: str, max_length: int = 60) -> str:
    lowered = value.lower().strip()
    ascii_only = lowered.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return slug[:max_length] or "book"


def _extract_extension(image_url: str) -> str:
    match = re.search(r"\.([a-zA-Z0-9]+)(?:$|[?#])", image_url)
    if not match:
        return ".jpg"
    ext = f".{match.group(1).lower()}"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg"
    return ext


def _parse_books(widget_html: str) -> list[BookEntry]:
    pattern = re.compile(
        r'<div class="gr_grid_book_container"><a title="([^"]*)"[^>]*href="([^"]*)"[^>]*>'
        r'<img alt="([^"]*)"[^>]*src="([^"]*)"[^>]*></a></div>'
    )

    books: list[BookEntry] = []
    for index, match in enumerate(pattern.finditer(widget_html), start=1):
        title = unescape(match.group(1)).strip()
        href = unescape(match.group(2)).strip()
        alt = unescape(match.group(3)).strip()
        image_url = unescape(match.group(4)).strip()

        ext = _extract_extension(image_url)
        file_name = f"{index:03d}-{_safe_slug(alt or title)}{ext}"
        books.append(
            BookEntry(
                title=title,
                href=href,
                alt=alt,
                image_url=image_url,
                image_local=f"/assets/images/goodreads/{file_name}",
                image_file_name=file_name,
            )
        )

    if not books:
        raise SnapshotUpdateError("No books were parsed from Goodreads widget HTML.")
    return books


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

    destination.write_bytes(content)


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
    widget_url: str,
    num_books: int,
    snapshot_path: Path,
    images_dir: Path,
    timeout_seconds: int,
) -> tuple[int, str]:
    if num_books <= 0:
        raise SnapshotUpdateError("--num-books must be > 0")

    final_widget_url = _build_widget_url(widget_url, num_books)
    widget_js = _http_get_text(final_widget_url, timeout_seconds=timeout_seconds)
    widget_html = _extract_widget_html(widget_js)
    books = _parse_books(widget_html)

    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    images_dir.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="goodreads-snapshot-") as temp_root_str:
        temp_root = Path(temp_root_str)
        temp_images_dir = temp_root / "goodreads-images"
        temp_images_dir.mkdir(parents=True, exist_ok=True)

        for book in books:
            _download_image(
                url=book.image_url,
                destination=temp_images_dir / book.image_file_name,
                timeout_seconds=timeout_seconds,
            )

        payload = _snapshot_payload(books)
        temp_snapshot = temp_root / "goodreads-snapshot.json"
        temp_snapshot.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        # Atomic-ish commit phase: only now mutate working files.
        temp_snapshot.replace(snapshot_path)
        _atomic_replace_dir(new_dir=temp_images_dir, target_dir=images_dir)

    return len(books), final_widget_url


def _parse_args() -> tuple[str, int, Path, Path, int]:
    import argparse

    parser = argparse.ArgumentParser(description="Refresh Goodreads snapshot JSON and cover images.")
    parser.add_argument("--widget-url", default=DEFAULT_WIDGET_URL, help="Goodreads widget URL")
    parser.add_argument("--num-books", type=int, default=300, help="Requested number of books")
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
    args = parser.parse_args()
    return (
        args.widget_url,
        args.num_books,
        args.snapshot_path,
        args.images_dir,
        args.timeout_seconds,
    )


def main() -> int:
    widget_url, num_books, snapshot_path, images_dir, timeout_seconds = _parse_args()
    try:
        count, resolved_url = update_snapshot(
            widget_url=widget_url,
            num_books=num_books,
            snapshot_path=snapshot_path,
            images_dir=images_dir,
            timeout_seconds=timeout_seconds,
        )
    except SnapshotUpdateError as exc:
        print(f"[goodreads-snapshot] failed: {exc}")
        print("[goodreads-snapshot] existing snapshot/images were preserved.")
        return 1

    print(f"[goodreads-snapshot] updated successfully with {count} books.")
    print(f"[goodreads-snapshot] source URL: {resolved_url}")
    print(f"[goodreads-snapshot] snapshot: {snapshot_path}")
    print(f"[goodreads-snapshot] images: {images_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
