#!/usr/bin/env python3

from __future__ import annotations

import html
import json
import posixpath
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
CONTENT_PATH = ROOT / "content" / "site-content.json"
GENERATED_COMMENT = "<!-- Generated from content/site-content.json by scripts/render_site.py. -->"


def load_content() -> dict[str, Any]:
    return json.loads(CONTENT_PATH.read_text(encoding="utf-8"))


def relative_href(from_output: str, to_output: str) -> str:
    from_dir = posixpath.dirname(from_output) or "."
    return posixpath.relpath(to_output, start=from_dir)


def asset_href(current_output: str, asset_path: str) -> str:
    return relative_href(current_output, asset_path)


def route_for(routes: dict[str, dict[str, str]], page_id: str, lang: str) -> str:
    page_routes = routes[page_id]
    if lang in page_routes:
      return page_routes[lang]
    return routes["index"][lang]


def canonical_url(base_url: str, route: str, page_id: str, lang: str) -> str:
    if page_id == "index" and lang == "en":
        return f"{base_url}/"
    return f"{base_url}/{route}"


def page_lang_attrs(site: dict[str, Any], lang: str) -> str:
    locale = site["locales"][lang]
    dir_value = locale.get("dir")
    if dir_value:
        return f'lang="{lang}" dir="{dir_value}"'
    return f'lang="{lang}"'


def render_head(
    site: dict[str, Any],
    page_id: str,
    lang: str,
    route: str,
    current_output: str,
    page_locale: dict[str, Any],
    og_type: str,
) -> str:
    meta = page_locale["meta"]
    author = site["locales"][lang]["author"]
    og_alt = site["locales"][lang]["og_image_alt"]
    canonical = canonical_url(site["base_url"], route, page_id, lang)
    stylesheet = asset_href(current_output, "assets/css/styles.css")
    favicon_ico = asset_href(current_output, "assets/icons/favicon.ico")
    favicon_32 = asset_href(current_output, "assets/icons/favicon-32x32.png")
    favicon_16 = asset_href(current_output, "assets/icons/favicon-16x16.png")
    apple_touch = asset_href(current_output, "assets/icons/apple-touch-icon.png")
    manifest = asset_href(current_output, "site.webmanifest")
    og_image = f'{site["base_url"]}/assets/icons/android-chrome-512x512.png'

    return "\n".join(
        [
            "<head>",
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            f"  <title>{html.escape(meta['title'])}</title>",
            f'  <meta name="description" content="{html.escape(meta["description"])}" />',
            f'  <meta name="keywords" content="{html.escape(meta["keywords"])}" />',
            f'  <meta name="author" content="{html.escape(author)}" />',
            '  <meta name="robots" content="index, follow" />',
            f'  <link rel="canonical" href="{html.escape(canonical)}" />',
            f'  <meta property="og:type" content="{html.escape(og_type)}" />',
            f'  <meta property="og:site_name" content="{html.escape(author)}" />',
            f'  <meta property="og:url" content="{html.escape(canonical)}" />',
            f'  <meta property="og:title" content="{html.escape(meta["title"])}" />',
            f'  <meta property="og:description" content="{html.escape(meta["description"])}" />',
            f'  <meta property="og:image" content="{html.escape(og_image)}" />',
            f'  <meta property="og:image:alt" content="{html.escape(og_alt)}" />',
            '  <meta name="twitter:card" content="summary_large_image" />',
            f'  <meta name="twitter:title" content="{html.escape(meta["title"])}" />',
            f'  <meta name="twitter:description" content="{html.escape(meta["description"])}" />',
            f'  <meta name="twitter:image" content="{html.escape(og_image)}" />',
            f'  <link rel="preload" href="{html.escape(stylesheet)}" as="style" />',
            f'  <link rel="stylesheet" href="{html.escape(stylesheet)}" />',
            f'  <link rel="shortcut icon" href="{html.escape(favicon_ico)}" />',
            f'  <link rel="icon" type="image/png" sizes="32x32" href="{html.escape(favicon_32)}" />',
            f'  <link rel="icon" type="image/png" sizes="16x16" href="{html.escape(favicon_16)}" />',
            f'  <link rel="apple-touch-icon" href="{html.escape(apple_touch)}" />',
            f'  <link rel="manifest" href="{html.escape(manifest)}" />',
            f'  <meta name="google-site-verification" content="{html.escape(site["google_site_verification"])}" />',
            "</head>",
        ]
    )


