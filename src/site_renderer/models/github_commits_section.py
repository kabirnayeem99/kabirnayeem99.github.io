"""GitHub commits stats section model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GitHubCommitsSection:
    """Structured settings for the GitHub contribution section."""

    title: str
    description: str
    status_text: str
    contrib_url: str
    source_label: str
    source_href: str
    source_text: str
    heatmap_aria_label: str
    legend_aria_label: str
