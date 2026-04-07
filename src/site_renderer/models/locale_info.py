"""Locale-level chrome settings model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LocaleInfo:
    """Locale-level chrome settings shared across pages."""

    direction: str | None
    author: str
    language_switcher_label: str
    og_image_alt: str
