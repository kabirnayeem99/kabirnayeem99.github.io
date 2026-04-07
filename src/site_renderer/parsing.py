"""Content parsing and validation from JSON source."""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import TextIO, TypeVar, cast

from .constants import HtmlFragment, LANGS, PAGE_IDS, Lang, PageId
from .models import (
    ArticleLink,
    BlogEntry,
    BlogPageLocale,
    ContentCard,
    ContentSchemaError,
    GoodreadsSection,
    GitHubCommitsSection,
    HeaderText,
    IndexPageLocale,
    IndexSection,
    LanguagesSection,
    LearningPathSection,
    LeetCodeSection,
    LocaleInfo,
    LocalizedPage,
    MetaText,
    ProjectGroup,
    ProjectPageLocale,
    SiteContent,
    SiteSettings,
    StatsPageLocale,
    StatsSections,
    WakaTimeSection,
    WorkPageLocale,
)


T = TypeVar("T")

def require_mapping(value: object, path: str) -> Mapping[str, object]:
    """Return a JSON object after validating its runtime type."""

    if not isinstance(value, dict):
        raise ContentSchemaError(f"{path} must be an object")
    raw_mapping = cast(dict[object, object], value)
    if not all(isinstance(key, str) for key in raw_mapping):
        raise ContentSchemaError(f"{path} must be an object with string keys")
    return cast(dict[str, object], raw_mapping)


def require_sequence(value: object, path: str) -> Sequence[object]:
    """Return a JSON array after validating its runtime type."""

    if not isinstance(value, list):
        raise ContentSchemaError(f"{path} must be an array")
    return cast(list[object], value)


def require_string(value: object, path: str) -> str:
    """Return a string field after validating its runtime type."""

    if not isinstance(value, str):
        raise ContentSchemaError(f"{path} must be a string")
    return value


def require_html_fragment(value: object, path: str) -> HtmlFragment:
    """Return a trusted HTML fragment string from the content file."""

    return HtmlFragment(require_string(value, path))


def require_optional_string(value: object, path: str) -> str | None:
    """Return a string or None after runtime validation."""

    if value is None:
        return None
    return require_string(value, path)


def get_required(mapping: Mapping[str, object], key: str, path: str) -> object:
    """Fetch a required key or raise a schema error with a precise path."""

    if key not in mapping:
        raise ContentSchemaError(f"{path}.{key} is required")
    return mapping[key]


def get_optional(mapping: Mapping[str, object], key: str) -> object | None:
    """Fetch an optional key without forcing callers to repeat membership checks."""

    return mapping.get(key)


def parse_string_tuple(value: object, path: str) -> tuple[str, ...]:
    """Parse an array of plain strings."""

    return tuple(require_string(item, f"{path}[{index}]") for index, item in enumerate(require_sequence(value, path)))


def parse_html_tuple(value: object, path: str) -> tuple[HtmlFragment, ...]:
    """Parse an array of trusted HTML fragments."""

    return tuple(
        require_html_fragment(item, f"{path}[{index}]")
        for index, item in enumerate(require_sequence(value, path))
    )


def parse_lang(value: str, path: str) -> Lang:
    """Parse and validate a language code."""

    if value not in LANGS:
        raise ContentSchemaError(f"{path} must be one of {', '.join(LANGS)}")
    return value


def parse_page_id(value: str, path: str) -> PageId:
    """Parse and validate a page identifier."""

    if value not in PAGE_IDS:
        raise ContentSchemaError(f"{path} must be one of {', '.join(PAGE_IDS)}")
    return value


def parse_mapping_of_strings(
    value: object,
    path: str,
    *,
    key_parser: Callable[[str, str], T],
) -> dict[T, str]:
    """Parse a JSON object whose values must all be strings."""

    raw = require_mapping(value, path)
    parsed: dict[T, str] = {}
    for raw_key, raw_value in raw.items():
        parsed[key_parser(raw_key, f"{path}.{raw_key}")] = require_string(
            raw_value,
            f"{path}.{raw_key}",
        )
    return parsed


