import { readFileSync } from "node:fs";
import {
  CONTENT_PATH,
  asRecord,
  readDirection,
  readString,
  readStringArray,
  type LocaleInfo,
  type MetaText,
  type SiteData,
} from "./content-loader-shared";

interface HeaderText {
  readonly siteTitle: string;
}

interface WakaTimeSection {
  readonly title: string;
  readonly statusText: string;
  readonly languagesUrl: string;
  readonly summaryUrl: string;
  readonly ariaLabel: string;
}

interface GitHubCommitsSection {
  readonly title: string;
  readonly description: string;
  readonly statusText: string;
  readonly contribUrl: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
  readonly sourceText: string;
  readonly heatmapAriaLabel: string;
  readonly legendAriaLabel: string;
}

interface LeetCodeSection {
  readonly title: string;
  readonly copy: string;
  readonly thanks: string;
  readonly cardSrc: string;
  readonly cardAlt: string;
}

interface LearningPathSection {
  readonly title: string;
  readonly copy: string;
  readonly href: string;
  readonly imageSrc: string;
  readonly imageAlt: string;
}

interface GoodreadsSection {
  readonly title: string;
  readonly copy: string;
  readonly widgetId: string;
  readonly userId: string;
  readonly userName: string;
  readonly profileHref: string;
  readonly profileLabel: string;
  readonly scriptSrc: string;
}

interface StatsSections {
  readonly wakatime: WakaTimeSection;
  readonly githubCommits: GitHubCommitsSection;
  readonly leetcode: LeetCodeSection;
  readonly learningPath: LearningPathSection;
  readonly goodreads: GoodreadsSection;
}

interface StatsSiteData extends SiteData {
  readonly localeEn: LocaleInfo;
}

export interface StatsPageContent {
  readonly site: StatsSiteData;
  readonly meta: MetaText;
  readonly header: HeaderText;
  readonly intro: readonly string[];
  readonly sections: StatsSections;
  readonly footerHtml: string;
  readonly homeRoute: string;
  readonly route: string;
}

