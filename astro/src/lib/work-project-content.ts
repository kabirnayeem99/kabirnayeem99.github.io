import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { posix as pathPosix } from "node:path";

export type Lang = "en" | "bn" | "ar" | "ur";
type Direction = "ltr" | "rtl";

interface MetaText {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

interface HeaderText {
  readonly siteTitle: string;
}

interface SiteLocaleInfo {
  readonly dir: Direction;
  readonly author: string;
  readonly ogImageAlt: string;
}

interface SiteData {
  readonly baseUrl: string;
  readonly personName: string;
  readonly websiteName: string;
  readonly twitterSite: string;
  readonly socialProfiles: readonly string[];
  readonly googleSiteVerification: string;
  readonly locale: SiteLocaleInfo;
}

interface RouteMap {
  readonly en: string;
  readonly bn: string;
  readonly ar: string;
  readonly ur: string;
}

export interface ContentCard {
  readonly title: string;
  readonly href?: string;
  readonly meta?: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
}

export interface ProjectGroup {
  readonly title: string;
  readonly items: readonly ContentCard[];
}

interface AlternateLink {
  readonly hrefLang: Lang | "x-default";
  readonly href: string;
}

interface CommonPageContent {
  readonly lang: Lang;
  readonly site: SiteData;
  readonly route: string;
  readonly homeRoute: string;
  readonly pageRoutes: RouteMap;
  readonly meta: MetaText;
  readonly header: HeaderText;
  readonly footerHtml: string;
}

export interface WorkPageContent extends CommonPageContent {
  readonly summary: string;
  readonly sectionTitle: string;
  readonly entries: readonly ContentCard[];
}

export interface ProjectPageContent extends CommonPageContent {
  readonly groups: readonly ProjectGroup[];
}

const LEGACY_ROOT = resolve(process.cwd(), "..");
const CONTENT_PATH = resolve(LEGACY_ROOT, "content/site-content.json");

const LANGS = ["en", "bn", "ar", "ur"] as const;

export const OG_LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "en_US",
  bn: "bn_BD",
  ar: "ar_SA",
  ur: "ur_PK",
};

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

function readStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] {
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

function readOptionalStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] {
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

function readRouteMap(source: Record<string, unknown>, path: string): RouteMap {
  return {
    en: readString(source, "en", path),
    bn: readString(source, "bn", path),
    ar: readString(source, "ar", path),
    ur: readString(source, "ur", path),
  };
}

function readContentCards(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly ContentCard[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }

  const cards: ContentCard[] = [];
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

    cards.push(card);
  }

  return cards;
}

function readProjectGroups(source: Record<string, unknown>, path: string): readonly ProjectGroup[] {
  const groupsRaw = source.groups;
  if (!Array.isArray(groupsRaw)) {
    throw new Error(`Expected array at ${path}.groups`);
  }

  const groups: ProjectGroup[] = [];
  for (let index = 0; index < groupsRaw.length; index += 1) {
    const groupPath = `${path}.groups[${index}]`;
    const group = asRecord(groupsRaw[index], groupPath);
    groups.push({
      title: readString(group, "title", groupPath),
      items: readContentCards(group, "items", groupPath),
    });
  }

  return groups;
}

interface SharedContentContext {
  readonly root: Record<string, unknown>;
  readonly site: SiteData;
  readonly routes: Record<string, unknown>;
}

function loadSharedContext(lang: Lang): SharedContentContext {
  const raw = JSON.parse(readFileSync(CONTENT_PATH, "utf-8")) as unknown;
  const root = asRecord(raw, "root");

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const siteLocale = asRecord(siteLocales[lang], `root.site.locales.${lang}`);
  const routes = asRecord(root.routes, "root.routes");

  return {
    root,
    site: {
      baseUrl: readString(site, "base_url", "root.site"),
      personName: readString(site, "person_name", "root.site"),
      websiteName: readString(site, "website_name", "root.site"),
      twitterSite: readString(site, "twitter_site", "root.site"),
      socialProfiles: readStringArray(site, "social_profiles", "root.site"),
      googleSiteVerification: readString(site, "google_site_verification", "root.site"),
      locale: {
        dir: readDirection(siteLocale, "dir", `root.site.locales.${lang}`),
        author: readString(siteLocale, "author", `root.site.locales.${lang}`),
        ogImageAlt: readString(siteLocale, "og_image_alt", `root.site.locales.${lang}`),
      },
    },
    routes,
  };
}