def render_language_switcher(
    site: dict[str, Any],
    routes: dict[str, dict[str, str]],
    page_id: str,
    lang: str,
    current_output: str,
) -> str:
    switcher_label = site["locales"][lang]["language_switcher_label"]
    items: list[str] = [
        "      <details class=\"language-switcher\">",
        f'        <summary aria-label="{html.escape(switcher_label)}"><span aria-hidden="true" class="language-switcher-globe"></span><span class="language-switcher-label">{html.escape(switcher_label)}</span></summary>',
        "        <div class=\"language-menu\">",
    ]
    for target_lang, label in site["language_menu_labels"].items():
        target_route = route_for(routes, page_id, target_lang)
        href = relative_href(current_output, target_route)
        current_attr = ' aria-current="page"' if target_lang == lang else ""
        items.append(
            f'        <a href="{html.escape(href)}" lang="{target_lang}"{current_attr}>{html.escape(label)}</a>'
        )
    items.extend(["        </div>", "      </details>"])
    return "\n".join(items)


def render_nav(
    routes: dict[str, dict[str, str]],
    navigation: dict[str, list[str]],
    nav_labels: dict[str, dict[str, str]],
    page_id: str,
    lang: str,
    current_output: str,
) -> str:
    lines = ["      <nav>"]
    for nav_page in navigation[lang]:
        target_route = route_for(routes, nav_page, lang)
        href = relative_href(current_output, target_route)
        lines.append(f'        <a href="{html.escape(href)}">{html.escape(nav_labels[nav_page][lang])}</a>')
    lines.append("      </nav>")
    return "\n".join(lines)


def render_footer(page_locale: dict[str, Any]) -> str:
    return "\n".join(["    <footer>", f"      <p>{page_locale['footer_html']}</p>", "    </footer>"])


def render_scripts(page_id: str, current_output: str) -> str:
    script_map = {
        "default": ["assets/js/image-guard.js", "assets/js/year.js"],
        "stats": [
            "assets/js/image-guard.js",
            "assets/js/stats-snapshots.js",
            "assets/js/stats-utils.js",
            "assets/js/wakatime-charts.js",
            "assets/js/github-commits.js",
            "assets/js/year.js",
        ],
    }
    script_paths = script_map["stats"] if page_id == "stats" else script_map["default"]
    return "\n".join(
        f'  <script defer src="{html.escape(asset_href(current_output, path))}"></script>' for path in script_paths
    )


def render_highlight_card(item: dict[str, Any]) -> str:
    title = html.escape(item["title"])
    if "href" in item:
        title_html = f'<a href="{html.escape(item["href"])}" target="_blank" rel="noreferrer">{title}</a>'
    else:
        title_html = title
    lines = ["          <article class=\"highlight\">", f"            <h3>{title_html}</h3>"]
    if item.get("meta"):
        lines.append(f"            <p class=\"meta\">{html.escape(item['meta'])}</p>")
    for paragraph in item.get("paragraphs", []):
        lines.append(f"            <p>{paragraph}</p>")
    if item.get("bullets"):
        lines.append("            <ul>")
        for bullet in item["bullets"]:
            lines.append(f"              <li>{bullet}</li>")
        lines.append("            </ul>")
    lines.append("          </article>")
    return "\n".join(lines)


def render_article_item(item: dict[str, Any]) -> str:
    return "\n".join(
        [
            "          <li class=\"article-item\">",
            f'            <a href="{html.escape(item["href"])}" target="_blank" rel="noreferrer">',
            f"              <h3>{html.escape(item['title'])}</h3>",
            f"              <p>{html.escape(item['summary'])}</p>",
            "            </a>",
            "          </li>",
        ]
    )


def render_index_main(page_locale: dict[str, Any]) -> str:
    lines = ["    <main>", "      <section>", '        <div class="summary-card">']
    for paragraph in page_locale["summary_card"]:
        lines.append(f"          <p>{paragraph}</p>")
    lines.extend(["        </div>", "      </section>"])
    for section in page_locale["sections"]:
        lines.append("      <section>")
        lines.append(f"        <h2 class=\"section-title\">{html.escape(section['title'])}</h2>")
        for paragraph in section.get("paragraphs", []):
            lines.append(f"        <p>{paragraph}</p>")
        if section.get("highlights"):
            lines.append('        <div class="highlight-list">')
            for item in section["highlights"]:
                lines.append(render_highlight_card(item))
            lines.append("        </div>")
        if section.get("articles"):
            lines.append('        <ul class="article-list">')
            for item in section["articles"]:
                lines.append(render_article_item(item))
            lines.append("        </ul>")
        if section.get("contacts"):
            for paragraph in section["contacts"]:
                lines.append(f"        <p>{paragraph}</p>")
        lines.append("      </section>")
    lines.append("    </main>")
    return "\n".join(lines)


def render_work_main(page_locale: dict[str, Any]) -> str:
    lines = [
        "    <main>",
        "      <section>",
        '        <div class="summary-card">',
        f"          <p>{page_locale['summary']}</p>",
        "        </div>",
        "      </section>",
        "      <section>",
        f"        <h2 class=\"section-title\">{html.escape(page_locale['section_title'])}</h2>",
        '        <div class="highlight-list">',
    ]
    for item in page_locale["entries"]:
        lines.append(render_highlight_card(item))
    lines.extend(["        </div>", "      </section>", "    </main>"])
    return "\n".join(lines)


