"""HTML and auxiliary renderers for pages, metadata, and assets."""

from __future__ import annotations

import html
import json
import posixpath
import re
from collections.abc import Mapping
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .constants import (
    BACK_TO_TOP_LABELS,
    GENERATED_COMMENT,
    LANGS,
    LAST_UPDATED_LABELS,
    OG_LOCALE_BY_LANG,
    PAGE_IDS,
    SERVICE_WORKER_ASSET_PATHS,
    SERVICE_WORKER_OUTPUT_RELATIVE_PATH,
    SKIP_TO_MAIN_LABELS,
    THEME_BOOTSTRAP_SCRIPT,
    THEME_DARK_LABELS,
    THEME_LIGHT_LABELS,
    VIEW_ALL_STATS_LABELS,
    HtmlFragment,
    Lang,
    PageId,
)
from .minify import minify_html_document
from .models import (
    ArticleLink,
    BlogPageLocale,
    ContentCard,
    GoodreadsSection,
    HeaderText,
    IndexAction,
    IndexPageLocale,
    LocaleInfo,
    MetaText,
    ProjectPageLocale,
    RouteTable,
    SiteContent,
    SiteSettings,
    StatsPageLocale,
    WakaTimeSection,
    WorkPageLocale,
)

def relative_href(from_output: str, to_output: str) -> str:
    """Compute a POSIX relative URL between two output paths."""

    from_dir = posixpath.dirname(from_output) or "."
    return posixpath.relpath(to_output, start=from_dir)


def route_for(routes: RouteTable, page_id: PageId, lang: Lang) -> str:
    """Resolve a route for a given page and locale, falling back to localized home."""

    page_routes = routes[page_id]
    if lang in page_routes:
        return page_routes[lang]
    return routes["index"][lang]


def route_for_action(routes: RouteTable, page_id: PageId, lang: Lang) -> str:
    """Resolve a route for CTAs, preferring locale-specific pages then English."""

    page_routes = routes[page_id]
    if lang in page_routes:
        return page_routes[lang]
    if "en" in page_routes:
        return page_routes["en"]
    return next(iter(page_routes.values()))


def canonical_url(base_url: str, route: str, page_id: PageId, lang: Lang) -> str:
    """Build the canonical URL for a rendered page."""

    if page_id == "index" and lang == "en":
        return f"{base_url}/"
    return f"{base_url}/{route}"


def alternate_language_links(site: SiteSettings, routes: RouteTable, page_id: PageId) -> tuple[str, ...]:
    """Build alternate-language link tags for the actual page variants only."""

    page_routes = routes[page_id]
    alternate_links: list[str] = []

    for alternate_lang in LANGS:
        if alternate_lang not in page_routes:
            continue
        alternate_href = canonical_url(site.base_url, page_routes[alternate_lang], page_id, alternate_lang)
        alternate_links.append(
            f'  <link rel="alternate" hreflang="{alternate_lang}" href="{html.escape(alternate_href)}" />'
        )

    default_lang = "en" if "en" in page_routes else next(iter(page_routes.keys()))
    default_href = canonical_url(site.base_url, page_routes[default_lang], page_id, default_lang)
    alternate_links.append(
        f'  <link rel="alternate" hreflang="x-default" href="{html.escape(default_href)}" />'
    )

    return tuple(alternate_links)


def page_lang_attrs(locale: LocaleInfo, lang: Lang) -> str:
    """Render the html element language and direction attributes."""

    if locale.direction is None:
        return f'lang="{lang}"'
    return f'lang="{lang}" dir="{locale.direction}"'


def asset_href(current_output: str, asset_path: str) -> str:
    """Resolve a relative asset href from the current output path."""

    return relative_href(current_output, asset_path)


def replace_query_params(url: str, replacements: Mapping[str, str]) -> str:
    """Return a URL with selected query parameters replaced."""

    parts = urlsplit(url)
    query_items = dict(parse_qsl(parts.query, keep_blank_values=True))
    query_items.update(replacements)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query_items), parts.fragment))


def stats_embed_theme_sources(light_url: str, *, provider: Literal["leetcode", "roadmap"]) -> tuple[str, str]:
    """Return light and dark URLs for theme-aware remote stats embeds."""

    if provider == "leetcode":
        dark_colors = "#3F3A36,#D6D3D1,#F5F5F4,#A8A29E,#FB923C,#73AF6F,#FACC15,#FF5555,"
        dark_url = replace_query_params(
            light_url,
            {
                "theme": "dark",
                "colors": dark_colors,
            },
        )
        return (light_url, dark_url)

    dark_url = replace_query_params(light_url, {"variant": "dark"})
    return (light_url, dark_url)


def script_safe_json(value: object) -> str:
    """Return compact JSON text that is safe inside an inline script tag."""

    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</script", "<\\/script")


def render_schema_graph(site: SiteSettings, canonical: str, og_image: str) -> str:
    """Render a JSON-LD graph with WebSite and Person entities."""

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{site.base_url}/#website",
                "url": f"{site.base_url}/",
                "name": site.website_name,
                "publisher": {"@id": f"{site.base_url}/#person"},
                "inLanguage": ["en", "bn", "ar", "ur"],
            },
            {
                "@type": "Person",
                "@id": f"{site.base_url}/#person",
                "name": site.person_name,
                "url": canonical,
                "image": og_image,
                "sameAs": list(site.social_profiles),
            },
        ],
    }
    return f'  <script type="application/ld+json">{script_safe_json(graph)}</script>'


