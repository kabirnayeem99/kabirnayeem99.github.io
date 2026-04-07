"""Localized blog page content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .blog_entry import BlogEntry
from .header_text import HeaderText
from .meta_text import MetaText


@dataclass(frozen=True, slots=True)
class BlogPageLocale:
    """English-only blog page content."""

    meta: MetaText
    header: HeaderText
    articles: tuple[BlogEntry, ...]
    footer_html: HtmlFragment