def parse_meta(value: object, path: str) -> MetaText:
    """Parse page metadata."""

    raw = require_mapping(value, path)
    return MetaText(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        description=require_string(get_required(raw, "description", path), f"{path}.description"),
        keywords=require_string(get_required(raw, "keywords", path), f"{path}.keywords"),
    )


def parse_header(value: object, path: str) -> HeaderText:
    """Parse visible page header text."""

    raw = require_mapping(value, path)
    return HeaderText(
        site_title=require_string(get_required(raw, "site_title", path), f"{path}.site_title"),
        tagline=require_string(get_required(raw, "tagline", path), f"{path}.tagline"),
    )


def parse_locale_info(value: object, path: str) -> LocaleInfo:
    """Parse locale-wide settings used by all pages in one language."""

    raw = require_mapping(value, path)
    return LocaleInfo(
        direction=require_optional_string(get_optional(raw, "dir"), f"{path}.dir"),
        author=require_string(get_required(raw, "author", path), f"{path}.author"),
        language_switcher_label=require_string(
            get_required(raw, "language_switcher_label", path),
            f"{path}.language_switcher_label",
        ),
        og_image_alt=require_string(get_required(raw, "og_image_alt", path), f"{path}.og_image_alt"),
    )


def parse_site_settings(value: object, path: str) -> SiteSettings:
    """Parse the top-level site settings block."""

    raw = require_mapping(value, path)
    menu_labels = parse_mapping_of_strings(
        get_required(raw, "language_menu_labels", path),
        f"{path}.language_menu_labels",
        key_parser=parse_lang,
    )
    locales_raw = require_mapping(get_required(raw, "locales", path), f"{path}.locales")
    locales: dict[Lang, LocaleInfo] = {}
    for raw_lang, raw_locale in locales_raw.items():
        lang = parse_lang(raw_lang, f"{path}.locales.{raw_lang}")
        locales[lang] = parse_locale_info(raw_locale, f"{path}.locales.{raw_lang}")
    person_name = require_optional_string(get_optional(raw, "person_name"), f"{path}.person_name")
    website_name = require_optional_string(get_optional(raw, "website_name"), f"{path}.website_name")
    twitter_site = require_optional_string(get_optional(raw, "twitter_site"), f"{path}.twitter_site")
    social_profiles_value = get_optional(raw, "social_profiles")
    social_profiles = (
        parse_string_tuple(social_profiles_value, f"{path}.social_profiles")
        if social_profiles_value is not None
        else ()
    )
    default_person_name = locales["en"].author if "en" in locales else next(iter(locales.values())).author
    return SiteSettings(
        base_url=require_string(get_required(raw, "base_url", path), f"{path}.base_url"),
        google_site_verification=require_string(
            get_required(raw, "google_site_verification", path),
            f"{path}.google_site_verification",
        ),
        language_menu_labels=menu_labels,
        locales=locales,
        person_name=person_name if person_name is not None else default_person_name,
        website_name=website_name if website_name is not None else f"{default_person_name} Portfolio",
        twitter_site=twitter_site if twitter_site is not None else "",
        social_profiles=social_profiles,
    )


def parse_content_card(value: object, path: str) -> ContentCard:
    """Parse a reusable highlight/work/project card."""

    raw = require_mapping(value, path)
    paragraphs_value = get_optional(raw, "paragraphs")
    bullets_value = get_optional(raw, "bullets")
    href_value = get_optional(raw, "href")
    meta_value = get_optional(raw, "meta")
    return ContentCard(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        href=require_optional_string(href_value, f"{path}.href"),
        meta=require_optional_string(meta_value, f"{path}.meta"),
        paragraphs=parse_html_tuple(paragraphs_value, f"{path}.paragraphs")
        if paragraphs_value is not None
        else (),
        bullets=parse_html_tuple(bullets_value, f"{path}.bullets") if bullets_value is not None else (),
    )


def parse_article_link(value: object, path: str) -> ArticleLink:
    """Parse a linked article teaser."""

    raw = require_mapping(value, path)
    return ArticleLink(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        href=require_string(get_required(raw, "href", path), f"{path}.href"),
        summary=require_string(get_required(raw, "summary", path), f"{path}.summary"),
        meta=require_optional_string(get_optional(raw, "meta"), f"{path}.meta"),
    )


