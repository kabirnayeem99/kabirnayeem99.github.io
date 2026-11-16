import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  asRecord,
  loadSiteContentRoot,
  readLocaleInfo,
  readOptionalString,
  readString,
  readStringArray,
  type LocaleInfo,
  type MetaText,
  type SiteData,
} from "./content-loader-shared";
import type { Lang } from "./locale-config";
import type { CardImage } from "./work-project-content";

// The reading page is English-only for now: every locale falls back to the English copy
// and one route (reading.html).
const READING_FILE = resolve(process.cwd(), "src/data/site-content/pages/reading.json");
const READING_ROUTE = "reading.html";

export interface ReadingNowItem {
  readonly title: string;
  readonly subtitle?: string;
  readonly author?: string;
  readonly lang?: string;
  readonly note: string;
  readonly image?: CardImage;
}

export interface ReadingLanguage {
  readonly name: string;
  readonly lang: string;
  readonly level: string;
  readonly note: string;
}

export interface ReadingNote {
  readonly title: string;
  readonly author?: string;
  readonly date?: string;
  readonly href?: string;
  readonly paragraphs: readonly string[];
}

export interface ReadingPageContent {
  readonly lang: Lang;
  readonly site: SiteData & { readonly locale: LocaleInfo };
  readonly route: string;
  readonly homeRoute: string;
  readonly meta: MetaText;
  readonly title: string;
  readonly intro: readonly string[];
  readonly now: { readonly title: string; readonly lastReadLabel: string; readonly items: readonly ReadingNowItem[] };
  readonly languages: { readonly title: string; readonly intro: string; readonly items: readonly ReadingLanguage[] };
  readonly notes: { readonly title: string; readonly items: readonly ReadingNote[] };
  readonly shelf: { readonly title: string; readonly copy: string };
  readonly footerHtml: string;
}

function readImage(raw: unknown, path: string): CardImage {
  const image = asRecord(raw, path);
  const { width, height } = image;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error(`Expected numeric width/height at ${path}`);
  }
  return { src: readString(image, "src", path), alt: readString(image, "alt", path), width, height };
}

function readList<T>(source: Record<string, unknown>, key: string, path: string, read: (item: Record<string, unknown>, itemPath: string) => T): readonly T[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  return value.map((raw, index) => {
    const itemPath = `${path}.${key}[${index}]`;
    return read(asRecord(raw, itemPath), itemPath);
  });
}

function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function loadReadingPageContent(lang: Lang): ReadingPageContent {
  const root = loadSiteContentRoot();
  const site = asRecord(root.site, "root.site");
  const siteLocale = asRecord(asRecord(site.locales, "root.site.locales").en, "root.site.locales.en");
  const routes = asRecord(root.routes, "root.routes");
  const indexRoutes = asRecord(routes.index, "root.routes.index");

  const page = asRecord(JSON.parse(readFileSync(READING_FILE, "utf-8")) as unknown, "root.pages.reading");
  const path = "root.pages.reading.locales.en";
  const locale = asRecord(asRecord(page.locales, "root.pages.reading.locales").en, path);
  const meta = asRecord(locale.meta, `${path}.meta`);
  const header = asRecord(locale.header, `${path}.header`);
  const now = asRecord(locale.now, `${path}.now`);
  const languages = asRecord(locale.languages, `${path}.languages`);
  const notes = asRecord(locale.notes, `${path}.notes`);
  const shelf = asRecord(locale.shelf, `${path}.shelf`);

  return {
    lang,
    site: {
      baseUrl: readString(site, "base_url", "root.site"),
      personName: readString(site, "person_name", "root.site"),
      websiteName: readString(site, "website_name", "root.site"),
      twitterSite: readString(site, "twitter_site", "root.site"),
      socialProfiles: readStringArray(site, "social_profiles", "root.site"),
      googleSiteVerification: readString(site, "google_site_verification", "root.site"),
      locale: readLocaleInfo(siteLocale, "root.site.locales.en"),
    },
    route: READING_ROUTE,
    homeRoute: readString(indexRoutes, "en", "root.routes.index"),
    meta: {
      title: readString(meta, "title", `${path}.meta`),
      description: readString(meta, "description", `${path}.meta`),
      keywords: readString(meta, "keywords", `${path}.meta`),
    },
    title: readString(header, "site_title", `${path}.header`),
    intro: readStringArray(locale, "intro", path),
    now: {
      title: readString(now, "title", `${path}.now`),
      lastReadLabel: readString(now, "last_read_label", `${path}.now`),
      items: readList(now, "items", `${path}.now`, (item, itemPath) => ({
        title: readString(item, "title", itemPath),
        note: readString(item, "note", itemPath),
        ...optional("subtitle", readOptionalString(item, "subtitle", itemPath)),
        ...optional("author", readOptionalString(item, "author", itemPath)),
        ...optional("lang", readOptionalString(item, "lang", itemPath)),
        ...optional("image", item.image === undefined ? undefined : readImage(item.image, `${itemPath}.image`)),
      })),
    },
    languages: {
      title: readString(languages, "title", `${path}.languages`),
      intro: readString(languages, "intro", `${path}.languages`),
      items: readList(languages, "items", `${path}.languages`, (item, itemPath) => ({
        name: readString(item, "name", itemPath),
        lang: readString(item, "lang", itemPath),
        level: readString(item, "level", itemPath),
        note: readString(item, "note", itemPath),
      })),
    },
    notes: {
      title: readString(notes, "title", `${path}.notes`),
      items: readList(notes, "items", `${path}.notes`, (item, itemPath) => ({
        title: readString(item, "title", itemPath),
        paragraphs: readStringArray(item, "paragraphs", itemPath),
        ...optional("author", readOptionalString(item, "author", itemPath)),
        ...optional("date", readOptionalString(item, "date", itemPath)),
        ...optional("href", readOptionalString(item, "href", itemPath)),
      })),
    },
    shelf: {
      title: readString(shelf, "title", `${path}.shelf`),
      copy: readString(shelf, "copy", `${path}.shelf`),
    },
    footerHtml: readString(locale, "footer_html", path),
  };
}