def render_head(
    site: SiteSettings,
    routes: RouteTable,
    page_id: PageId,
    lang: Lang,
    route: str,
    current_output: str,
    meta: MetaText,
) -> str:
    """Render the document head."""

    locale = site.locales[lang]
    canonical = canonical_url(site.base_url, route, page_id, lang)
    alternate_links = alternate_language_links(site, routes, page_id)
    og_image = f"{site.base_url}/assets/images/og-card.png"
    stylesheet = asset_href(current_output, "assets/css/styles.css")
    favicon_32 = asset_href(current_output, "assets/icons/favicon-32x32.png")
    favicon_16 = asset_href(current_output, "assets/icons/favicon-16x16.png")
    favicon_ico = asset_href(current_output, "assets/icons/favicon.ico")
    apple_touch_icon = asset_href(current_output, "assets/icons/apple-touch-icon.png")
    manifest = asset_href(current_output, "site.webmanifest")
    og_type = "website" if page_id == "index" else "article"
    og_locale = OG_LOCALE_BY_LANG[lang]
    og_locale_alternates = tuple(
        OG_LOCALE_BY_LANG[alternate_lang]
        for alternate_lang in routes[page_id]
        if alternate_lang != lang
    )
    schema_graph = render_schema_graph(site, canonical, og_image)
    return "\n".join(
        (
            "<head>",
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            f"  <title>{html.escape(meta.title)}</title>",
            f'  <meta name="description" content="{html.escape(meta.description)}" />',
            f'  <meta name="keywords" content="{html.escape(meta.keywords)}" />',
            f'  <meta name="author" content="{html.escape(locale.author)}" />',
            '  <meta name="robots" content="index, follow" />',
            f'  <link rel="canonical" href="{html.escape(canonical)}" />',
            *alternate_links,
            f'  <meta property="og:type" content="{og_type}" />',
            f'  <meta property="og:site_name" content="{html.escape(locale.author)}" />',
            f'  <meta property="og:locale" content="{html.escape(og_locale)}" />',
            *tuple(
                f'  <meta property="og:locale:alternate" content="{html.escape(alternate_locale)}" />'
                for alternate_locale in og_locale_alternates
            ),
            f'  <meta property="og:url" content="{html.escape(canonical)}" />',
            f'  <meta property="og:title" content="{html.escape(meta.title)}" />',
            f'  <meta property="og:description" content="{html.escape(meta.description)}" />',
            f'  <meta property="og:image" content="{html.escape(og_image)}" />',
            '  <meta property="og:image:width" content="1200" />',
            '  <meta property="og:image:height" content="630" />',
            f'  <meta property="og:image:alt" content="{html.escape(locale.og_image_alt)}" />',
            '  <meta name="twitter:card" content="summary_large_image" />',
            f'  <meta name="twitter:site" content="{html.escape(site.twitter_site)}" />',
            f'  <meta name="twitter:title" content="{html.escape(meta.title)}" />',
            f'  <meta name="twitter:description" content="{html.escape(meta.description)}" />',
            f'  <meta name="twitter:image" content="{html.escape(og_image)}" />',
            '  <meta name="theme-color" content="#f7f0e1" media="(prefers-color-scheme: light)" />',
            '  <meta name="theme-color" content="#1c1917" media="(prefers-color-scheme: dark)" />',
            schema_graph,
            (
                '  <script defer src="https://cloud.umami.is/script.js" '
                'data-website-id="cdec8895-be63-42d6-a490-12dd2ea8f35c"></script>'
            ),
            f"  <script>{THEME_BOOTSTRAP_SCRIPT}</script>",
            f'  <link rel="preload" href="{html.escape(stylesheet)}" as="style" />',
            f'  <link rel="stylesheet" href="{html.escape(stylesheet)}" />',
            f'  <link rel="icon" type="image/png" sizes="32x32" href="{html.escape(favicon_32)}" />',
            f'  <link rel="icon" type="image/png" sizes="16x16" href="{html.escape(favicon_16)}" />',
            f'  <link rel="shortcut icon" href="{html.escape(favicon_ico)}" />',
            f'  <link rel="apple-touch-icon" sizes="180x180" href="{html.escape(apple_touch_icon)}" />',
            f'  <link rel="manifest" href="{html.escape(manifest)}" />',
            f'  <meta name="google-site-verification" content="{html.escape(site.google_site_verification)}" />',
            "</head>",
        )
    )


def render_language_switcher(
    site: SiteSettings,
    routes: RouteTable,
    page_id: PageId,
    lang: Lang,
    current_output: str,
) -> str:
    """Render the language switcher for the actual localized page variants."""

    page_routes = routes[page_id]
    available_languages: list[Lang] = [target_lang for target_lang in LANGS if target_lang in page_routes]
    if len(available_languages) <= 1:
        return ""

    switcher_label = site.locales[lang].language_switcher_label
    menu_id = f"language-menu-{page_id}-{lang}"
    lines = [
        '      <div class="language-switcher" data-language-switcher>',
        (
            f'        <button class="language-switcher-button" type="button" aria-label="{html.escape(switcher_label)}" '
            f'aria-controls="{html.escape(menu_id)}" aria-expanded="false" aria-haspopup="true" '
            f'title="{html.escape(switcher_label)}" data-language-switcher-button>'
            '<span aria-hidden="true" class="language-switcher-globe"></span>'
            "</button>"
        ),
        f'        <div class="language-menu" id="{html.escape(menu_id)}" hidden data-language-switcher-menu>',
    ]
    for target_lang in available_languages:
        label = site.language_menu_labels[target_lang]
        href = relative_href(current_output, page_routes[target_lang])
        current_attr = ' aria-current="page"' if target_lang == lang else ""
        lines.append(
            f'        <a href="{html.escape(href)}" lang="{target_lang}"{current_attr}>{html.escape(label)}</a>'
        )
    lines.extend(('        </div>', "      </div>"))
    return "\n".join(lines)


def render_theme_toggle(lang: Lang) -> str:
    """Render the explicit light/dark theme toggle."""

    dark_label = THEME_DARK_LABELS[lang]
    light_label = THEME_LIGHT_LABELS[lang]
    return (
        f'      <button class="theme-toggle" type="button" aria-label="{html.escape(dark_label)}" '
        f'title="{html.escape(dark_label)}" aria-pressed="false" data-theme-toggle '
        f'data-dark-label="{html.escape(dark_label)}" data-light-label="{html.escape(light_label)}">'
        '<span class="theme-toggle-icon" aria-hidden="true" data-theme-toggle-icon>☾</span>'
        "</button>"
    )


def render_header_controls(
    site: SiteSettings,
    routes: RouteTable,
    page_id: PageId,
    lang: Lang,
    current_output: str,
) -> str:
    """Render top-right lightweight controls for theme and language."""

    controls = ['      <div class="header-controls">', render_theme_toggle(lang)]
    language_switcher = render_language_switcher(site, routes, page_id, lang, current_output)
    if language_switcher:
        controls.append(language_switcher)
    controls.append("      </div>")
    return "\n".join(controls)


def render_nav(
    content: SiteContent,
    page_id: PageId,
    lang: Lang,
    current_output: str,
) -> str:
    """Render the top navigation for one locale."""

    lines = ["      <nav>"]
    for nav_page_id in content.navigation[lang]:
        label = content.navigation_labels[nav_page_id][lang]
        href = relative_href(current_output, route_for(content.routes, nav_page_id, lang))
        current_attr = ' aria-current="page"' if nav_page_id == page_id else ""
        lines.append(
            (
                f'        <a href="{html.escape(href)}" data-nav-page-id="{nav_page_id}"{current_attr}>'
                f"{html.escape(label)}</a>"
            )
        )
    lines.append("      </nav>")
    return "\n".join(lines)


