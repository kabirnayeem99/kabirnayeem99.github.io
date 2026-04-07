"""Localized project page content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import HtmlFragment
from .header_text import HeaderText
from .meta_text import MetaText
from .project_group import ProjectGroup


@dataclass(frozen=True, slots=True)
class ProjectPageLocale:
    """Localized projects page content."""

    meta: MetaText
    header: HeaderText
    groups: tuple[ProjectGroup, ...]
    footer_html: HtmlFragment