def parse_index_section(value: object, path: str) -> IndexSection:
    """Parse one homepage section."""

    raw = require_mapping(value, path)
    highlights_value = get_optional(raw, "highlights")
    articles_value = get_optional(raw, "articles")
    contacts_value = get_optional(raw, "contacts")
    paragraphs_value = get_optional(raw, "paragraphs")
    return IndexSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        paragraphs=parse_html_tuple(paragraphs_value, f"{path}.paragraphs")
        if paragraphs_value is not None
        else (),
        highlights=tuple(
            parse_content_card(item, f"{path}.highlights[{index}]")
            for index, item in enumerate(require_sequence(highlights_value, f"{path}.highlights"))
        )
        if highlights_value is not None
        else (),
        articles=tuple(
            parse_article_link(item, f"{path}.articles[{index}]")
            for index, item in enumerate(require_sequence(articles_value, f"{path}.articles"))
        )
        if articles_value is not None
        else (),
        contacts=parse_html_tuple(contacts_value, f"{path}.contacts") if contacts_value is not None else (),
    )


def parse_index_page_locale(value: object, path: str) -> IndexPageLocale:
    """Parse localized homepage content."""

    raw = require_mapping(value, path)
    sections_value = require_sequence(get_required(raw, "sections", path), f"{path}.sections")
    return IndexPageLocale(
        meta=parse_meta(get_required(raw, "meta", path), f"{path}.meta"),
        header=parse_header(get_required(raw, "header", path), f"{path}.header"),
        summary_card=parse_html_tuple(get_required(raw, "summary_card", path), f"{path}.summary_card"),
        sections=tuple(
            parse_index_section(item, f"{path}.sections[{index}]")
            for index, item in enumerate(sections_value)
        ),
        footer_html=require_html_fragment(get_required(raw, "footer_html", path), f"{path}.footer_html"),
    )


def parse_work_page_locale(value: object, path: str) -> WorkPageLocale:
    """Parse localized work page content."""

    raw = require_mapping(value, path)
    entries_value = require_sequence(get_required(raw, "entries", path), f"{path}.entries")
    return WorkPageLocale(
        meta=parse_meta(get_required(raw, "meta", path), f"{path}.meta"),
        header=parse_header(get_required(raw, "header", path), f"{path}.header"),
        summary=require_html_fragment(get_required(raw, "summary", path), f"{path}.summary"),
        section_title=require_string(get_required(raw, "section_title", path), f"{path}.section_title"),
        entries=tuple(
            parse_content_card(item, f"{path}.entries[{index}]")
            for index, item in enumerate(entries_value)
        ),
        footer_html=require_html_fragment(get_required(raw, "footer_html", path), f"{path}.footer_html"),
    )


def parse_project_group(value: object, path: str) -> ProjectGroup:
    """Parse a projects page group."""

    raw = require_mapping(value, path)
    items_value = require_sequence(get_required(raw, "items", path), f"{path}.items")
    return ProjectGroup(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        items=tuple(
            parse_content_card(item, f"{path}.items[{index}]")
            for index, item in enumerate(items_value)
        ),
    )


def parse_project_page_locale(value: object, path: str) -> ProjectPageLocale:
    """Parse localized projects page content."""

    raw = require_mapping(value, path)
    groups_value = require_sequence(get_required(raw, "groups", path), f"{path}.groups")
    return ProjectPageLocale(
        meta=parse_meta(get_required(raw, "meta", path), f"{path}.meta"),
        header=parse_header(get_required(raw, "header", path), f"{path}.header"),
        groups=tuple(
            parse_project_group(item, f"{path}.groups[{index}]")
            for index, item in enumerate(groups_value)
        ),
        footer_html=require_html_fragment(get_required(raw, "footer_html", path), f"{path}.footer_html"),
    )


def parse_blog_entry(value: object, path: str) -> BlogEntry:
    """Parse a blog entry."""

    raw = require_mapping(value, path)
    return BlogEntry(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        href=require_string(get_required(raw, "href", path), f"{path}.href"),
        meta=require_string(get_required(raw, "meta", path), f"{path}.meta"),
        summary=require_string(get_required(raw, "summary", path), f"{path}.summary"),
    )