def social_platform_for_url(url: str) -> str | None:
    """Return a known social platform key for a profile URL."""

    lowered = url.lower()
    if "github.com" in lowered:
        return "github"
    if "linkedin.com" in lowered:
        return "linkedin"
    if "leetcode.com" in lowered:
        return "leetcode"
    if "medium.com" in lowered:
        return "medium"
    return None


def render_social_icon(platform: str) -> str:
    """Render inline SVG icon markup for a social platform."""

    paths_by_platform: dict[str, tuple[tuple[str, str], ...]] = {
        "github": (
            ("M4.0744 2.9938C4.13263 1.96371 4.37869 1.51577 5.08432 1.15606C5.84357 0.768899 7.04106 0.949072 8.45014 1.66261C9.05706 1.97009 9.11886 1.97635 10.1825 1.83998C11.5963 1.65865 13.4164 1.65929 14.7213 1.84164C15.7081 1.97954 15.7729 1.97265 16.3813 1.66453C18.3814 0.651679 19.9605 0.71795 20.5323 1.8387C20.8177 2.39812 20.8707 3.84971 20.6494 5.04695C20.5267 5.71069 20.5397 5.79356 20.8353 6.22912C22.915 9.29385 21.4165 14.2616 17.8528 16.1155C17.5801 16.2574 17.3503 16.3452 17.163 16.4167C16.5879 16.6363 16.4133 16.703 16.6247 17.7138C16.7265 18.2 16.8491 19.4088 16.8973 20.4002C16.9844 22.1922 16.9831 22.2047 16.6688 22.5703C16.241 23.0676 15.6244 23.076 15.2066 22.5902C14.9341 22.2734 14.9075 22.1238 14.9075 20.9015C14.9075 19.0952 14.7095 17.8946 14.2417 16.8658C13.6854 15.6415 14.0978 15.185 15.37 14.9114C17.1383 14.531 18.5194 13.4397 19.2892 11.8146C20.0211 10.2698 20.1314 8.13501 18.8082 6.83668C18.4319 6.3895 18.4057 5.98446 18.6744 4.76309C18.7748 4.3066 18.859 3.71768 18.8615 3.45425C18.8653 3.03823 18.8274 2.97541 18.5719 2.97541C18.4102 2.97541 17.7924 3.21062 17.1992 3.49805L16.2524 3.95695C16.1663 3.99866 16.07 4.0147 15.975 4.0038C13.5675 3.72746 11.2799 3.72319 8.86062 4.00488C8.76526 4.01598 8.66853 3.99994 8.58215 3.95802L7.63585 3.49882C7.04259 3.21087 6.42482 2.97541 6.26317 2.97541C5.88941 2.97541 5.88379 3.25135 6.22447 4.89078C6.43258 5.89203 6.57262 6.11513 5.97101 6.91572C5.06925 8.11576 4.844 9.60592 5.32757 11.1716C5.93704 13.1446 7.4295 14.4775 9.52773 14.9222C10.7926 15.1903 11.1232 15.5401 10.6402 16.9905C10.26 18.1319 10.0196 18.4261 9.46707 18.4261C8.72365 18.4261 8.25796 17.7821 8.51424 17.1082C8.62712 16.8112 8.59354 16.7795 7.89711 16.5255C5.77117 15.7504 4.14514 14.0131 3.40172 11.7223C2.82711 9.95184 3.07994 7.64739 4.00175 6.25453C4.31561 5.78028 4.32047 5.74006 4.174 4.83217C4.09113 4.31822 4.04631 3.49103 4.0744 2.9938Z", ""),
            ("M3.33203 15.9454C3.02568 15.4859 2.40481 15.3617 1.94528 15.6681C1.48576 15.9744 1.36158 16.5953 1.66793 17.0548C1.8941 17.3941 2.16467 17.6728 2.39444 17.9025C2.4368 17.9449 2.47796 17.9858 2.51815 18.0257C2.71062 18.2169 2.88056 18.3857 3.05124 18.5861C3.42875 19.0292 3.80536 19.626 4.0194 20.6962C4.11474 21.1729 4.45739 21.4297 4.64725 21.5419C4.85315 21.6635 5.07812 21.7352 5.26325 21.7819C5.64196 21.8774 6.10169 21.927 6.53799 21.9559C7.01695 21.9877 7.53592 21.998 7.99999 22.0008C8.00033 22.5527 8.44791 23.0001 8.99998 23.0001C9.55227 23.0001 9.99998 22.5524 9.99998 22.0001V21.0001C9.99998 20.4478 9.55227 20.0001 8.99998 20.0001C8.90571 20.0001 8.80372 20.0004 8.69569 20.0008C8.10883 20.0026 7.34388 20.0049 6.67018 19.9603C6.34531 19.9388 6.07825 19.9083 5.88241 19.871C5.58083 18.6871 5.09362 17.8994 4.57373 17.2891C4.34391 17.0194 4.10593 16.7834 3.91236 16.5914C3.87612 16.5555 3.84144 16.5211 3.80865 16.4883C3.5853 16.265 3.4392 16.1062 3.33203 15.9454Z", ""),
        ),
        "linkedin": (
            ("M6.5 8C7.32843 8 8 7.32843 8 6.5C8 5.67157 7.32843 5 6.5 5C5.67157 5 5 5.67157 5 6.5C5 7.32843 5.67157 8 6.5 8Z", ""),
            ("M5 10C5 9.44772 5.44772 9 6 9H7C7.55228 9 8 9.44771 8 10V18C8 18.5523 7.55228 19 7 19H6C5.44772 19 5 18.5523 5 18V10Z", ""),
            ("M11 19H12C12.5523 19 13 18.5523 13 18V13.5C13 12 16 11 16 13V18.0004C16 18.5527 16.4477 19 17 19H18C18.5523 19 19 18.5523 19 18V12C19 10 17.5 9 15.5 9C13.5 9 13 10.5 13 10.5V10C13 9.44771 12.5523 9 12 9H11C10.4477 9 10 9.44772 10 10V18C10 18.5523 10.4477 19 11 19Z", ""),
            ("M20 1C21.6569 1 23 2.34315 23 4V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H20ZM20 3C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3H20Z", ' fill-rule="evenodd" clip-rule="evenodd"'),
        ),
        "leetcode": (
            ("M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z", ""),
        ),
        "medium": (
            ("M13 12C13 15.3137 10.3137 18 7 18C3.68629 18 1 15.3137 1 12C1 8.68629 3.68629 6 7 6C10.3137 6 13 8.68629 13 12Z", ""),
            ("M23 12C23 14.7614 22.5523 17 22 17C21.4477 17 21 14.7614 21 12C21 9.23858 21.4477 7 22 7C22.5523 7 23 9.23858 23 12Z", ""),
            ("M17 18C18.6569 18 20 15.3137 20 12C20 8.68629 18.6569 6 17 6C15.3431 6 14 8.68629 14 12C14 15.3137 15.3431 18 17 18Z", ""),
        ),
    }
    viewbox_by_platform: dict[str, str] = {
        "github": "0 0 24 24",
        "linkedin": "0 0 24 24",
        "leetcode": "0 0 24 24",
        "medium": "0 0 24 24",
    }
    paths = paths_by_platform[platform]
    viewbox = viewbox_by_platform[platform]
    rendered_paths = "".join(
        f'<path d="{path}" fill="currentColor"{extra_attrs}></path>'
        for path, extra_attrs in paths
    )
    return (
        f'<svg class="social-chip-icon" viewBox="{viewbox}" aria-hidden="true" '
        f'focusable="false" xmlns="http://www.w3.org/2000/svg">{rendered_paths}</svg>'
    )