function replaceQueryParams(url: string, replacements: Readonly<Record<string, string>>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(replacements)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

export function statsEmbedThemeSources(
  lightUrl: string,
  provider: "leetcode" | "roadmap",
): readonly [string, string] {
  if (provider === "leetcode") {
    const darkColors = "#3F3A36,#D6D3D1,#F5F5F4,#A8A29E,#FB923C,#73AF6F,#FACC15,#FF5555,";
    const darkUrl = replaceQueryParams(lightUrl, {
      theme: "dark",
      colors: darkColors,
    });
    return [lightUrl, darkUrl];
  }

  const darkUrl = replaceQueryParams(lightUrl, { variant: "dark" });
  return [lightUrl, darkUrl];
}

export function loadStatsPageContent(): StatsPageContent {
  const raw = JSON.parse(readFileSync(CONTENT_PATH, "utf-8")) as unknown;
  const root = asRecord(raw, "root");

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const localeEnRaw = asRecord(siteLocales.en, "root.site.locales.en");

  const routes = asRecord(root.routes, "root.routes");
  const routeIndex = asRecord(routes.index, "root.routes.index");
  const routeStats = asRecord(routes.stats, "root.routes.stats");

  const pages = asRecord(root.pages, "root.pages");
  const statsPage = asRecord(pages.stats, "root.pages.stats");
  const statsLocales = asRecord(statsPage.locales, "root.pages.stats.locales");
  const statsEn = asRecord(statsLocales.en, "root.pages.stats.locales.en");
  const meta = asRecord(statsEn.meta, "root.pages.stats.locales.en.meta");
  const header = asRecord(statsEn.header, "root.pages.stats.locales.en.header");
  const sections = asRecord(statsEn.sections, "root.pages.stats.locales.en.sections");
  const wakatime = asRecord(sections.wakatime, "root.pages.stats.locales.en.sections.wakatime");
  const githubCommits = asRecord(
    sections.github_commits,
    "root.pages.stats.locales.en.sections.github_commits",
  );
  const leetcode = asRecord(sections.leetcode, "root.pages.stats.locales.en.sections.leetcode");
  const learningPath = asRecord(
    sections.learning_path,
    "root.pages.stats.locales.en.sections.learning_path",
  );
  const goodreads = asRecord(sections.goodreads, "root.pages.stats.locales.en.sections.goodreads");

  return {
    site: {
      baseUrl: readString(site, "base_url", "root.site"),
      personName: readString(site, "person_name", "root.site"),
      websiteName: readString(site, "website_name", "root.site"),
      twitterSite: readString(site, "twitter_site", "root.site"),
      socialProfiles: readStringArray(site, "social_profiles", "root.site"),
      googleSiteVerification: readString(site, "google_site_verification", "root.site"),
      localeEn: {
        dir: readDirection(localeEnRaw, "dir", "root.site.locales.en"),
        author: readString(localeEnRaw, "author", "root.site.locales.en"),
        ogImageAlt: readString(localeEnRaw, "og_image_alt", "root.site.locales.en"),
      },
    },
    meta: {
      title: readString(meta, "title", "root.pages.stats.locales.en.meta"),
      description: readString(meta, "description", "root.pages.stats.locales.en.meta"),
      keywords: readString(meta, "keywords", "root.pages.stats.locales.en.meta"),
    },
    header: {
      siteTitle: readString(header, "site_title", "root.pages.stats.locales.en.header"),
    },
    intro: readStringArray(statsEn, "intro", "root.pages.stats.locales.en"),
    sections: {
      wakatime: {
        title: readString(wakatime, "title", "root.pages.stats.locales.en.sections.wakatime"),
        statusText: readString(
          wakatime,
          "status_text",
          "root.pages.stats.locales.en.sections.wakatime",
        ),
        languagesUrl: readString(
          wakatime,
          "languages_url",
          "root.pages.stats.locales.en.sections.wakatime",
        ),
        summaryUrl: readString(
          wakatime,
          "summary_url",
          "root.pages.stats.locales.en.sections.wakatime",
        ),
        ariaLabel: readString(wakatime, "aria_label", "root.pages.stats.locales.en.sections.wakatime"),
      },
      githubCommits: {
        title: readString(
          githubCommits,
          "title",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        description: readString(
          githubCommits,
          "description",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        statusText: readString(
          githubCommits,
          "status_text",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        contribUrl: readString(
          githubCommits,
          "contrib_url",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        sourceLabel: readString(
          githubCommits,
          "source_label",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        sourceHref: readString(
          githubCommits,
          "source_href",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        sourceText: readString(
          githubCommits,
          "source_text",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        heatmapAriaLabel: readString(
          githubCommits,
          "heatmap_aria_label",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
        legendAriaLabel: readString(
          githubCommits,
          "legend_aria_label",
          "root.pages.stats.locales.en.sections.github_commits",
        ),
      },
      leetcode: {
        title: readString(leetcode, "title", "root.pages.stats.locales.en.sections.leetcode"),
        copy: readString(leetcode, "copy", "root.pages.stats.locales.en.sections.leetcode"),
        thanks: readString(leetcode, "thanks", "root.pages.stats.locales.en.sections.leetcode"),
        cardSrc: readString(leetcode, "card_src", "root.pages.stats.locales.en.sections.leetcode"),
        cardAlt: readString(leetcode, "card_alt", "root.pages.stats.locales.en.sections.leetcode"),
      },
      learningPath: {
        title: readString(
          learningPath,
          "title",
          "root.pages.stats.locales.en.sections.learning_path",
        ),
        copy: readString(learningPath, "copy", "root.pages.stats.locales.en.sections.learning_path"),
        href: readString(learningPath, "href", "root.pages.stats.locales.en.sections.learning_path"),
        imageSrc: readString(
          learningPath,
          "image_src",
          "root.pages.stats.locales.en.sections.learning_path",
        ),
        imageAlt: readString(
          learningPath,
          "image_alt",
          "root.pages.stats.locales.en.sections.learning_path",
        ),
      },
      goodreads: {
        title: readString(goodreads, "title", "root.pages.stats.locales.en.sections.goodreads"),
        copy: readString(goodreads, "copy", "root.pages.stats.locales.en.sections.goodreads"),
        widgetId: readString(
          goodreads,
          "widget_id",
          "root.pages.stats.locales.en.sections.goodreads",
        ),
        userId: readString(goodreads, "user_id", "root.pages.stats.locales.en.sections.goodreads"),
        userName: readString(goodreads, "user_name", "root.pages.stats.locales.en.sections.goodreads"),
        profileHref: readString(
          goodreads,
          "profile_href",
          "root.pages.stats.locales.en.sections.goodreads",
        ),
        profileLabel: readString(
          goodreads,
          "profile_label",
          "root.pages.stats.locales.en.sections.goodreads",
        ),
        scriptSrc: readString(
          goodreads,
          "script_src",
          "root.pages.stats.locales.en.sections.goodreads",
        ),
      },
    },
    footerHtml: readString(statsEn, "footer_html", "root.pages.stats.locales.en"),
    homeRoute: readString(routeIndex, "en", "root.routes.index"),
    route: readString(routeStats, "en", "root.routes.stats"),
  };
}
