"""Output assembly and filesystem write/check helpers."""

from __future__ import annotations

import datetime
from collections.abc import Mapping
from pathlib import Path

from .constants import (
    CSS_OUTPUT_RELATIVE_PATH,
    CSS_SOURCE_RELATIVE_PATH,
    MANIFEST_OUTPUT_RELATIVE_PATH,
    PAGE_IDS,
    Lang,
    PageId,
    SERVICE_WORKER_OUTPUT_RELATIVE_PATH,
    SITEMAP_OUTPUT_RELATIVE_PATH,
)
from .minify import minify_css
from .models import SiteContent
from .rendering import render_page, render_service_worker, render_sitemap, render_webmanifest


def source_timestamp(root: Path) -> datetime.datetime:
    """Return the most recent source-input timestamp in local time."""

    candidates: list[Path] = [
        root / "content/site-content.json",
        root / CSS_SOURCE_RELATIVE_PATH,
    ]
    candidates.extend((root / "assets/js").glob("*.js"))
    candidates.extend((root / "src/site_renderer").rglob("*.py"))

    latest_mtime = 0.0
    for path in candidates:
        if not path.exists():
            continue
        path_mtime = path.stat().st_mtime
        if path_mtime > latest_mtime:
            latest_mtime = path_mtime

    if latest_mtime == 0.0:
        return datetime.datetime.now().astimezone()

    return datetime.datetime.fromtimestamp(latest_mtime, tz=datetime.timezone.utc).astimezone()


def render_outputs(
    content: SiteContent,
    *,
    root: Path,
    page_filter: frozenset[PageId] | None,
    lang_filter: frozenset[Lang] | None,
) -> dict[str, str]:
    """Render selected HTML outputs plus the minified global stylesheet."""

    build_now = source_timestamp(root)
    build_date = build_now.date().isoformat()
    build_timestamp_iso = build_now.isoformat(timespec="seconds")
    build_timestamp_display = build_now.isoformat(sep=" ", timespec="seconds")
    outputs: dict[str, str] = {}

    for page_id in PAGE_IDS:
        if page_filter is not None and page_id not in page_filter:
            continue

        localized_page = content.page_for(page_id)
        for lang, route in content.routes[page_id].items():
            if lang_filter is not None and lang not in lang_filter:
                continue
            outputs[route] = render_page(
                content,
                page_id,
                lang,
                route,
                localized_page.og_type,
                build_timestamp_iso,
                build_timestamp_display,
            )

    css_source_path = root / CSS_SOURCE_RELATIVE_PATH
    css_source = css_source_path.read_text(encoding="utf-8")
    outputs[CSS_OUTPUT_RELATIVE_PATH] = minify_css(css_source)
    outputs[SITEMAP_OUTPUT_RELATIVE_PATH] = render_sitemap(content, build_date)
    outputs[MANIFEST_OUTPUT_RELATIVE_PATH] = render_webmanifest()
    outputs[SERVICE_WORKER_OUTPUT_RELATIVE_PATH] = render_service_worker(content, build_date)
    return outputs


def write_outputs(root: Path, outputs: Mapping[str, str]) -> None:
    """Write rendered outputs to disk."""

    for relative_path, rendered in outputs.items():
        output_path = root / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        _ = output_path.write_text(rendered, encoding="utf-8")


def stale_outputs(root: Path, outputs: Mapping[str, str]) -> tuple[str, ...]:
    """Return outputs whose on-disk contents differ from freshly rendered content."""

    stale: list[str] = []
    for relative_path, rendered in outputs.items():
        output_path = root / relative_path
        if not output_path.exists() or output_path.read_text(encoding="utf-8") != rendered:
            stale.append(relative_path)
    return tuple(stale)