def render_email_social_icon() -> str:
    """Render inline SVG icon markup for the email social chip."""

    return (
        '<svg class="social-chip-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" '
        'xmlns="http://www.w3.org/2000/svg">'
        '<path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'
        '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round"></rect></svg>'
    )


def index_email_action(page: IndexPageLocale) -> IndexAction | None:
    """Return the first mailto action configured for homepage quick actions."""

    for action in page.top_actions:
        if action.href is not None and action.href.startswith("mailto:"):
            return action
    return None


def render_social_chips(site: SiteSettings, email_action: IndexAction | None = None) -> str:
    """Render bordered chips with icon + label for email and social profile URLs."""

    labels_by_platform: dict[str, str] = {
        "github": "GitHub",
        "linkedin": "LinkedIn",
        "leetcode": "LeetCode",
        "medium": "Medium",
    }
    lines = ['      <div class="social-chip-row" aria-label="Social links">']
    if email_action is not None and email_action.href is not None:
        email_label = email_action.label.lstrip("✉").strip()
        lines.append(
            (
                f'        <a class="social-chip" href="{html.escape(email_action.href)}" '
                f'aria-label="{html.escape(email_label)}">'
                f"{render_email_social_icon()}"
                f'<span>{html.escape(email_label)}</span></a>'
            )
        )
    for url in site.social_profiles:
        platform = social_platform_for_url(url)
        if platform is None:
            continue
        label = labels_by_platform[platform]
        lines.append(
            (
                f'        <a class="social-chip" href="{html.escape(url)}" target="_blank" rel="noreferrer" '
                f'aria-label="{html.escape(label)}">'
                f"{render_social_icon(platform)}"
                f'<span>{html.escape(label)}</span></a>'
            )
        )
    lines.append("      </div>")
    return "\n".join(lines)


def sitemap_priority(page_id: PageId, lang: Lang) -> str:
    """Return the sitemap priority for a rendered page."""

    if lang == "en":
        if page_id == "index":
            return "1.0"
        return "0.8"
    if lang == "bn":
        return "0.7"
    return "0.6"


def render_sitemap(content: SiteContent, lastmod: str) -> str:
    """Render the XML sitemap for all generated pages."""

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for page_id in PAGE_IDS:
        for lang, route in content.routes[page_id].items():
            lines.extend(
                (
                    "    <url>",
                    f"        <loc>{html.escape(canonical_url(content.site.base_url, route, page_id, lang))}</loc>",
                    f"        <lastmod>{lastmod}</lastmod>",
                    f"        <priority>{sitemap_priority(page_id, lang)}</priority>",
                    "    </url>",
                )
            )

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def render_webmanifest() -> str:
    """Render the web app manifest with raster icons and SVG fallback."""

    manifest = {
        "name": "Naimul Kabir Portfolio",
        "short_name": "NaimulKabir",
        "icons": [
            {
                "src": "/assets/icons/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/assets/icons/android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/assets/images/logo.svg",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any",
            },
        ],
        "theme_color": "#2f261a",
        "background_color": "#f7f0e1",
        "display": "standalone",
    }
    return json.dumps(manifest, indent=4) + "\n"


def render_service_worker(content: SiteContent, build_date: str) -> str:
    """Render a network-first service worker with offline fallback caches."""

    page_routes = sorted(
        {route for route_map in content.routes.values() for route in route_map.values()}
    )
    precache_urls = ["/", "/index.html"]
    precache_urls.extend(f"/{route.lstrip('/')}" for route in page_routes)
    precache_urls.extend(f"/{asset.lstrip('/')}" for asset in SERVICE_WORKER_ASSET_PATHS)
    deduped_urls = tuple(dict.fromkeys(precache_urls))
    cache_token = build_date.replace("-", "")
    source = "\n".join(
        (
            "/// <reference lib=\"webworker\" />",
            "// @ts-check",
            "/**",
            " * Generated offline-first service worker.",
            " *",
            " * Strategy:",
            " * - Online: network-first for same-origin GET requests (fresh data first).",
            " * - Offline: fallback to cached content.",
            " *",
            " * Type notes:",
            " * - Includes WebWorker lib reference for editor + @ts-check type resolution.",
            " * - Event handlers use explicit JSDoc parameter types for stricter checks.",
            " */",
            f'const PRECACHE_NAME = "person-portfolio-precache-{cache_token}";',
            f'const RUNTIME_CACHE_NAME = "person-portfolio-runtime-{cache_token}";',
            f"const PRECACHE_URLS = {script_safe_json(deduped_urls)};",
            "",
            "/** @type {ServiceWorkerGlobalScope} */",
            "const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));",
            "",
            "// Install: precache shell/assets so first offline navigation succeeds.",
            "sw.addEventListener(\"install\", /** @param {ExtendableEvent} event */ function (event) {",
            "  event.waitUntil(",
            "    caches",
            "      .open(PRECACHE_NAME)",
            "      .then(function (cache) {",
            "        return cache.addAll(PRECACHE_URLS);",
            "      })",
            "      .then(function () {",
            "        return sw.skipWaiting();",
            "      })",
            "  );",
            "});",
            "",
            "// Activate: clean old caches and take control immediately.",
            "sw.addEventListener(\"activate\", /** @param {ExtendableEvent} event */ function (event) {",
            "  event.waitUntil(",
            "    caches.keys().then(function (keys) {",
            "      return Promise.all(",
            "        keys",
            "          .filter(function (key) {",
            "            return key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME;",
            "          })",
            "          .map(function (key) {",
            "            return caches.delete(key);",
            "          })",
            "      );",
            "    }).then(function () {",
            "      return sw.clients.claim();",
            "    })",
            "  );",
            "});",
            "",
            "/**",
            " * @param {Request} request",
            " * @returns {Promise<Response | undefined>}",
            " */",
            "async function matchOfflineFallback(request) {",
            "  const runtime = await caches.open(RUNTIME_CACHE_NAME);",
            "  const runtimeMatch = await runtime.match(request);",
            "  if (runtimeMatch) {",
            "    return runtimeMatch;",
            "  }",
            "",
            "  const precache = await caches.open(PRECACHE_NAME);",
            "  const precacheMatch = await precache.match(request);",
            "  if (precacheMatch) {",
            "    return precacheMatch;",
            "  }",
            "",
            "  if (request.mode === \"navigate\") {",
            "    return precache.match(\"/index.html\");",
            "  }",
            "",
            "  return undefined;",
            "}",
            "",
            "/**",
            " * @param {Request} request",
            " * @returns {Promise<Response>}",
            " */",
            "async function networkFirst(request) {",
            "  const runtime = await caches.open(RUNTIME_CACHE_NAME);",
            "  try {",
            "    const networkResponse = await fetch(request);",
            "    if (networkResponse.ok) {",
            "      await runtime.put(request, networkResponse.clone());",
            "    }",
            "    return networkResponse;",
            "  } catch (_error) {",
            "    const fallback = await matchOfflineFallback(request);",
            "    if (fallback) {",
            "      return fallback;",
            "    }",
            "",
            "    if (request.mode === \"navigate\") {",
            "      return new Response(",
            "        \"<!doctype html><title>Offline</title><h1>Offline</h1><p>This page is not available offline yet.</p>\",",
            "        { headers: { \"Content-Type\": \"text/html; charset=utf-8\" }, status: 503 }",
            "      );",
            "    }",
            "",
            "    return new Response(\"\", { status: 504, statusText: \"Offline\" });",
            "  }",
            "}",
            "",
            "// Fetch: network-first to keep data fresh while still working offline.",
            "sw.addEventListener(\"fetch\", /** @param {FetchEvent} event */ function (event) {",
            "  const request = event.request;",
            "  if (request.method !== \"GET\") {",
            "    return;",
            "  }",
            "",
            "  // Skip unsupported devtools requests.",
            "  if (request.cache === \"only-if-cached\" && request.mode !== \"same-origin\") {",
            "    return;",
            "  }",
            "",
            "  const url = new URL(request.url);",
            "  if (url.origin !== sw.location.origin) {",
            "    return;",
            "  }",
            "",
            "  event.respondWith(networkFirst(request));",
            "});",
            "",
        )
    )
    return source


