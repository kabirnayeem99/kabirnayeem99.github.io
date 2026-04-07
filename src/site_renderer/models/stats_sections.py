"""Aggregate stats sections model."""

from __future__ import annotations

from dataclasses import dataclass

from .github_commits_section import GitHubCommitsSection
from .goodreads_section import GoodreadsSection
from .languages_section import LanguagesSection
from .learning_path_section import LearningPathSection
from .leetcode_section import LeetCodeSection
from .wakatime_section import WakaTimeSection


@dataclass(frozen=True, slots=True)
class StatsSections:
    """All stats subsections grouped into one typed container."""

    wakatime: WakaTimeSection
    languages: LanguagesSection
    github_commits: GitHubCommitsSection
    leetcode: LeetCodeSection
    learning_path: LearningPathSection
    goodreads: GoodreadsSection
