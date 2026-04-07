"""Localized homepage content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .header_text import HeaderText
from .index_section import IndexSection
from .meta_text import MetaText


@dataclass(frozen=True, slots=True)
class IndexPageLocale:
    """Localized homepage content."""

    meta: MetaText
    header: HeaderText
    summary_card: tuple[HtmlFragment, ...]
    sections: tuple[IndexSection, ...]
    footer_html: HtmlFragment
