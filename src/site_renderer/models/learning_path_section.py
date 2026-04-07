"""Learning path stats section model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment


@dataclass(frozen=True, slots=True)
class LearningPathSection:
    """Structured settings for the roadmap section."""

    title: str
    copy: HtmlFragment
    href: str
    image_src: str
    image_alt: str