function readCommonPageContent(
  lang: Lang,
  pageId: "work" | "project",
): {
  readonly context: SharedContentContext;
  readonly localePage: Record<string, unknown>;
  readonly common: CommonPageContent;
} {
  const context = loadSharedContext(lang);
  const pages = asRecord(context.root.pages, "root.pages");
  const page = asRecord(pages[pageId], `root.pages.${pageId}`);
  const locales = asRecord(page.locales, `root.pages.${pageId}.locales`);
  const localePage = asRecord(locales[lang], `root.pages.${pageId}.locales.${lang}`);
  const meta = asRecord(localePage.meta, `root.pages.${pageId}.locales.${lang}.meta`);
  const header = asRecord(localePage.header, `root.pages.${pageId}.locales.${lang}.header`);

  const workOrProjectRoutes = readRouteMap(
    asRecord(context.routes[pageId], `root.routes.${pageId}`),
    `root.routes.${pageId}`,
  );
  const indexRoutes = readRouteMap(
    asRecord(context.routes.index, "root.routes.index"),
    "root.routes.index",
  );

  return {
    context,
    localePage,
    common: {
      lang,
      site: context.site,
      route: workOrProjectRoutes[lang],
      homeRoute: indexRoutes[lang],
      pageRoutes: workOrProjectRoutes,
      meta: {
        title: readString(meta, "title", `root.pages.${pageId}.locales.${lang}.meta`),
        description: readString(meta, "description", `root.pages.${pageId}.locales.${lang}.meta`),
        keywords: readString(meta, "keywords", `root.pages.${pageId}.locales.${lang}.meta`),
      },
      header: {
        siteTitle: readString(header, "site_title", `root.pages.${pageId}.locales.${lang}.header`),
      },
      footerHtml: readString(localePage, "footer_html", `root.pages.${pageId}.locales.${lang}`),
    },
  };
}

export function loadWorkPageContent(lang: Lang): WorkPageContent {
  const { localePage, common } = readCommonPageContent(lang, "work");
  return {
    ...common,
    summary: readString(localePage, "summary", `root.pages.work.locales.${lang}`),
    sectionTitle: readString(localePage, "section_title", `root.pages.work.locales.${lang}`),
    entries: readContentCards(localePage, "entries", `root.pages.work.locales.${lang}`),
  };
}

export function loadProjectPageContent(lang: Lang): ProjectPageContent {
  const { localePage, common } = readCommonPageContent(lang, "project");
  return {
    ...common,
    groups: readProjectGroups(localePage, `root.pages.project.locales.${lang}`),
  };
}

export function buildAlternateLinks(
  baseUrl: string,
  pageRoutes: RouteMap,
): readonly AlternateLink[] {
  const links: AlternateLink[] = LANGS.map((lang) => ({
    hrefLang: lang,
    href: `${baseUrl}/${pageRoutes[lang]}`,
  }));
  links.push({
    hrefLang: "x-default",
    href: `${baseUrl}/${pageRoutes.en}`,
  });
  return links;
}

export function buildOgLocaleAlternates(lang: Lang): readonly string[] {
  return LANGS.filter((entry) => entry !== lang).map((entry) => OG_LOCALE_BY_LANG[entry]);
}

export function relativeHref(fromRoute: string, toRoute: string): string {
  const fromDir = pathPosix.dirname(fromRoute) || ".";
  return pathPosix.relative(fromDir, toRoute);
}

export function routeHref(fromRoute: string, toRoute: string): string {
  return relativeHref(fromRoute, toRoute);
}

export function assetHref(currentRoute: string, assetPath: string): string {
  return relativeHref(currentRoute, assetPath);
}
