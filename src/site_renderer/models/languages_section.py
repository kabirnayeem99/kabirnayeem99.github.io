"""Languages stats section model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment


@dataclass(frozen=True, slots=True)
class LanguagesSection:
    """Structured settings for the language usage section."""

    title: str
    intro: HtmlFragment
    wakatime_copy: HtmlFragment
    wakatime_profile_href: str
    wakatime_badge_src: str
    wakatime_badge_alt: str
    wakatime_embed_src: str
    wakatime_embed_alt: str
    github_copy: HtmlFragment
    github_profile_href: str
    github_embed_src: str
    github_embed_alt: str
