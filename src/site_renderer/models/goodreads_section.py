"""Goodreads stats section model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GoodreadsSection:
    """Structured settings for the Goodreads embed."""

    title: str
    copy: str
    widget_id: str
    profile_href: str
    script_src: str