def render_footer(
    footer_html: HtmlFragment,
    lang: Lang,
    build_timestamp_iso: str,
    build_timestamp_display: str,
) -> str:
    """Render the page footer."""

    stamped_footer_html = str(footer_html)
    has_time = re.search(r"<time\b", stamped_footer_html) is not None
    if has_time:
        stamped_footer_html = re.sub(
            r'(<time\b[^>]*datetime=")[^"]*(")',
            rf"\g<1>{html.escape(build_timestamp_iso)}\g<2>",
            stamped_footer_html,
            count=1,
        )
        stamped_footer_html = re.sub(
            r"(<time\b[^>]*>).*?(</time>)",
            rf"\g<1>{html.escape(build_timestamp_display)}\g<2>",
            stamped_footer_html,
            count=1,
            flags=re.DOTALL,
        )
    else:
        stamped_footer_html = (
            f'{stamped_footer_html} <span class="footer-meta">· {html.escape(LAST_UPDATED_LABELS[lang])} '
            f'<time datetime="{html.escape(build_timestamp_iso)}">{html.escape(build_timestamp_display)}</time></span>'
        )
    return "\n".join(("    <footer>", f"      <p>{stamped_footer_html}</p>", "    </footer>"))


def render_scripts(page_id: PageId, current_output: str) -> str:
    """Render deferred script tags for a page."""

    default_scripts = (
        "assets/js/image-guard.js",
        "assets/js/theme-toggle.js",
        "assets/js/language-switcher.js",
        "assets/js/umami-events.js",
        "assets/js/year.js",
        "assets/js/service-worker-register.js",
    )
    long_page_scripts = (
        "assets/js/image-guard.js",
        "assets/js/back-to-top.js",
        "assets/js/theme-toggle.js",
        "assets/js/language-switcher.js",
        "assets/js/umami-events.js",
        "assets/js/year.js",
        "assets/js/service-worker-register.js",
    )
    index_scripts = (
        "assets/js/image-guard.js",
        "assets/js/back-to-top.js",
        "assets/js/theme-toggle.js",
        "assets/js/language-switcher.js",
        "assets/js/umami-events.js",
        "assets/js/stats-snapshots.js",
        "assets/js/stats-utils.js",
        "assets/js/wakatime-charts.js",
        "assets/js/goodreads-image-fallback.js",
        "assets/js/year.js",
        "assets/js/service-worker-register.js",
    )
    stats_scripts = (
        "assets/js/image-guard.js",
        "assets/js/theme-toggle.js",
        "assets/js/stats-theme-embeds.js",
        "assets/js/goodreads-image-fallback.js",
        "assets/js/language-switcher.js",
        "assets/js/umami-events.js",
        "assets/js/stats-snapshots.js",
        "assets/js/stats-utils.js",
        "assets/js/wakatime-charts.js",
        "assets/js/github-commits.js",
        "assets/js/year.js",
        "assets/js/service-worker-register.js",
    )
    if page_id == "stats":
        paths = stats_scripts
    elif page_id == "index":
        paths = index_scripts
    elif page_id in ("work", "project"):
        paths = long_page_scripts
    else:
        paths = default_scripts
    rendered_scripts: list[str] = []
    for path in paths:
        rendered_scripts.append(f'  <script defer src="{html.escape(asset_href(current_output, path))}"></script>')
    return "\n".join(rendered_scripts)


def render_back_to_top_button(lang: Lang) -> str:
    """Render the lightweight back-to-top control for long pages."""

    label = BACK_TO_TOP_LABELS[lang]
    return "\n".join(
        (
            (
                '    <button class="back-to-top" type="button" data-back-to-top hidden '
                f'aria-label="{html.escape(label)}" title="{html.escape(label)}">'
            ),
            '      <span aria-hidden="true">↑</span>',
            "    </button>",
        )
    )


def render_content_card(card: ContentCard) -> str:
    """Render a reusable content card."""

    title_html = html.escape(card.title)
    if card.href is not None:
        title_html = (
            f'<a href="{html.escape(card.href)}" target="_blank" rel="noreferrer">{title_html}</a>'
        )
    lines = ['          <article class="highlight">', f"            <h3>{title_html}</h3>"]
    if card.meta is not None:
        lines.append(f"            <p class=\"meta\">{html.escape(card.meta)}</p>")
    for paragraph in card.paragraphs:
        lines.append(f"            <p>{paragraph}</p>")
    if card.bullets:
        lines.append("            <ul>")
        for bullet in card.bullets:
            lines.append(f"              <li>{bullet}</li>")
        lines.append("            </ul>")
    lines.append("          </article>")
    return "\n".join(lines)


