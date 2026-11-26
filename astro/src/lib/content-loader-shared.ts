import { resolve } from "node:path";
import type { z } from "astro/zod";
import { navigationLabelsSchema, navigationSchema, pageSchemas, routesSchema, siteSchema } from "./content-schema.ts";
import { readContentFile } from "./content-validate.ts";
import { ALL_PAGE_IDS, mapLangs, type Lang, type PageId } from "./locale-config.ts";
import { isRecord } from "../scripts/modules/guards.ts";
import type { Direction } from "./site-types.ts";

const CONTENT_PATH = "src/data/site-content";
const CONTENT_DIR = resolve(process.cwd(), CONTENT_PATH);

const LATIN_TO_ARABIC: Readonly<Record<string, string>> = {
  a: "ا",
  b: "ب",
  c: "ك",
  d: "د",
  e: "ي",
  f: "ف",
  g: "گ",
  h: "ه",
  i: "ي",
  j: "ج",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  o: "و",
  p: "پ",
  q: "ك",
  r: "ر",
  s: "س",
  t: "ت",
  u: "و",
  v: "ڤ",
  w: "و",
  x: "كس",
  y: "ي",
  z: "ز",
};

const LATIN_TO_URDU: Readonly<Record<string, string>> = {
  a: "ا",
  b: "ب",
  c: "ک",
  d: "د",
  e: "ی",
  f: "ف",
  g: "گ",
  h: "ہ",
  i: "ی",
  j: "ج",
  k: "ک",
  l: "ل",
  m: "م",
  n: "ن",
  o: "و",
  p: "پ",
  q: "ک",
  r: "ر",
  s: "س",
  t: "ٹ",
  u: "و",
  v: "و",
  w: "و",
  x: "کس",
  y: "ی",
  z: "ز",
};

const CONTENT_IDENTIFIERS = new Set([
  "api_url",
  "dir",
  "href",
  "icon",
  "layout",
  "page_id",
  "profile_href",
  "script_src",
  "snippet",
  "src",
  "user_id",
  "variant",
  "widget_id",
]);

function transliterateLatinText(value: string, alphabet: Readonly<Record<string, string>>): string {
  return value.replace(/[A-Za-z]+/g, (word) =>
    Array.from(word.toLowerCase(), (character) => alphabet[character] ?? character).join(""),
  );
}

function transliterateVisibleHtml(value: string, alphabet: Readonly<Record<string, string>>): string {
  return value
    .split(/(<[^>]*>|&[A-Za-z]+;)/g)
    .map((part) => (part.startsWith("<") || part.startsWith("&") ? part : transliterateLatinText(part, alphabet)))
    .join("");
}

function localizeLatinScript(value: string, key: string, path: string): string {
  if (CONTENT_IDENTIFIERS.has(key) || /^(https?:|mailto:)/.test(value)) {
    return value;
  }
  if (path.includes(".locales.ar")) {
    return transliterateVisibleHtml(value, LATIN_TO_ARABIC);
  }
  if (path.includes(".locales.ur")) {
    return transliterateVisibleHtml(value, LATIN_TO_URDU);
  }
  return value;
}

export function transliterateLocalizedText(value: string, lang: Lang): string {
  if (lang === "ar") {
    return transliterateVisibleHtml(value, LATIN_TO_ARABIC);
  }
  if (lang === "ur") {
    return transliterateVisibleHtml(value, LATIN_TO_URDU);
  }
  return value;
}

const SHARED_CONTENT_FILE_PATHS = [
  resolve(CONTENT_DIR, "site.json"),
  resolve(CONTENT_DIR, "routes.json"),
  resolve(CONTENT_DIR, "navigation.json"),
  resolve(CONTENT_DIR, "navigation-labels.json"),
] as const;

export function listSiteContentFilePaths(): readonly string[] {
  const pageFilePaths = ALL_PAGE_IDS.map((pageId) => resolve(CONTENT_DIR, "pages", `${pageId}.json`));
  return [...SHARED_CONTENT_FILE_PATHS, ...pageFilePaths];
}

interface SiteContentRoot {
  readonly site: z.infer<typeof siteSchema>;
  readonly routes: z.infer<typeof routesSchema>;
  readonly navigation: z.infer<typeof navigationSchema>;
  readonly navigation_labels: z.infer<typeof navigationLabelsSchema>;
  readonly pages: { readonly [Id in PageId]: z.infer<(typeof pageSchemas)[Id]> };
}

let siteContentCache: SiteContentRoot | undefined;
const useInMemoryCache = process.env["NODE_ENV"] === "production";

/** One file under src/data/site-content, checked against its schema. */
export function readSiteContentFile<T>(name: string, schema: z.ZodType<T>): T {
  return readContentFile(process.cwd(), `${CONTENT_PATH}/${name}`, schema);
}

export function loadSiteContentRoot(): SiteContentRoot {
  if (useInMemoryCache && siteContentCache !== undefined) {
    return siteContentCache;
  }

  const siteContentRoot: SiteContentRoot = {
    site: readSiteContentFile("site.json", siteSchema),
    routes: readSiteContentFile("routes.json", routesSchema),
    navigation: readSiteContentFile("navigation.json", navigationSchema),
    navigation_labels: readSiteContentFile("navigation-labels.json", navigationLabelsSchema),
    pages: {
      index: readSiteContentFile("pages/index.json", pageSchemas.index),
      work: readSiteContentFile("pages/work.json", pageSchemas.work),
      project: readSiteContentFile("pages/project.json", pageSchemas.project),
      blog: readSiteContentFile("pages/blog.json", pageSchemas.blog),
      stats: readSiteContentFile("pages/stats.json", pageSchemas.stats),
    },
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

interface SiteLocaleUiLabels {
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

interface SiteSocialPlatformLabels {
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
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value;
}

export function readString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return localizeLatinScript(value, key, path);
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
  return localizeLatinScript(value, key, path);
}

function readDirection(source: Record<string, unknown>, key: string, path: string): Direction {
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
    const entry: unknown = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(localizeLatinScript(entry, key, path));
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
    const entry: unknown = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(localizeLatinScript(entry, key, path));
  }
  return output;
}

export function readLangStringMap(source: Record<string, unknown>, path: string): Readonly<Record<Lang, string>> {
  return mapLangs((lang) => readString(source, lang, path));
}

export function readRouteMap(source: Record<string, unknown>, path: string): RouteMap {
  return readLangStringMap(source, path);
}

export function readLocaleInfo(source: Record<string, unknown>, path: string): LocaleInfo {
  const labels = asRecord(source["labels"], `${path}.labels`);
  const buildTimestamp = asRecord(source["build_timestamp"], `${path}.build_timestamp`);
  const dayPeriod = asRecord(buildTimestamp["day_period"], `${path}.build_timestamp.day_period`);
  const socialPlatformLabels = asRecord(source["social_platform_labels"], `${path}.social_platform_labels`);

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
