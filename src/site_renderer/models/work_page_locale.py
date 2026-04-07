"""Localized work page content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .content_card import ContentCard
from .header_text import HeaderText
from .meta_text import MetaText


@dataclass(frozen=True, slots=True)
class WorkPageLocale:
    """Localized work page content."""

    meta: MetaText
    header: HeaderText
    summary: HtmlFragment
    section_title: str
    entries: tuple[ContentCard, ...]
    footer_html: HtmlFragment