def render_article_teaser(article: ArticleLink) -> str:
    """Render a linked article teaser card."""

    return "\n".join(
        (
            '          <li class="article-item">',
            (
                f'            <a href="{html.escape(article.href)}" target="_blank" rel="noreferrer" '
                'data-umami-track-article="true">'
            ),
            f"              <h3>{html.escape(article.title)}</h3>",
            f"              <p>{html.escape(article.summary)}</p>",
            "            </a>",
            "          </li>",
        )
    )


def render_index_action(
    action: IndexAction,
    routes: RouteTable,
    lang: Lang,
    current_output: str,
) -> str:
    """Render a homepage CTA action link."""

    href = action.href
    nav_attr = ""
    if action.page_id is not None:
        href = relative_href(current_output, route_for_action(routes, action.page_id, lang))
        nav_attr = f' data-nav-page-id="{action.page_id}"'

    if href is None:
        raise ValueError("IndexAction must define href or page_id")

    is_external = href.startswith("http://") or href.startswith("https://")
    is_mailto = href.startswith("mailto:")
    target_attr = ' target="_blank"' if is_external else ""
    rel_attr = ' rel="noreferrer"' if is_external else ""
    variant_class = "action-chip action-chip--primary" if action.variant == "primary" else "action-chip action-chip--secondary"
    icon_markup = ""
    label_text = action.label
    if is_mailto:
        label_text = action.label.lstrip("✉").strip()
        icon_markup = (
            '<svg class="action-chip-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" '
            'xmlns="http://www.w3.org/2000/svg">'
            '<path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'
            '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round"></rect></svg>'
        )

    return (
        f'            <a class="{variant_class}" href="{html.escape(href)}"{target_attr}{rel_attr}{nav_attr}>'
        f"{icon_markup}<span>{html.escape(label_text)}</span></a>"
    )


def render_index_view_all_stats_action(routes: RouteTable, lang: Lang, current_output: str) -> str:
    """Render a localized CTA that links to the full stats page."""

    return render_index_action(
        IndexAction(
            label=VIEW_ALL_STATS_LABELS[lang],
            href=None,
            page_id="stats",
            variant="secondary",
        ),
        routes,
        lang,
        current_output,
    )


def render_wakatime_widget(section: WakaTimeSection) -> tuple[str, ...]:
    """Render the WakaTime widget shell shared by index and stats pages."""

    return (
        (
            '          <div class="wakatime-widget" data-wakatime-widget '
            f'data-wakatime-languages-url="{html.escape(section.languages_url)}" '
            f'data-wakatime-summary-url="{html.escape(section.summary_url)}">'
        ),
        f'            <p class="wakatime-status" data-role="status">{html.escape(section.status_text)}</p>',
        '            <div class="wakatime-visuals" data-role="visuals" hidden>',
        '              <div class="wakatime-summary" data-role="summary-cards"></div>',
        (
            '              <ol class="wakatime-bars" data-role="language-bars" '
            f'aria-label="{html.escape(section.aria_label)}"></ol>'
        ),
        "            </div>",
        "          </div>",
    )


def render_compact_wakatime_widget(section: WakaTimeSection) -> tuple[str, ...]:
    """Render compact WakaTime language chips for the homepage."""

    return (
        (
            '          <div class="wakatime-widget" data-wakatime-widget data-wakatime-display="compact" '
            f'data-wakatime-languages-url="{html.escape(section.languages_url)}" '
            f'data-wakatime-summary-url="{html.escape(section.summary_url)}">'
        ),
        f'            <p class="wakatime-status" data-role="status">{html.escape(section.status_text)}</p>',
        '            <div class="wakatime-visuals" data-role="visuals" hidden>',
        '              <div class="wakatime-language-topbar" data-role="language-topbar" aria-hidden="true"></div>',
        (
            '              <ul class="wakatime-language-chip-list" data-role="language-chips" '
            f'aria-label="{html.escape(section.aria_label)}"></ul>'
        ),
        "            </div>",
        "          </div>",
    )


def render_goodreads_widget(section: GoodreadsSection) -> tuple[str, ...]:
    """Render the Goodreads widget shell shared by index and stats pages."""

    return (
        f"          <p>{html.escape(section.copy)}</p>",
        '          <p class="goodreads-status" data-goodreads-status>Loading Goodreads books…</p>',
        f'          <div class="goodreads-widget" id="gr_grid_widget_{html.escape(section.widget_id)}"></div>',
    )


def render_index_stats_sections(
    stats: StatsPageLocale,
    routes: RouteTable,
    lang: Lang,
    current_output: str,
) -> tuple[str, ...]:
    """Render compact stats sections on the homepage."""

    view_all_stats_action = render_index_view_all_stats_action(routes, lang, current_output)
    home_wakatime_titles: Mapping[Lang, str] = {
        "en": "Skills & Languages",
        "bn": "স্কিলস ও ভাষা",
        "ar": "المهارات واللغات",
        "ur": "مہارتیں اور زبانیں",
    }
    lines = [
        "      <section>",
        '        <div class="summary-card stats-card">',
        '          <div class="section-head">',
        f"            <h2 class=\"section-title\">{html.escape(home_wakatime_titles[lang])}</h2>",
        '            <div class="section-actions">',
        f"              {view_all_stats_action}",
        "            </div>",
        "          </div>",
        *render_compact_wakatime_widget(stats.sections.wakatime),
        "        </div>",
        "      </section>",
        "      <section>",
        '        <div class="summary-card stats-card">',
        '          <div class="section-head">',
        f"            <h2 class=\"section-title\">{html.escape(stats.sections.goodreads.title)}</h2>",
        '            <div class="section-actions">',
        f"              {view_all_stats_action}",
        "            </div>",
        "          </div>",
        *render_goodreads_widget(stats.sections.goodreads),
        "        </div>",
        "      </section>",
    ]
    return tuple(lines)


