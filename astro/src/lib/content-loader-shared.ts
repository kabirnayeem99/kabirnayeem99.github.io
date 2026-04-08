import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LANGS, PAGE_IDS, type Lang } from "./locale-config";
import type { Direction } from "./site-types";

const CONTENT_DIR = resolve(process.cwd(), "src/data/site-content");

const SHARED_CONTENT_FILE_PATHS = [
  resolve(CONTENT_DIR, "site.json"),
  resolve(CONTENT_DIR, "routes.json"),
  resolve(CONTENT_DIR, "navigation.json"),
  resolve(CONTENT_DIR, "navigation-labels.json"),
] as const;

export function listSiteContentFilePaths(): readonly string[] {
  const pageFilePaths = PAGE_IDS.map((pageId) => resolve(CONTENT_DIR, "pages", `${pageId}.json`));
  return [...SHARED_CONTENT_FILE_PATHS, ...pageFilePaths];
}

interface SiteContentRoot {
  readonly site: Record<string, unknown>;
  readonly routes: Record<string, unknown>;
  readonly navigation: Record<string, unknown>;
  readonly navigation_labels: Record<string, unknown>;
  readonly pages: Readonly<Record<(typeof PAGE_IDS)[number], Record<string, unknown>>>;
}

let siteContentCache: SiteContentRoot | undefined;
const useInMemoryCache = process.env.NODE_ENV === "production";

function readJsonObject(filePath: string, pathLabel: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  return asRecord(raw, pathLabel);
}

export function loadSiteContentRoot(): SiteContentRoot {
  if (useInMemoryCache && siteContentCache !== undefined) {
    return siteContentCache;
  }

  const site = readJsonObject(resolve(CONTENT_DIR, "site.json"), "root.site");
  const routes = readJsonObject(resolve(CONTENT_DIR, "routes.json"), "root.routes");
  const navigation = readJsonObject(resolve(CONTENT_DIR, "navigation.json"), "root.navigation");
  const navigationLabels = readJsonObject(
    resolve(CONTENT_DIR, "navigation-labels.json"),
    "root.navigation_labels",
  );

  const pages: Record<(typeof PAGE_IDS)[number], Record<string, unknown>> = {
    index: readJsonObject(resolve(CONTENT_DIR, "pages/index.json"), "root.pages.index"),
    work: readJsonObject(resolve(CONTENT_DIR, "pages/work.json"), "root.pages.work"),
    project: readJsonObject(resolve(CONTENT_DIR, "pages/project.json"), "root.pages.project"),
    blog: readJsonObject(resolve(CONTENT_DIR, "pages/blog.json"), "root.pages.blog"),
    stats: readJsonObject(resolve(CONTENT_DIR, "pages/stats.json"), "root.pages.stats"),
  };

  const siteContentRoot: SiteContentRoot = {
    site,
    routes,
    navigation,
    navigation_labels: navigationLabels,
    pages,
  };
  if (useInMemoryCache) {
    siteContentCache = siteContentRoot;
  }
  return siteContentRoot;
}

export interface MetaText {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

export interface SiteLocaleUiLabels {
  readonly skipToMain: string;
  readonly closePage: string;
  readonly lastUpdated: string;
  readonly backToTop: string;
  readonly themeDark: string;
  readonly themeLight: string;
}

export interface SiteLocaleBuildTimestamp {
  readonly prefix: string;
  readonly dayPeriod: {
    readonly morning: string;
    readonly evening: string;
  };
}

export interface SiteSocialPlatformLabels {
  readonly github: string;
  readonly linkedin: string;
  readonly medium: string;
  readonly leetcode: string;
}

export interface LocaleInfo {
  readonly dir: Direction;
  readonly author: string;
  readonly languageSwitcherLabel: string;
  readonly ogImageAlt: string;
  readonly labels: SiteLocaleUiLabels;
  readonly buildTimestamp: SiteLocaleBuildTimestamp;
  readonly socialPlatformLabels: SiteSocialPlatformLabels;
}

export interface SiteData {
  readonly baseUrl: string;
  readonly personName: string;
  readonly websiteName: string;
  readonly twitterSite: string;
  readonly socialProfiles: readonly string[];
  readonly googleSiteVerification: string;
}

export type RouteMap = Readonly<Record<Lang, string>>;

export function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value as Record<string, unknown>;
}

export function readString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

export function readOptionalString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

export function readDirection(source: Record<string, unknown>, key: string, path: string): Direction {
  const value = readString(source, key, path);
  if (value !== "ltr" && value !== "rtl") {
    throw new Error(`Expected direction at ${path}.${key}`);
  }
  return value;
}

export function readStringArray(
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

export function readOptionalStringArray(
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

export function readLangStringMap(source: Record<string, unknown>, path: string): Readonly<Record<Lang, string>> {
  const output: Record<Lang, string> = {} as Record<Lang, string>;
  for (const lang of LANGS) {
    output[lang] = readString(source, lang, path);
  }
  return output;
}

export function readRouteMap(source: Record<string, unknown>, path: string): RouteMap {
  return readLangStringMap(source, path);
}

export function readLocaleInfo(source: Record<string, unknown>, path: string): LocaleInfo {
  const labels = asRecord(source.labels, `${path}.labels`);
  const buildTimestamp = asRecord(source.build_timestamp, `${path}.build_timestamp`);
  const dayPeriod = asRecord(buildTimestamp.day_period, `${path}.build_timestamp.day_period`);
  const socialPlatformLabels = asRecord(source.social_platform_labels, `${path}.social_platform_labels`);

  return {
    dir: readDirection(source, "dir", path),
    author: readString(source, "author", path),
    languageSwitcherLabel: readString(source, "language_switcher_label", path),
    ogImageAlt: readString(source, "og_image_alt", path),
    labels: {
      skipToMain: readString(labels, "skip_to_main", `${path}.labels`),
      closePage: readString(labels, "close_page", `${path}.labels`),
      lastUpdated: readString(labels, "last_updated", `${path}.labels`),
      backToTop: readString(labels, "back_to_top", `${path}.labels`),
      themeDark: readString(labels, "theme_dark", `${path}.labels`),
      themeLight: readString(labels, "theme_light", `${path}.labels`),
    },
    buildTimestamp: {
      prefix: readString(buildTimestamp, "prefix", `${path}.build_timestamp`),
      dayPeriod: {
        morning: readString(dayPeriod, "morning", `${path}.build_timestamp.day_period`),
        evening: readString(dayPeriod, "evening", `${path}.build_timestamp.day_period`),
      },
    },
    socialPlatformLabels: {
      github: readString(socialPlatformLabels, "github", `${path}.social_platform_labels`),
      linkedin: readString(socialPlatformLabels, "linkedin", `${path}.social_platform_labels`),
      medium: readString(socialPlatformLabels, "medium", `${path}.social_platform_labels`),
      leetcode: readString(socialPlatformLabels, "leetcode", `${path}.social_platform_labels`),
    },
  };
}
