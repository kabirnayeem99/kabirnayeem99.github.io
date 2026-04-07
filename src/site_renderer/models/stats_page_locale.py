"""Localized stats page content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .header_text import HeaderText
from .meta_text import MetaText
from .stats_sections import StatsSections


@dataclass(frozen=True, slots=True)
class StatsPageLocale:
    """English-only stats page content."""

    meta: MetaText
    header: HeaderText
    intro: tuple[HtmlFragment, ...]
    sections: StatsSections
    footer_html: HtmlFragment