def render_index_main(
    page: IndexPageLocale,
    stats: StatsPageLocale,
    routes: RouteTable,
    lang: Lang,
    current_output: str,
) -> str:
    """Render homepage main content."""

    lines = ['    <main id="main-content">']

    lines.extend(("      <section class=\"about-section\">", '        <div class="summary-card summary-card--about">'))
    for paragraph in page.summary_card:
        lines.append(f"          <p>{paragraph}</p>")
    lines.extend(("        </div>", "      </section>"))
    for index, section in enumerate(page.sections):
        # Skills chips are replaced by homepage WakaTime + Goodreads stats sections.
        if section.tags:
            continue
        lines.append("      <section>")
        lines.append('        <div class="section-head">')
        title_class = "section-title section-title--minor" if index == 0 else "section-title"
        lines.append(f"          <h2 class=\"{title_class}\">{html.escape(section.title)}</h2>")
        if section.actions:
            lines.append('          <div class="section-actions">')
            for action in section.actions:
                lines.append(render_index_action(action, routes, lang, current_output))
            lines.append("          </div>")
        lines.append("        </div>")
        for paragraph in section.paragraphs:
            lines.append(f"        <p>{paragraph}</p>")
        if section.highlights:
            lines.append('        <div class="highlight-list">')
            for item in section.highlights:
                lines.append(render_content_card(item))
            lines.append("        </div>")
        if section.tags:
            lines.append('        <ul class="skill-chip-list">')
            for tag in section.tags:
                lines.append(f"          <li class=\"skill-chip\">{html.escape(tag)}</li>")
            lines.append("        </ul>")
        if section.articles:
            lines.append('        <ul class="article-list">')
            for article in section.articles:
                lines.append(render_article_teaser(article))
            lines.append("        </ul>")
        for contact in section.contacts:
            lines.append(f"        <p>{contact}</p>")
        lines.append("      </section>")
    lines.extend(render_index_stats_sections(stats, routes, lang, current_output))
    lines.append("    </main>")
    return "\n".join(lines)


def render_work_main(page: WorkPageLocale) -> str:
    """Render work page main content."""

    lines = [
        '    <main id="main-content">',
        "      <section>",
        '        <div class="summary-card">',
        f"          <p>{page.summary}</p>",
        "        </div>",
        "      </section>",
        "      <section>",
        f"        <h2 class=\"section-title\">{html.escape(page.section_title)}</h2>",
        '        <div class="highlight-list">',
    ]
    for entry in page.entries:
        lines.append(render_content_card(entry))
    lines.extend(("        </div>", "      </section>", "    </main>"))
    return "\n".join(lines)


def render_project_main(page: ProjectPageLocale) -> str:
    """Render project page main content."""

    lines = ['    <main id="main-content">']
    for group in page.groups:
        lines.extend(
            (
                "      <section>",
                f"        <h2 class=\"section-title\">{html.escape(group.title)}</h2>",
                '        <div class="highlight-list">',
            )
        )
        for item in group.items:
            lines.append(render_content_card(item))
        lines.extend(("        </div>", "      </section>"))
    lines.append("    </main>")
    return "\n".join(lines)


def render_blog_main(page: BlogPageLocale) -> str:
    """Render blog page main content."""

    lines = ['    <main id="main-content">', "      <section>"]
    for article in page.articles:
        lines.extend(
            (
                '        <article class="blog-entry">',
                '          <h2 class="section-title">',
                (
                    f'            <a href="{html.escape(article.href)}" target="_blank" rel="noreferrer" '
                    'data-umami-track-article="true">'
                    f"{html.escape(article.title)}</a>"
                ),
                "          </h2>",
                f"          <p class=\"meta\">{html.escape(article.meta)}</p>",
                f"          <p>{html.escape(article.summary)}</p>",
                "        </article>",
            )
        )
    lines.extend(("      </section>", "    </main>"))
    return "\n".join(lines)


def render_stats_main(page: StatsPageLocale) -> str:
    """Render stats page main content."""

    stats = page.sections
    leetcode_light_src, leetcode_dark_src = stats_embed_theme_sources(
        stats.leetcode.card_src,
        provider="leetcode",
    )
    roadmap_light_src, roadmap_dark_src = stats_embed_theme_sources(
        stats.learning_path.image_src,
        provider="roadmap",
    )
    roadmap_light_href, roadmap_dark_href = stats_embed_theme_sources(
        stats.learning_path.href,
        provider="roadmap",
    )
    lines = ['    <main id="main-content">', "      <section>"]
    for paragraph in page.intro:
        lines.append(f"        <p>{paragraph}</p>")
    lines.extend(
        (
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats.wakatime.title)}</h2>",
            *render_wakatime_widget(stats.wakatime),
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats.github_commits.title)}</h2>",
            f"          <p>{html.escape(stats.github_commits.description)}</p>",
            (
                '          <div class="github-commits-widget" data-github-commits-widget '
                f'data-github-contrib-url="{html.escape(stats.github_commits.contrib_url)}">'
            ),
            (
                f'            <p class="github-commits-status" data-role="status">'
                f"{html.escape(stats.github_commits.status_text)}</p>"
            ),
            '            <div class="github-commits-visuals" data-role="visuals" hidden>',
            '              <div class="github-commits-summary" data-role="summary-cards"></div>',
            '              <div class="github-heatmap-wrap">',
            '                <div class="github-heatmap-scroll">',
            (
                '                  <div class="github-heatmap" data-role="heatmap" '
                f'aria-label="{html.escape(stats.github_commits.heatmap_aria_label)}"></div>'
            ),
            "                </div>",
            (
                '                <div class="github-heatmap-legend" data-role="legend" '
                f'aria-label="{html.escape(stats.github_commits.legend_aria_label)}"></div>'
            ),
            "              </div>",
            "            </div>",
            "          </div>",
            (
                f'          <p class="meta">{html.escape(stats.github_commits.source_label)} '
                f'<a href="{html.escape(stats.github_commits.source_href)}" target="_blank" rel="noreferrer">'
                f"{html.escape(stats.github_commits.source_text)}</a></p>"
            ),
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats.leetcode.title)}</h2>",
            f"          <p>{stats.leetcode.copy}</p>",
            f"          <p><sub>{stats.leetcode.thanks}</sub></p>",
            (
                f'          <img data-hide-section-on-error="true" class="stats-embed stats-embed--leetcode-card" '
                f'src="{html.escape(leetcode_light_src)}" '
                f'data-theme-light-src="{html.escape(leetcode_light_src)}" '
                f'data-theme-dark-src="{html.escape(leetcode_dark_src)}" '
                f'alt="{html.escape(stats.leetcode.card_alt)}" width="500" height="250" decoding="async" loading="lazy" />'
            ),
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats.learning_path.title)}</h2>",
            f"          <p>{stats.learning_path.copy}</p>",
            (
                f'          <a href="{html.escape(roadmap_light_href)}" '
                f'data-theme-light-href="{html.escape(roadmap_light_href)}" '
                f'data-theme-dark-href="{html.escape(roadmap_dark_href)}">'
                f'<img data-hide-section-on-error="true" class="stats-embed stats-embed--roadmap-card" '
                f'src="{html.escape(roadmap_light_src)}" '
                f'data-theme-light-src="{html.escape(roadmap_light_src)}" '
                f'data-theme-dark-src="{html.escape(roadmap_dark_src)}" '
                f'alt="{html.escape(stats.learning_path.image_alt)}" width="1130" height="380" decoding="async" loading="lazy" /></a>'
            ),
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats.goodreads.title)}</h2>",
            *render_goodreads_widget(stats.goodreads),
            (
                '          <p class="goodreads-profile-link">'
                f'<a href="{html.escape(stats.goodreads.profile_href)}" target="_blank" rel="noreferrer">'
                "View full Goodreads shelf</a></p>"
            ),
            "        </div>",
            "      </section>",
            "    </main>",
        )
    )
    return "\n".join(lines)


