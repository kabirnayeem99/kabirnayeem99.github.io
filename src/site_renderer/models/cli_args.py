"""Typed CLI argument namespace model."""

from __future__ import annotations

import argparse

from ..constants import DEFAULT_CONTENT_PATH, DEFAULT_ROOT


class CliArgs(argparse.Namespace):
    """Typed CLI arguments after argparse parsing."""

    content: str = str(DEFAULT_CONTENT_PATH)
    root: str = str(DEFAULT_ROOT)
    check: bool = False
    page: list[str] | None = None
    lang: list[str] | None = None
    verbose: bool = False
