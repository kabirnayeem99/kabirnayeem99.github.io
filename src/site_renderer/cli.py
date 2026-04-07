"""Command-line entrypoint logic for the static renderer."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from .constants import DEFAULT_CONTENT_PATH, DEFAULT_ROOT, LANGS, PAGE_IDS, Lang, PageId
from .models import CliArgs, ContentSchemaError
from .outputs import render_outputs, stale_outputs, write_outputs
from .parsing import load_site_content, parse_lang, parse_page_id

def emit_error(message: str) -> None:
    """Write one diagnostic line to stderr."""

    print(message, file=sys.stderr)


def parse_cli_args(argv: Sequence[str] | None) -> CliArgs:
    """Build and parse CLI arguments."""

    parser = argparse.ArgumentParser(
        description="Render the portfolio site from content/site-content.json.",
    )
    _ = parser.add_argument(
        "--content",
        default=str(DEFAULT_CONTENT_PATH),
        help="JSON content file to read, or '-' to read from stdin.",
    )
    _ = parser.add_argument(
        "--root",
        default=str(DEFAULT_ROOT),
        help="Repository root where HTML outputs will be written.",
    )
    _ = parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write files. Print stale output paths and exit 1 if any differ.",
    )
    _ = parser.add_argument(
        "--page",
        action="append",
        choices=PAGE_IDS,
        help="Render only the selected page id. Repeat to render multiple pages.",
    )
    _ = parser.add_argument(
        "--lang",
        action="append",
        choices=LANGS,
        help="Render only the selected language. Repeat to render multiple languages.",
    )
    _ = parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print rendered output paths to stderr.",
    )
    return parser.parse_args(argv, namespace=CliArgs())


def freeze_pages(values: Sequence[str] | None) -> frozenset[PageId] | None:
    """Convert an optional CLI list into a typed frozen page set."""

    if values is None:
        return None
    return frozenset(parse_page_id(value, "--page") for value in values)


def freeze_langs(values: Sequence[str] | None) -> frozenset[Lang] | None:
    """Convert an optional CLI list into a typed frozen language set."""

    if values is None:
        return None
    return frozenset(parse_lang(value, "--lang") for value in values)


def run(argv: Sequence[str] | None = None, *, stdin: TextIO = sys.stdin) -> int:
    """Run the renderer and return a process exit status."""

    args = parse_cli_args(argv)
    root = Path(args.root).resolve()
    try:
        content = load_site_content(args.content, stdin)
    except (ContentSchemaError, OSError) as error:
        emit_error(f"render_site.py: {error}")
        return 2

    try:
        outputs = render_outputs(
            content,
            root=root,
            page_filter=freeze_pages(args.page),
            lang_filter=freeze_langs(args.lang),
        )
    except OSError as error:
        emit_error(f"render_site.py: failed to read build assets: {error}")
        return 2

    if args.check:
        stale = stale_outputs(root, outputs)
        for relative_path in stale:
            print(relative_path)
        return 1 if stale else 0

    try:
        write_outputs(root, outputs)
    except OSError as error:
        emit_error(f"render_site.py: failed to write outputs: {error}")
        return 3

    if args.verbose:
        for relative_path in sorted(outputs):
            emit_error(f"rendered {relative_path}")

    return 0


def main() -> int:
    """Entry point used by the shebang and direct Python execution."""

    return run()


