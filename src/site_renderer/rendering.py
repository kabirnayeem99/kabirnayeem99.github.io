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
    OG_LOCALE_BY_LANG,
    PAGE_IDS,
    SERVICE_WORKER_ASSET_PATHS,
    SERVICE_WORKER_OUTPUT_RELATIVE_PATH,
    SKIP_TO_MAIN_LABELS,
    THEME_BOOTSTRAP_SCRIPT,
    THEME_DARK_LABELS,
    THEME_LIGHT_LABELS,
    HtmlFragment,
    Lang,
    PageId,
)
from .minify import minify_html_document
from .models import (
    ArticleLink,
    BlogPageLocale,
    ContentCard,
    HeaderText,
    IndexPageLocale,
    LocaleInfo,
    MetaText,
    ProjectPageLocale,
    RouteTable,
    SiteContent,
    SiteSettings,
    StatsPageLocale,
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


def render_footer(footer_html: HtmlFragment, build_date: str) -> str:
    """Render the page footer."""

    stamped_footer_html = str(footer_html)
    stamped_footer_html = re.sub(
        r'(<time\b[^>]*id="last-refreshed"[^>]*datetime=")[^"]*(")',
        rf"\g<1>{build_date}\g<2>",
        stamped_footer_html,
        count=1,
    )
    stamped_footer_html = re.sub(
        r'(<time\b[^>]*id="last-refreshed"[^>]*>).*?(</time>)',
        rf"\g<1>{build_date}\g<2>",
        stamped_footer_html,
        count=1,
        flags=re.DOTALL,
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


def render_index_main(page: IndexPageLocale) -> str:
    """Render homepage main content."""

    lines = ['    <main id="main-content">', "      <section>", '        <div class="summary-card">']
    for paragraph in page.summary_card:
        lines.append(f"          <p>{paragraph}</p>")
    lines.extend(("        </div>", "      </section>"))
    for section in page.sections:
        lines.append("      <section>")
        lines.append(f"        <h2 class=\"section-title\">{html.escape(section.title)}</h2>")
        for paragraph in section.paragraphs:
            lines.append(f"        <p>{paragraph}</p>")
        if section.highlights:
            lines.append('        <div class="highlight-list">')
            for item in section.highlights:
                lines.append(render_content_card(item))
            lines.append("        </div>")
        if section.articles:
            lines.append('        <ul class="article-list">')
            for article in section.articles:
                lines.append(render_article_teaser(article))
            lines.append("        </ul>")
        for contact in section.contacts:
            lines.append(f"        <p>{contact}</p>")
        lines.append("      </section>")
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
    for index, article in enumerate(page.articles):
        if index > 0:
            lines.append("        <hr />")
        lines.extend(
            (
                "        <article>",
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
            (
                '          <div class="wakatime-widget" data-wakatime-widget '
                f'data-wakatime-languages-url="{html.escape(stats.wakatime.languages_url)}" '
                f'data-wakatime-summary-url="{html.escape(stats.wakatime.summary_url)}">'
            ),
            f'            <p class="wakatime-status" data-role="status">{html.escape(stats.wakatime.status_text)}</p>',
            '            <div class="wakatime-visuals" data-role="visuals" hidden>',
            '              <div class="wakatime-summary" data-role="summary-cards"></div>',
            (
                '              <ol class="wakatime-bars" data-role="language-bars" '
                f'aria-label="{html.escape(stats.wakatime.aria_label)}"></ol>'
            ),
            "            </div>",
            "          </div>",
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
            "          <br />",
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
            f"          <p>{html.escape(stats.goodreads.copy)}</p>",
            '          <p class="goodreads-status" data-goodreads-status>Loading Goodreads books…</p>',
            f'          <div class="goodreads-widget" id="gr_grid_widget_{html.escape(stats.goodreads.widget_id)}"></div>',
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
) -> str:
    """Dispatch to the correct page renderer using typed locale data."""

    if page_id == "index":
        return render_index_main(content.index_page.locales[lang])
    if page_id == "work":
        return render_work_main(content.work_page.locales[lang])
    if page_id == "project":
        return render_project_main(content.project_page.locales[lang])
    if page_id == "blog":
        return render_blog_main(content.blog_page.locales[lang])
    return render_stats_main(content.stats_page.locales[lang])


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
        '      <img class="hero-illustration" alt="" aria-hidden="true" '
        f'src="{html.escape(logo_href)}" width="1024" height="1024" decoding="async" fetchpriority="high" />'
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
    build_date: str,
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
        render_hero(route),
        f"      <h1 class=\"site-title\">{html.escape(header.site_title)}</h1>",
        f"      <p class=\"tagline\">{html.escape(header.tagline)}</p>",
        render_nav(content, page_id, lang, route),
        "    </header>",
        render_main_for_page(content, page_id, lang),
        render_footer(footer_for_page(content, page_id, lang), build_date),
        "  </div>",
        render_back_to_top_button(lang) if page_id in ("work", "project") else "",
        render_scripts(page_id, route),
    ]
    if page_id == "stats":
        goodreads = content.stats_page.locales[lang].sections.goodreads
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