def render_project_main(page_locale: dict[str, Any]) -> str:
    lines = ["    <main>"]
    for group in page_locale["groups"]:
        lines.extend(
            [
                "      <section>",
                f"        <h2 class=\"section-title\">{html.escape(group['title'])}</h2>",
                '        <div class="highlight-list">',
            ]
        )
        for item in group["items"]:
            lines.append(render_highlight_card(item))
        lines.extend(["        </div>", "      </section>"])
    lines.append("    </main>")
    return "\n".join(lines)


def render_blog_main(page_locale: dict[str, Any]) -> str:
    lines = ["    <main>", "      <section>"]
    for index, article in enumerate(page_locale["articles"]):
        if index > 0:
            lines.append("        <hr />")
        lines.extend(
            [
                "        <article>",
                "          <h2 class=\"section-title\">",
                f'            <a href="{html.escape(article["href"])}" target="_blank" rel="noreferrer">{html.escape(article["title"])}</a>',
                "          </h2>",
                f"          <p class=\"meta\">{html.escape(article['meta'])}</p>",
                f"          <p>{html.escape(article['summary'])}</p>",
                "        </article>",
            ]
        )
    lines.extend(["      </section>", "    </main>"])
    return "\n".join(lines)


def render_stats_main(page_locale: dict[str, Any]) -> str:
    stats = page_locale["sections"]
    goodreads = stats["goodreads"]
    lines = [
        "    <main>",
        "      <section>",
    ]
    for paragraph in page_locale["intro"]:
        lines.append(f"        <p>{paragraph}</p>")
    lines.extend(
        [
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats['wakatime']['title'])}</h2>",
            f'          <div class="wakatime-widget" data-wakatime-widget data-wakatime-languages-url="{html.escape(stats["wakatime"]["languages_url"])}" data-wakatime-summary-url="{html.escape(stats["wakatime"]["summary_url"])}">',
            f'            <p class="wakatime-status" data-role="status">{html.escape(stats["wakatime"]["status_text"])}</p>',
            '            <div class="wakatime-visuals" data-role="visuals" hidden>',
            '              <div class="wakatime-summary" data-role="summary-cards"></div>',
            f'              <ol class="wakatime-bars" data-role="language-bars" aria-label="{html.escape(stats["wakatime"]["aria_label"])}"></ol>',
            "            </div>",
            "          </div>",
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats['languages']['title'])}</h2>",
            f"          <p>{stats['languages']['intro']}</p>",
            "          <br />",
            f"          <p>{stats['languages']['wakatime_copy']} <a href=\"{html.escape(stats['languages']['wakatime_profile_href'])}\"><img data-hide-section-on-error=\"true\" src=\"{html.escape(stats['languages']['wakatime_badge_src'])}\" alt=\"{html.escape(stats['languages']['wakatime_badge_alt'])}\" /></a></p>",
            f'          <a href="{html.escape(stats["languages"]["wakatime_profile_href"])}"><img data-hide-section-on-error="true" class="stats-embed" src="{html.escape(stats["languages"]["wakatime_embed_src"])}" alt="{html.escape(stats["languages"]["wakatime_embed_alt"])}" loading="lazy" /></a>',
            "          <br />",
            f"          <p>{stats['languages']['github_copy']}</p>",
            f'          <a href="{html.escape(stats["languages"]["github_profile_href"])}"><img data-hide-section-on-error="true" class="stats-embed" src="{html.escape(stats["languages"]["github_embed_src"])}" alt="{html.escape(stats["languages"]["github_embed_alt"])}" loading="lazy" /></a>',
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats['github_commits']['title'])}</h2>",
            f"          <p>{html.escape(stats['github_commits']['description'])}</p>",
            f'          <div class="github-commits-widget" data-github-commits-widget data-github-contrib-url="{html.escape(stats["github_commits"]["contrib_url"])}">',
            f'            <p class="github-commits-status" data-role="status">{html.escape(stats["github_commits"]["status_text"])}</p>',
            '            <div class="github-commits-visuals" data-role="visuals" hidden>',
            '              <div class="github-commits-summary" data-role="summary-cards"></div>',
            '              <div class="github-heatmap-wrap">',
            '                <div class="github-heatmap-scroll">',
            f'                  <div class="github-heatmap" data-role="heatmap" aria-label="{html.escape(stats["github_commits"]["heatmap_aria_label"])}"></div>',
            "                </div>",
            f'                <div class="github-heatmap-legend" data-role="legend" aria-label="{html.escape(stats["github_commits"]["legend_aria_label"])}"></div>',
            "              </div>",
            "            </div>",
            "          </div>",
            f'          <p class="meta">{html.escape(stats["github_commits"]["source_label"])} <a href="{html.escape(stats["github_commits"]["source_href"])}" target="_blank" rel="noreferrer">{html.escape(stats["github_commits"]["source_text"])}</a></p>',
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats['leetcode']['title'])}</h2>",
            f"          <p>{stats['leetcode']['copy']}</p>",
            f"          <p><sub>{stats['leetcode']['thanks']}</sub></p>",
            f'          <img data-hide-section-on-error="true" class="stats-embed" src="{html.escape(stats["leetcode"]["card_src"])}" alt="{html.escape(stats["leetcode"]["card_alt"])}" loading="lazy" />',
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(stats['learning_path']['title'])}</h2>",
            f"          <p>{stats['learning_path']['copy']}</p>",
            "          <br />",
            f'          <a href="{html.escape(stats["learning_path"]["href"])}"><img data-hide-section-on-error="true" src="{html.escape(stats["learning_path"]["image_src"])}" alt="{html.escape(stats["learning_path"]["image_alt"])}" /></a>',
            "        </div>",
            "      </section>",
            "      <section>",
            '        <div class="summary-card stats-card">',
            f"          <h2 class=\"section-title\">{html.escape(goodreads['title'])}</h2>",
            f"          <p>{html.escape(goodreads['copy'])}</p>",
            '          <style type="text/css" media="screen">',
            "            .gr_grid_book_container {",
            "              float: left;",
            "              width: 98px;",
            "              height: 160px;",
            "              padding: 0;",
            "              overflow: hidden;",
            "            }",
            "          </style>",
            f'          <div id="gr_grid_widget_{html.escape(goodreads["widget_id"])}"></div>',
            "        </div>",
            "      </section>",
            "    </main>",
        ]
    )
    return "\n".join(lines)