def render_main_for_page(
    content: SiteContent,
    page_id: PageId,
    lang: Lang,
    current_output: str,
) -> str:
    """Dispatch to the correct page renderer using typed locale data."""

    if page_id == "index":
        return render_index_main(
            content.index_page.locales[lang],
            stats_locale_for_lang(content, lang),
            content.routes,
            lang,
            current_output,
        )
    if page_id == "work":
        return render_work_main(content.work_page.locales[lang])
    if page_id == "project":
        return render_project_main(content.project_page.locales[lang])
    if page_id == "blog":
        return render_blog_main(content.blog_page.locales[lang])
    return render_stats_main(content.stats_page.locales[lang])


def stats_locale_for_lang(content: SiteContent, lang: Lang) -> StatsPageLocale:
    """Return localized stats content, falling back to English when unavailable."""

    return content.stats_page.locales.get(
        lang,
        content.stats_page.locales.get("en", next(iter(content.stats_page.locales.values()))),
    )


def meta_for_page(content: SiteContent, page_id: PageId, lang: Lang) -> MetaText:
    """Fetch typed page metadata."""

    if page_id == "index":
        return content.index_page.locales[lang].meta
    if page_id == "work":
        return content.work_page.locales[lang].meta
    if page_id == "project":
        return content.project_page.locales[lang].meta
    if page_id == "blog":
        return content.blog_page.locales[lang].meta
    return content.stats_page.locales[lang].meta


def header_for_page(content: SiteContent, page_id: PageId, lang: Lang) -> HeaderText:
    """Fetch typed header copy."""

    if page_id == "index":
        return content.index_page.locales[lang].header
    if page_id == "work":
        return content.work_page.locales[lang].header
    if page_id == "project":
        return content.project_page.locales[lang].header
    if page_id == "blog":
        return content.blog_page.locales[lang].header
    return content.stats_page.locales[lang].header


def footer_for_page(content: SiteContent, page_id: PageId, lang: Lang) -> HtmlFragment:
    """Fetch typed footer HTML."""

    if page_id == "index":
        return content.index_page.locales[lang].footer_html
    if page_id == "work":
        return content.work_page.locales[lang].footer_html
    if page_id == "project":
        return content.project_page.locales[lang].footer_html
    if page_id == "blog":
        return content.blog_page.locales[lang].footer_html
    return content.stats_page.locales[lang].footer_html


def render_hero(current_output: str) -> str:
    """Render the shared logo asset used as the hero illustration."""

    logo_href = asset_href(current_output, "assets/images/logo.svg")
    return (
        '<img class="hero-illustration" alt="" aria-hidden="true" '
        f'src="{html.escape(logo_href)}" width="1024" height="1024" decoding="async" fetchpriority="high" />'
    )


def render_header_identity(header: HeaderText, current_output: str) -> str:
    """Render the avatar + title row in the header."""

    return "\n".join(
        (
            '      <div class="header-identity">',
            f"        {render_hero(current_output)}",
            '        <div class="header-identity-copy">',
            f"          <h1 class=\"site-title\">{html.escape(header.site_title)}</h1>",
            f"          <p class=\"tagline\">{html.escape(header.tagline)}</p>",
            "        </div>",
            "      </div>",
        )
    )


def render_page_heading(header: HeaderText) -> str:
    """Render compact non-home heading without avatar or social links."""

    return "\n".join(
        (
            '      <div class="page-heading">',
            f"        <h1 class=\"site-title site-title--page\">{html.escape(header.site_title)}</h1>",
            f"        <p class=\"tagline\">{html.escape(header.tagline)}</p>",
            "      </div>",
        )
    )


def render_skip_link(lang: Lang) -> str:
    """Render an accessible skip link for keyboard users."""

    return (
        f'  <a class="skip-link" href="#main-content">'
        f"{html.escape(SKIP_TO_MAIN_LABELS[lang])}</a>"
    )


def render_page(
    content: SiteContent,
    page_id: PageId,
    lang: Lang,
    route: str,
    og_type: str,
    build_timestamp_iso: str,
    build_timestamp_display: str,
) -> str:
    """Render one page to a full HTML document."""

    del og_type  # The og:type is derived from the page kind in render_head.
    locale = content.site.locales[lang]
    header = header_for_page(content, page_id, lang)
    head = render_head(content.site, content.routes, page_id, lang, route, route, meta_for_page(content, page_id, lang))
    body_lines = [
        (
            f'<body data-page-id="{page_id}" '
            f'data-sw-path="{html.escape(asset_href(route, SERVICE_WORKER_OUTPUT_RELATIVE_PATH))}">'
        ),
        render_skip_link(lang),
        '  <div class="site">',
        '    <header id="top">',
        render_header_controls(content.site, content.routes, page_id, lang, route),
        render_header_identity(header, route) if page_id == "index" else render_page_heading(header),
        (
            render_social_chips(content.site, index_email_action(content.index_page.locales[lang]))
            if page_id == "index"
            else ""
        ),
        render_nav(content, page_id, lang, route) if page_id != "index" else "",
        "    </header>",
        render_main_for_page(content, page_id, lang, route),
        render_footer(
            footer_for_page(content, page_id, lang),
            lang,
            build_timestamp_iso,
            build_timestamp_display,
        ),
        "  </div>",
        render_back_to_top_button(lang) if page_id in ("work", "project", "index") else "",
        render_scripts(page_id, route),
    ]
    if page_id in ("stats", "index"):
        goodreads = stats_locale_for_lang(content, lang).sections.goodreads
        body_lines.append(
            f'  <script src="{html.escape(goodreads.script_src)}" type="text/javascript" charset="utf-8"></script>'
        )
    body_lines.append("</body>")
    body = "\n".join(body_lines)
    document = "\n".join(
        (
            "<!DOCTYPE html>",
            GENERATED_COMMENT,
            f"<html {page_lang_attrs(locale, lang)}>",
            "",
            head,
            "",
            body,
            "",
            "</html>",
            "",
        )
    )
    return minify_html_document(document)
