import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Direction, Lang, PageId } from "./site-types";

export type { Lang, PageId } from "./site-types";

interface MetaText {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

interface HeaderText {
  readonly siteTitle: string;
  readonly tagline: string;
}

interface LocaleInfo {
  readonly dir: Direction;
  readonly author: string;
  readonly languageSwitcherLabel: string;
  readonly ogImageAlt: string;
}

export interface IndexAction {
  readonly label: string;
  readonly href?: string;
  readonly pageId?: PageId;
  readonly variant: "primary" | "secondary";
}

interface ContentCard {
  readonly title: string;
  readonly href?: string;
  readonly meta?: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
}

interface ArticleLink {
  readonly title: string;
  readonly href: string;
  readonly summary: string;
}

export interface IndexSection {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly ContentCard[];
  readonly tags: readonly string[];
  readonly articles: readonly ArticleLink[];
  readonly actions: readonly IndexAction[];
  readonly contacts: readonly string[];
}

interface WakaTimeSection {
  readonly title: string;
  readonly statusText: string;
  readonly languagesUrl: string;
  readonly summaryUrl: string;
  readonly ariaLabel: string;
}

interface GoodreadsSection {
  readonly title: string;
  readonly copy: string;
  readonly widgetId: string;
  readonly scriptSrc: string;
}

interface StatsCompactContent {
  readonly wakatime: WakaTimeSection;
  readonly goodreads: GoodreadsSection;
}

interface SiteData {
  readonly baseUrl: string;
  readonly personName: string;
  readonly websiteName: string;
  readonly twitterSite: string;
  readonly socialProfiles: readonly string[];
  readonly googleSiteVerification: string;
  readonly locale: LocaleInfo;
  readonly languageMenuLabels: Readonly<Record<Lang, string>>;
}

export interface RouteTable {
  readonly index: Readonly<Record<Lang, string>>;
  readonly work: Readonly<Record<Lang, string>>;
  readonly project: Readonly<Record<Lang, string>>;
  readonly blog: Readonly<Record<"en", string>>;
  readonly stats: Readonly<Record<"en", string>>;
}

export interface IndexPageContent {
  readonly lang: Lang;
  readonly site: SiteData;
  readonly routes: RouteTable;
  readonly navigation: readonly PageId[];
  readonly navigationLabels: Readonly<Record<PageId, string>>;
  readonly meta: MetaText;
  readonly header: HeaderText;
  readonly summaryCard: readonly string[];
  readonly sections: readonly IndexSection[];
  readonly topActions: readonly IndexAction[];
  readonly footerHtml: string;
  readonly statsCompact: StatsCompactContent;
  readonly route: string;
}

const LEGACY_ROOT = resolve(process.cwd(), "..");
const CONTENT_PATH = resolve(LEGACY_ROOT, "content/site-content.json");

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function readString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

function readOptionalString(source: Record<string, unknown>, key: string, path: string): string | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

function readDirection(source: Record<string, unknown>, key: string, path: string): Direction {
  const value = readString(source, key, path);
  if (value !== "ltr" && value !== "rtl") {
    throw new Error(`Expected direction at ${path}.${key}`);
  }
  return value;
}

function readStringArray(source: Record<string, unknown>, key: string, path: string): readonly string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(entry);
  }
  return output;
}

function readOptionalStringArray(source: Record<string, unknown>, key: string, path: string): readonly string[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(entry);
  }
  return output;
}

function readPageIdArray(source: Record<string, unknown>, key: string, path: string): readonly PageId[] {
  const entries = readStringArray(source, key, path);
  const pageIds: PageId[] = [];
  for (const [index, entry] of entries.entries()) {
    if (entry === "index" || entry === "work" || entry === "project" || entry === "blog" || entry === "stats") {
      pageIds.push(entry);
      continue;
    }
    throw new Error(`Expected page id at ${path}.${key}[${index}]`);
  }
  return pageIds;
}

function readRouteMap(
  source: Record<string, unknown>,
  path: string,
): Readonly<Record<Lang, string>> {
  return {
    en: readString(source, "en", path),
    bn: readString(source, "bn", path),
    ar: readString(source, "ar", path),
    ur: readString(source, "ur", path),
  };
}