def parse_blog_page_locale(value: object, path: str) -> BlogPageLocale:
    """Parse blog page content."""

    raw = require_mapping(value, path)
    articles_value = require_sequence(get_required(raw, "articles", path), f"{path}.articles")
    return BlogPageLocale(
        meta=parse_meta(get_required(raw, "meta", path), f"{path}.meta"),
        header=parse_header(get_required(raw, "header", path), f"{path}.header"),
        articles=tuple(
            parse_blog_entry(item, f"{path}.articles[{index}]")
            for index, item in enumerate(articles_value)
        ),
        footer_html=require_html_fragment(get_required(raw, "footer_html", path), f"{path}.footer_html"),
    )


def parse_wakatime_section(value: object, path: str) -> WakaTimeSection:
    """Parse the WakaTime section settings."""

    raw = require_mapping(value, path)
    return WakaTimeSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        status_text=require_string(get_required(raw, "status_text", path), f"{path}.status_text"),
        languages_url=require_string(get_required(raw, "languages_url", path), f"{path}.languages_url"),
        summary_url=require_string(get_required(raw, "summary_url", path), f"{path}.summary_url"),
        aria_label=require_string(get_required(raw, "aria_label", path), f"{path}.aria_label"),
    )


def parse_languages_section(value: object, path: str) -> LanguagesSection:
    """Parse the languages section settings."""

    raw = require_mapping(value, path)
    return LanguagesSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        intro=require_html_fragment(get_required(raw, "intro", path), f"{path}.intro"),
        wakatime_copy=require_html_fragment(
            get_required(raw, "wakatime_copy", path),
            f"{path}.wakatime_copy",
        ),
        wakatime_profile_href=require_string(
            get_required(raw, "wakatime_profile_href", path),
            f"{path}.wakatime_profile_href",
        ),
        wakatime_badge_src=require_string(
            get_required(raw, "wakatime_badge_src", path),
            f"{path}.wakatime_badge_src",
        ),
        wakatime_badge_alt=require_string(
            get_required(raw, "wakatime_badge_alt", path),
            f"{path}.wakatime_badge_alt",
        ),
        wakatime_embed_src=require_string(
            get_required(raw, "wakatime_embed_src", path),
            f"{path}.wakatime_embed_src",
        ),
        wakatime_embed_alt=require_string(
            get_required(raw, "wakatime_embed_alt", path),
            f"{path}.wakatime_embed_alt",
        ),
        github_copy=require_html_fragment(get_required(raw, "github_copy", path), f"{path}.github_copy"),
        github_profile_href=require_string(
            get_required(raw, "github_profile_href", path),
            f"{path}.github_profile_href",
        ),
        github_embed_src=require_string(
            get_required(raw, "github_embed_src", path),
            f"{path}.github_embed_src",
        ),
        github_embed_alt=require_string(
            get_required(raw, "github_embed_alt", path),
            f"{path}.github_embed_alt",
        ),
    )


def parse_github_commits_section(value: object, path: str) -> GitHubCommitsSection:
    """Parse the GitHub contribution section settings."""

    raw = require_mapping(value, path)
    return GitHubCommitsSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        description=require_string(get_required(raw, "description", path), f"{path}.description"),
        status_text=require_string(get_required(raw, "status_text", path), f"{path}.status_text"),
        contrib_url=require_string(get_required(raw, "contrib_url", path), f"{path}.contrib_url"),
        source_label=require_string(get_required(raw, "source_label", path), f"{path}.source_label"),
        source_href=require_string(get_required(raw, "source_href", path), f"{path}.source_href"),
        source_text=require_string(get_required(raw, "source_text", path), f"{path}.source_text"),
        heatmap_aria_label=require_string(
            get_required(raw, "heatmap_aria_label", path),
            f"{path}.heatmap_aria_label",
        ),
        legend_aria_label=require_string(
            get_required(raw, "legend_aria_label", path),
            f"{path}.legend_aria_label",
        ),
    )