def render_page_body(
    site: dict[str, Any],
    routes: dict[str, dict[str, str]],
    navigation: dict[str, list[str]],
    nav_labels: dict[str, dict[str, str]],
    page_id: str,
    lang: str,
    current_output: str,
    page_locale: dict[str, Any],
) -> str:
    header = page_locale["header"]
    parts = [
        "<body>",
        '  <div class="site">',
        "    <header>",
        render_language_switcher(site, routes, page_id, lang, current_output),
        f"      <h1 class=\"site-title\">{html.escape(header['site_title'])}</h1>",
        f"      <p class=\"tagline\">{html.escape(header['tagline'])}</p>",
        render_nav(routes, navigation, nav_labels, page_id, lang, current_output),
        "    </header>",
    ]
    if page_id == "index":
        parts.append(render_index_main(page_locale))
    elif page_id == "work":
        parts.append(render_work_main(page_locale))
    elif page_id == "project":
        parts.append(render_project_main(page_locale))
    elif page_id == "blog":
        parts.append(render_blog_main(page_locale))
    elif page_id == "stats":
        parts.append(render_stats_main(page_locale))
    else:
        raise ValueError(f"Unsupported page id: {page_id}")
    parts.append(render_footer(page_locale))
    parts.append("  </div>")
    parts.append(render_scripts(page_id, current_output))
    if page_id == "stats":
        goodreads = page_locale["sections"]["goodreads"]
        parts.append(
            f'  <script src="{html.escape(goodreads["script_src"])}" type="text/javascript" charset="utf-8"></script>'
        )
    parts.append("</body>")
    return "\n".join(parts)


def render_page(
    site: dict[str, Any],
    routes: dict[str, dict[str, str]],
    navigation: dict[str, list[str]],
    nav_labels: dict[str, dict[str, str]],
    page_id: str,
    lang: str,
    route: str,
    page_data: dict[str, Any],
) -> str:
    page_locale = page_data["locales"][lang]
    head = render_head(site, page_id, lang, route, route, page_locale, page_data["og_type"])
    body = render_page_body(site, routes, navigation, nav_labels, page_id, lang, route, page_locale)
    return "\n".join(
        [
            "<!DOCTYPE html>",
            GENERATED_COMMENT,
            f"<html {page_lang_attrs(site, lang)}>",
            "",
            head,
            "",
            body,
            "",
            "</html>",
            "",
        ]
    )


def write_pages(content: dict[str, Any]) -> None:
    site = content["site"]
    routes = content["routes"]
    navigation = content["navigation"]
    nav_labels = content["navigation_labels"]
    for page_id, page_data in content["pages"].items():
        for lang, route in routes[page_id].items():
            output = ROOT / route
            output.parent.mkdir(parents=True, exist_ok=True)
            rendered = render_page(site, routes, navigation, nav_labels, page_id, lang, route, page_data)
            output.write_text(rendered, encoding="utf-8")


def main() -> None:
    content = load_content()
    write_pages(content)


if __name__ == "__main__":
    main()
