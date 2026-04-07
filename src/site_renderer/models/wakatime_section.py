"""WakaTime stats section model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class WakaTimeSection:
    """Structured settings for the WakaTime widget section."""

    title: str
    status_text: str
    languages_url: str
    summary_url: str
    aria_label: str
