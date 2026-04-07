"""Project group model."""

from __future__ import annotations

from dataclasses import dataclass

from .content_card import ContentCard


@dataclass(frozen=True, slots=True)
class ProjectGroup:
    """A titled group of projects."""

    title: str
    items: tuple[ContentCard, ...]
