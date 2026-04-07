"""LeetCode stats section model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment


@dataclass(frozen=True, slots=True)
class LeetCodeSection:
    """Structured settings for the LeetCode section."""

    title: str
    copy: HtmlFragment
    thanks: HtmlFragment
    card_src: str
    card_alt: str
