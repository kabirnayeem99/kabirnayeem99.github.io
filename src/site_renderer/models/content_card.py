"""Reusable content card model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment


@dataclass(frozen=True, slots=True)
class ContentCard:
    """Reusable content card used by highlights, work entries, and project items."""

    title: str
    href: str | None
    meta: str | None
    paragraphs: tuple[HtmlFragment, ...]
    bullets: tuple[HtmlFragment, ...]