function readAction(source: Record<string, unknown>, path: string): IndexAction {
  const label = readString(source, "label", path);
  const href = readOptionalString(source, "href", path);
  const pageIdRaw = source.page_id;
  const variantRaw = readString(source, "variant", path);

  const variant: "primary" | "secondary" =
    variantRaw === "primary" || variantRaw === "secondary"
      ? variantRaw
      : (() => {
          throw new Error(`Expected variant at ${path}.variant`);
        })();

  let pageId: PageId | undefined;
  if (pageIdRaw !== undefined) {
    if (
      pageIdRaw === "index" ||
      pageIdRaw === "work" ||
      pageIdRaw === "project" ||
      pageIdRaw === "blog" ||
      pageIdRaw === "stats"
    ) {
      pageId = pageIdRaw;
    } else {
      throw new Error(`Expected page id at ${path}.page_id`);
    }
  }

  if (href === undefined && pageId === undefined) {
    throw new Error(`Expected href or page_id at ${path}`);
  }

  const action: {
    label: string;
    variant: "primary" | "secondary";
    href?: string;
    pageId?: PageId;
  } = {
    label,
    variant,
  };
  if (href !== undefined) {
    action.href = href;
  }
  if (pageId !== undefined) {
    action.pageId = pageId;
  }

  return action;
}

function readActions(source: Record<string, unknown>, key: string, path: string): readonly IndexAction[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }

  const output: IndexAction[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}.${key}[${index}]`;
    const item = asRecord(value[index], itemPath);
    output.push(readAction(item, itemPath));
  }
  return output;
}

function readContentCards(source: Record<string, unknown>, key: string, path: string): readonly ContentCard[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: ContentCard[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}.${key}[${index}]`;
    const item = asRecord(value[index], itemPath);
    const href = readOptionalString(item, "href", itemPath);
    const meta = readOptionalString(item, "meta", itemPath);
    const card: {
      title: string;
      paragraphs: readonly string[];
      bullets: readonly string[];
      href?: string;
      meta?: string;
    } = {
      title: readString(item, "title", itemPath),
      paragraphs: readOptionalStringArray(item, "paragraphs", itemPath),
      bullets: readOptionalStringArray(item, "bullets", itemPath),
    };
    if (href !== undefined) {
      card.href = href;
    }
    if (meta !== undefined) {
      card.meta = meta;
    }
    output.push(card);
  }
  return output;
}

