"""Global site settings model."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from ..constants import Lang
from .locale_info import LocaleInfo


@dataclass(frozen=True, slots=True)
class SiteSettings:
    """Global site settings independent from a single page."""

    base_url: str
    google_site_verification: str
    language_menu_labels: Mapping[Lang, str]
    locales: Mapping[Lang, LocaleInfo]
    person_name: str
    website_name: str
    twitter_site: str
    social_profiles: tuple[str, ...]
