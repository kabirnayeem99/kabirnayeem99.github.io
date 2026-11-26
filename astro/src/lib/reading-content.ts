import {
  asRecord,
  loadSiteContentRoot,
  readLocaleInfo,
  readSiteContentFile,
  readString,
  readStringArray,
  type LocaleInfo,
  type MetaText,
  type SiteData,
} from "./content-loader-shared";
import { readingPageSchema } from "./content-schema.ts";
import type { Lang } from "./locale-config";
import type { CardImage } from "./work-project-content";

// The reading page is English-only for now: every locale falls back to the English copy
// and one route (reading.html).
const READING_ROUTE = "reading.html";

interface ReadingNowItem {
  readonly title: string;
  readonly subtitle?: string;
  readonly author?: string;
  readonly lang?: string;
  readonly note: string;
  readonly image?: CardImage;
}

interface ReadingLanguage {
  readonly name: string;
  readonly lang: string;
  readonly level: string;
  readonly note: string;
}

interface ReadingNote {
  readonly title: string;
  readonly author?: string;
  readonly date?: string;
  readonly href?: string;
  readonly paragraphs: readonly string[];
}

export interface ShelfText {
  readonly title: string;
  readonly copy: string;
  /** Heading for undated books at the top of the shelf: the newest arrivals. */
  readonly recentLabel: string;
  /** Heading for any other book without a read date. */
  readonly undatedLabel: string;
  /** Book counts, with "{count}" standing for the number. */
  readonly countOne: string;
  readonly countOther: string;
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
  readonly languages: { readonly title: string; readonly intro?: string; readonly items: readonly ReadingLanguage[] };
  readonly notes: { readonly title: string; readonly items: readonly ReadingNote[] };
  readonly shelf: ShelfText;
  readonly footerHtml: string;
}

export function loadReadingPageContent(lang: Lang): ReadingPageContent {
  const root = loadSiteContentRoot();
  const site = asRecord(root.site, "root.site");
  const siteLocale = asRecord(asRecord(site["locales"], "root.site.locales")["en"], "root.site.locales.en");
  const routes = asRecord(root.routes, "root.routes");
  const indexRoutes = asRecord(routes["index"], "root.routes.index");

  const locale = readSiteContentFile("pages/reading.json", readingPageSchema).locales.en;
  const { meta, header, now, languages, notes, shelf } = locale;

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
    meta,
    title: header.site_title,
    intro: locale.intro,
    now: { title: now.title, lastReadLabel: now.last_read_label, items: now.items },
    languages,
    notes,
    shelf: {
      title: shelf.title,
      copy: shelf.copy,
      recentLabel: shelf.recent_label,
      undatedLabel: shelf.undated_label,
      countOne: shelf.count_one,
      countOther: shelf.count_other,
    },
    footerHtml: locale.footer_html,
  };
}
