"""Use-case: render site outputs from structured content."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from typing import TextIO

from site_renderer.cli import run as run_site_renderer


def run(argv: Sequence[str] | None = None, *, stdin: TextIO = sys.stdin) -> int:
    """Run the static site renderer and return an exit status."""

    return run_site_renderer(argv, stdin=stdin)