def parse_leetcode_section(value: object, path: str) -> LeetCodeSection:
    """Parse the LeetCode section settings."""

    raw = require_mapping(value, path)
    return LeetCodeSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        copy=require_html_fragment(get_required(raw, "copy", path), f"{path}.copy"),
        thanks=require_html_fragment(get_required(raw, "thanks", path), f"{path}.thanks"),
        card_src=require_string(get_required(raw, "card_src", path), f"{path}.card_src"),
        card_alt=require_string(get_required(raw, "card_alt", path), f"{path}.card_alt"),
    )


def parse_learning_path_section(value: object, path: str) -> LearningPathSection:
    """Parse the learning path section settings."""

    raw = require_mapping(value, path)
    return LearningPathSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        copy=require_html_fragment(get_required(raw, "copy", path), f"{path}.copy"),
        href=require_string(get_required(raw, "href", path), f"{path}.href"),
        image_src=require_string(get_required(raw, "image_src", path), f"{path}.image_src"),
        image_alt=require_string(get_required(raw, "image_alt", path), f"{path}.image_alt"),
    )


def parse_goodreads_section(value: object, path: str) -> GoodreadsSection:
    """Parse the Goodreads section settings."""

    raw = require_mapping(value, path)
    return GoodreadsSection(
        title=require_string(get_required(raw, "title", path), f"{path}.title"),
        copy=require_string(get_required(raw, "copy", path), f"{path}.copy"),
        widget_id=require_string(get_required(raw, "widget_id", path), f"{path}.widget_id"),
        profile_href=require_string(get_required(raw, "profile_href", path), f"{path}.profile_href"),
        script_src=require_string(get_required(raw, "script_src", path), f"{path}.script_src"),
    )


def parse_stats_page_locale(value: object, path: str) -> StatsPageLocale:
    """Parse stats page content."""

    raw = require_mapping(value, path)
    sections = require_mapping(get_required(raw, "sections", path), f"{path}.sections")
    return StatsPageLocale(
        meta=parse_meta(get_required(raw, "meta", path), f"{path}.meta"),
        header=parse_header(get_required(raw, "header", path), f"{path}.header"),
        intro=parse_html_tuple(get_required(raw, "intro", path), f"{path}.intro"),
        sections=StatsSections(
            wakatime=parse_wakatime_section(
                get_required(sections, "wakatime", f"{path}.sections"),
                f"{path}.sections.wakatime",
            ),
            languages=parse_languages_section(
                get_required(sections, "languages", f"{path}.sections"),
                f"{path}.sections.languages",
            ),
            github_commits=parse_github_commits_section(
                get_required(sections, "github_commits", f"{path}.sections"),
                f"{path}.sections.github_commits",
            ),
            leetcode=parse_leetcode_section(
                get_required(sections, "leetcode", f"{path}.sections"),
                f"{path}.sections.leetcode",
            ),
            learning_path=parse_learning_path_section(
                get_required(sections, "learning_path", f"{path}.sections"),
                f"{path}.sections.learning_path",
            ),
            goodreads=parse_goodreads_section(
                get_required(sections, "goodreads", f"{path}.sections"),
                f"{path}.sections.goodreads",
            ),
        ),
        footer_html=require_html_fragment(get_required(raw, "footer_html", path), f"{path}.footer_html"),
    )


def parse_localized_page(
    value: object,
    path: str,
    *,
    locale_parser: Callable[[object, str], T],
) -> LocalizedPage[T]:
    """Parse a page container that holds one og:type and several localized variants."""

    raw = require_mapping(value, path)
    locales_raw = require_mapping(get_required(raw, "locales", path), f"{path}.locales")
    locales: dict[Lang, T] = {}
    for raw_lang, raw_locale in locales_raw.items():
        lang = parse_lang(raw_lang, f"{path}.locales.{raw_lang}")
        locales[lang] = locale_parser(raw_locale, f"{path}.locales.{raw_lang}")
    return LocalizedPage(
        og_type=require_string(get_required(raw, "og_type", path), f"{path}.og_type"),
        locales=locales,
    )


