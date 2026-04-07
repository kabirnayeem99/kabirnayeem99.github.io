import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Direction, Lang } from "./site-types";

const CONTENT_DIR = resolve(process.cwd(), "src/data/site-content");
const PAGE_IDS = ["index", "work", "project", "blog", "stats"] as const;

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

function readJsonObject(filePath: string, pathLabel: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  return asRecord(raw, pathLabel);
}

export function loadSiteContentRoot(): SiteContentRoot {
  if (siteContentCache !== undefined) {
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

  siteContentCache = {
    site,
    routes,
    navigation,
    navigation_labels: navigationLabels,
    pages,
  };
  return siteContentCache;
}

export interface MetaText {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

export interface LocaleInfo {
  readonly dir: Direction;
  readonly author: string;
  readonly ogImageAlt: string;
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

export function readRouteMap(source: Record<string, unknown>, path: string): RouteMap {
  return {
    en: readString(source, "en", path),
    bn: readString(source, "bn", path),
    ar: readString(source, "ar", path),
    ur: readString(source, "ur", path),
  };
}
