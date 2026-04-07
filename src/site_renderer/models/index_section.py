"""Homepage section model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .article_link import ArticleLink
from .content_card import ContentCard


@dataclass(frozen=True, slots=True)
class IndexSection:
    """A homepage section with optional paragraphs, cards, article teasers, or contacts."""

    title: str
    paragraphs: tuple[HtmlFragment, ...]
    highlights: tuple[ContentCard, ...]
    articles: tuple[ArticleLink, ...]
    contacts: tuple[HtmlFragment, ...]
