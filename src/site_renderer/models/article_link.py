"""Linked article teaser model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ArticleLink:
    """A linked article teaser."""

    title: str
    href: str
    summary: str
    meta: str | None