def parse_routes(value: object, path: str) -> dict[PageId, dict[Lang, str]]:
    """Parse route definitions for each page and locale."""

    raw = require_mapping(value, path)
    routes: dict[PageId, dict[Lang, str]] = {}
    for raw_page_id, raw_route_map in raw.items():
        page_id = parse_page_id(raw_page_id, f"{path}.{raw_page_id}")
        route_map_raw = require_mapping(raw_route_map, f"{path}.{raw_page_id}")
        route_map: dict[Lang, str] = {}
        for raw_lang, raw_route in route_map_raw.items():
            lang = parse_lang(raw_lang, f"{path}.{raw_page_id}.{raw_lang}")
            route_map[lang] = require_string(raw_route, f"{path}.{raw_page_id}.{raw_lang}")
        routes[page_id] = route_map
    return routes


def parse_navigation(value: object, path: str) -> dict[Lang, tuple[PageId, ...]]:
    """Parse per-locale navigation order."""

    raw = require_mapping(value, path)
    navigation: dict[Lang, tuple[PageId, ...]] = {}
    for raw_lang, raw_items in raw.items():
        lang = parse_lang(raw_lang, f"{path}.{raw_lang}")
        navigation[lang] = tuple(
            parse_page_id(item, f"{path}.{raw_lang}[{index}]")
            for index, item in enumerate(parse_string_tuple(raw_items, f"{path}.{raw_lang}"))
        )
    return navigation


def parse_navigation_labels(value: object, path: str) -> dict[PageId, dict[Lang, str]]:
    """Parse labels for each nav item in each available language."""

    raw = require_mapping(value, path)
    labels: dict[PageId, dict[Lang, str]] = {}
    for raw_page_id, raw_label_map in raw.items():
        page_id = parse_page_id(raw_page_id, f"{path}.{raw_page_id}")
        labels[page_id] = parse_mapping_of_strings(
            raw_label_map,
            f"{path}.{raw_page_id}",
            key_parser=parse_lang,
        )
    return labels


def parse_content_source(raw_value: object) -> SiteContent:
    """Parse the full content source into immutable typed dataclasses."""

    raw = require_mapping(raw_value, "root")
    pages_raw = require_mapping(get_required(raw, "pages", "root"), "root.pages")
    return SiteContent(
        site=parse_site_settings(get_required(raw, "site", "root"), "root.site"),
        routes=parse_routes(get_required(raw, "routes", "root"), "root.routes"),
        navigation=parse_navigation(get_required(raw, "navigation", "root"), "root.navigation"),
        navigation_labels=parse_navigation_labels(
            get_required(raw, "navigation_labels", "root"),
            "root.navigation_labels",
        ),
        index_page=parse_localized_page(
            get_required(pages_raw, "index", "root.pages"),
            "root.pages.index",
            locale_parser=parse_index_page_locale,
        ),
        work_page=parse_localized_page(
            get_required(pages_raw, "work", "root.pages"),
            "root.pages.work",
            locale_parser=parse_work_page_locale,
        ),
        project_page=parse_localized_page(
            get_required(pages_raw, "project", "root.pages"),
            "root.pages.project",
            locale_parser=parse_project_page_locale,
        ),
        blog_page=parse_localized_page(
            get_required(pages_raw, "blog", "root.pages"),
            "root.pages.blog",
            locale_parser=parse_blog_page_locale,
        ),
        stats_page=parse_localized_page(
            get_required(pages_raw, "stats", "root.pages"),
            "root.pages.stats",
            locale_parser=parse_stats_page_locale,
        ),
    )


def read_content_stream(content_path: str, stdin: TextIO) -> str:
    """Read JSON from a file path or stdin when the path is '-'."""

    if content_path == "-":
        return stdin.read()
    return Path(content_path).read_text(encoding="utf-8")


def load_site_content(content_path: str, stdin: TextIO) -> SiteContent:
    """Load and validate the content source."""

    raw_text = read_content_stream(content_path, stdin)
    try:
        raw_value = cast(object, json.loads(raw_text))
    except json.JSONDecodeError as error:
        raise ContentSchemaError(f"invalid JSON: {error.msg} at line {error.lineno}, column {error.colno}") from error
    return parse_content_source(raw_value)


