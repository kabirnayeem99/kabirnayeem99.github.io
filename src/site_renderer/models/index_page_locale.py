"""Localized homepage content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .header_text import HeaderText
from .index_action import IndexAction
from .index_section import IndexSection
from .meta_text import MetaText


@dataclass(frozen=True, slots=True)
class IndexPageLocale:
    """Localized homepage content."""

    meta: MetaText
    header: HeaderText
    top_actions_title: str | None
    top_actions: tuple[IndexAction, ...]
    summary_card: tuple[HtmlFragment, ...]
    sections: tuple[IndexSection, ...]
    footer_html: HtmlFragment
