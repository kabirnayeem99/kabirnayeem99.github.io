#!/usr/bin/env python3
"""Unified Unix-safe entry point for site maintenance tasks."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from site_renderer.constants import DEFAULT_ROOT, LANGS, PAGE_IDS
from use_cases.check_js_types import run as run_check_js_types
from use_cases.render_site import run as run_render_site
from use_cases.validate_links import run as run_validate_links


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    """Parse command-line flags for task selection and render options."""

    parser = argparse.ArgumentParser(
        description="Run render-site, validate-links, and JS type checks from one entry point.",
    )
    _ = parser.add_argument("--render-site", action="store_true", help="Run the static site renderer.")
    _ = parser.add_argument("--validate-links", action="store_true", help="Validate local href/src references.")
    _ = parser.add_argument("--check-js-types", action="store_true", help="Run JavaScript type checks.")

    _ = parser.add_argument("--content", default=None, help="Render option: content JSON path (or '-').")
    _ = parser.add_argument("--root", default=str(DEFAULT_ROOT), help="Project root path.")
    _ = parser.add_argument("--check", action="store_true", help="Render option: check mode (no writes).")
    _ = parser.add_argument(
        "--page",
        action="append",
        choices=PAGE_IDS,
        help="Render option: page id to render. Repeat for multiple.",
    )
    _ = parser.add_argument(
        "--lang",
        action="append",
        choices=LANGS,
        help="Render option: language to render. Repeat for multiple.",
    )
    _ = parser.add_argument("--verbose", action="store_true", help="Render option: verbose output.")
    return parser.parse_args(argv)


def build_render_args(args: argparse.Namespace) -> list[str]:
    """Translate unified CLI flags into render-site CLI arguments."""

    render_args: list[str] = ["--root", args.root]
    if args.content is not None:
        render_args.extend(["--content", str(args.content)])
    if args.check:
        render_args.append("--check")
    if args.page:
        for page_id in args.page:
            render_args.extend(["--page", page_id])
    if args.lang:
        for lang_code in args.lang:
            render_args.extend(["--lang", lang_code])
    if args.verbose:
        render_args.append("--verbose")
    return render_args


def run(argv: Sequence[str] | None = None, *, stdin: TextIO = sys.stdin) -> int:
    """Run selected operations and return a process exit status."""

    args = parse_args(argv)
    if not (args.render_site or args.validate_links or args.check_js_types):
        print(
            "main.py: no operation selected. Use at least one of --render-site, --validate-links, --check-js-types.",
            file=sys.stderr,
        )
        return 2

    root = Path(args.root).resolve()

    if args.check_js_types:
        code = run_check_js_types(root=root)
        if code != 0:
            return code

    if args.render_site:
        code = run_render_site(build_render_args(args), stdin=stdin)
        if code != 0:
            return code

    if args.validate_links:
        code = run_validate_links(root=root)
        if code != 0:
            return code

    return 0


def main() -> int:
    """Command-line entry point."""

    return run()


if __name__ == "__main__":
    raise SystemExit(main())
