"""Top-level structured site content model."""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import PageId
from .aliases import NavigationLabels, NavigationTable, RouteTable
from .blog_page_locale import BlogPageLocale
from .index_page_locale import IndexPageLocale
from .localized_page import LocalizedPage
from .project_page_locale import ProjectPageLocale
from .site_settings import SiteSettings
from .stats_page_locale import StatsPageLocale
from .work_page_locale import WorkPageLocale


@dataclass(frozen=True, slots=True)
class SiteContent:
    """Fully parsed and typed site content."""

    site: SiteSettings
    routes: RouteTable
    navigation: NavigationTable
    navigation_labels: NavigationLabels
    index_page: LocalizedPage[IndexPageLocale]
    work_page: LocalizedPage[WorkPageLocale]
    project_page: LocalizedPage[ProjectPageLocale]
    blog_page: LocalizedPage[BlogPageLocale]
    stats_page: LocalizedPage[StatsPageLocale]

    def page_for(
        self,
        page_id: PageId,
    ) -> (
        LocalizedPage[IndexPageLocale]
        | LocalizedPage[WorkPageLocale]
        | LocalizedPage[ProjectPageLocale]
        | LocalizedPage[BlogPageLocale]
        | LocalizedPage[StatsPageLocale]
    ):
        """Return the typed page descriptor for a page id."""

        if page_id == "index":
            return self.index_page
        if page_id == "work":
            return self.work_page
        if page_id == "project":
            return self.project_page
        if page_id == "blog":
            return self.blog_page
        return self.stats_page