function readArticles(source: Record<string, unknown>, key: string, path: string): readonly ArticleLink[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: ArticleLink[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}.${key}[${index}]`;
    const item = asRecord(value[index], itemPath);
    output.push({
      title: readString(item, "title", itemPath),
      href: readString(item, "href", itemPath),
      summary: readString(item, "summary", itemPath),
    });
  }
  return output;
}

function readIndexSections(source: Record<string, unknown>, path: string): readonly IndexSection[] {
  const value = source.sections;
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.sections`);
  }

  const output: IndexSection[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}.sections[${index}]`;
    const item = asRecord(value[index], itemPath);
    output.push({
      title: readString(item, "title", itemPath),
      paragraphs: readOptionalStringArray(item, "paragraphs", itemPath),
      highlights: readContentCards(item, "highlights", itemPath),
      tags: readOptionalStringArray(item, "tags", itemPath),
      articles: readArticles(item, "articles", itemPath),
      actions: readActions(item, "actions", itemPath),
      contacts: readOptionalStringArray(item, "contacts", itemPath),
    });
  }
  return output;
}

export function loadIndexPageContent(lang: Lang): IndexPageContent {
  const raw = JSON.parse(readFileSync(CONTENT_PATH, "utf-8")) as unknown;
  const root = asRecord(raw, "root");

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const localeRaw = asRecord(siteLocales[lang], `root.site.locales.${lang}`);
  const languageMenuLabelsRaw = asRecord(site.language_menu_labels, "root.site.language_menu_labels");

  const routesRaw = asRecord(root.routes, "root.routes");
  const routes: RouteTable = {
    index: readRouteMap(asRecord(routesRaw.index, "root.routes.index"), "root.routes.index"),
    work: readRouteMap(asRecord(routesRaw.work, "root.routes.work"), "root.routes.work"),
    project: readRouteMap(asRecord(routesRaw.project, "root.routes.project"), "root.routes.project"),
    blog: {
      en: readString(asRecord(routesRaw.blog, "root.routes.blog"), "en", "root.routes.blog"),
    },
    stats: {
      en: readString(asRecord(routesRaw.stats, "root.routes.stats"), "en", "root.routes.stats"),
    },
  };

  const navigationRaw = asRecord(root.navigation, "root.navigation");
  const navigationLabelsRaw = asRecord(root.navigation_labels, "root.navigation_labels");
  const pagesRaw = asRecord(root.pages, "root.pages");

  const indexPageRaw = asRecord(pagesRaw.index, "root.pages.index");
  const indexLocalesRaw = asRecord(indexPageRaw.locales, "root.pages.index.locales");
  const indexLocale = asRecord(indexLocalesRaw[lang], `root.pages.index.locales.${lang}`);
  const indexMeta = asRecord(indexLocale.meta, `root.pages.index.locales.${lang}.meta`);
  const indexHeader = asRecord(indexLocale.header, `root.pages.index.locales.${lang}.header`);

  const statsPageRaw = asRecord(pagesRaw.stats, "root.pages.stats");
  const statsLocalesRaw = asRecord(statsPageRaw.locales, "root.pages.stats.locales");
  const statsLocale = asRecord(
    statsLocalesRaw[lang] ?? statsLocalesRaw.en,
    `root.pages.stats.locales.${lang}`,
  );
  const statsSections = asRecord(statsLocale.sections, `root.pages.stats.locales.${lang}.sections`);
  const statsWakaTime = asRecord(statsSections.wakatime, `root.pages.stats.locales.${lang}.sections.wakatime`);
  const statsGoodreads = asRecord(
    statsSections.goodreads,
    `root.pages.stats.locales.${lang}.sections.goodreads`,
  );

  const navigation = readPageIdArray(navigationRaw, lang, "root.navigation");

  const navigationLabels: Record<PageId, string> = {
    index: readString(
      asRecord(navigationLabelsRaw.index, "root.navigation_labels.index"),
      lang,
      "root.navigation_labels.index",
    ),
    work: readString(
      asRecord(navigationLabelsRaw.work, "root.navigation_labels.work"),
      lang,
      "root.navigation_labels.work",
    ),
    project: readString(
      asRecord(navigationLabelsRaw.project, "root.navigation_labels.project"),
      lang,
      "root.navigation_labels.project",
    ),
    blog: readString(
      asRecord(navigationLabelsRaw.blog, "root.navigation_labels.blog"),
      "en",
      "root.navigation_labels.blog",
    ),
    stats: readString(
      asRecord(navigationLabelsRaw.stats, "root.navigation_labels.stats"),
      "en",
      "root.navigation_labels.stats",
    ),
  };

  return {
    lang,
    site: {
      baseUrl: readString(site, "base_url", "root.site"),
      personName: readString(site, "person_name", "root.site"),
      websiteName: readString(site, "website_name", "root.site"),
      twitterSite: readString(site, "twitter_site", "root.site"),
      socialProfiles: readStringArray(site, "social_profiles", "root.site"),
      googleSiteVerification: readString(site, "google_site_verification", "root.site"),
      locale: {
        dir: readDirection(localeRaw, "dir", `root.site.locales.${lang}`),
        author: readString(localeRaw, "author", `root.site.locales.${lang}`),
        languageSwitcherLabel: readString(
          localeRaw,
          "language_switcher_label",
          `root.site.locales.${lang}`,
        ),
        ogImageAlt: readString(localeRaw, "og_image_alt", `root.site.locales.${lang}`),
      },
      languageMenuLabels: {
        en: readString(languageMenuLabelsRaw, "en", "root.site.language_menu_labels"),
        bn: readString(languageMenuLabelsRaw, "bn", "root.site.language_menu_labels"),
        ar: readString(languageMenuLabelsRaw, "ar", "root.site.language_menu_labels"),
        ur: readString(languageMenuLabelsRaw, "ur", "root.site.language_menu_labels"),
      },
    },
    routes,
    navigation,
    navigationLabels,
    meta: {
      title: readString(indexMeta, "title", `root.pages.index.locales.${lang}.meta`),
      description: readString(indexMeta, "description", `root.pages.index.locales.${lang}.meta`),
      keywords: readString(indexMeta, "keywords", `root.pages.index.locales.${lang}.meta`),
    },
    header: {
      siteTitle: readString(indexHeader, "site_title", `root.pages.index.locales.${lang}.header`),
      tagline: readString(indexHeader, "tagline", `root.pages.index.locales.${lang}.header`),
    },
    summaryCard: readStringArray(indexLocale, "summary_card", `root.pages.index.locales.${lang}`),
    sections: readIndexSections(indexLocale, `root.pages.index.locales.${lang}`),
    topActions: readActions(indexLocale, "top_actions", `root.pages.index.locales.${lang}`),
    footerHtml: readString(indexLocale, "footer_html", `root.pages.index.locales.${lang}`),
    statsCompact: {
      wakatime: {
        title: readString(statsWakaTime, "title", `root.pages.stats.locales.${lang}.sections.wakatime`),
        statusText: readString(
          statsWakaTime,
          "status_text",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        languagesUrl: readString(
          statsWakaTime,
          "languages_url",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        summaryUrl: readString(
          statsWakaTime,
          "summary_url",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        ariaLabel: readString(statsWakaTime, "aria_label", `root.pages.stats.locales.${lang}.sections.wakatime`),
      },
      goodreads: {
        title: readString(
          statsGoodreads,
          "title",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        copy: readString(
          statsGoodreads,
          "copy",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        widgetId: readString(
          statsGoodreads,
          "widget_id",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        scriptSrc: readString(
          statsGoodreads,
          "script_src",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
      },
    },
    route: routes.index[lang],
  };
}
