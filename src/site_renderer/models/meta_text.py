"""SEO and social metadata model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MetaText:
    """SEO and social metadata for one rendered page."""

    title: str
    description: str
    keywords: str
