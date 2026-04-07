"""Blog entry model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class BlogEntry:
    """A single writing entry on the blog page."""

    title: str
    href: str
    meta: str
    summary: str
