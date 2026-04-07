import {
  asRecord,
  loadSiteContentRoot,
  readDirection,
  readRouteMap,
  readString,
  readStringArray,
  type LocaleInfo,
  type MetaText,
  type RouteMap,
  type SiteData,
} from "./content-loader-shared";
import type { Lang } from "./site-types";

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
  readonly locale: LocaleInfo;
}

export interface StatsPageContent {
  readonly lang: Lang;
  readonly site: StatsSiteData;
  readonly meta: MetaText;
  readonly header: HeaderText;
  readonly intro: readonly string[];
  readonly sections: StatsSections;
  readonly footerHtml: string;
  readonly homeRoute: string;
  readonly route: string;
  readonly pageRoutes: RouteMap;
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

export function loadStatsPageContent(lang: Lang): StatsPageContent {
  const root = loadSiteContentRoot();

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const localeRaw = asRecord(siteLocales[lang], `root.site.locales.${lang}`);

  const routes = asRecord(root.routes, "root.routes");
  const routeIndex = readRouteMap(asRecord(routes.index, "root.routes.index"), "root.routes.index");
  const routeStats = readRouteMap(asRecord(routes.stats, "root.routes.stats"), "root.routes.stats");

  const pages = asRecord(root.pages, "root.pages");
  const statsPage = asRecord(pages.stats, "root.pages.stats");
  const statsLocales = asRecord(statsPage.locales, "root.pages.stats.locales");
  const statsLocale = asRecord(statsLocales[lang] ?? statsLocales.en, `root.pages.stats.locales.${lang}`);
  const meta = asRecord(statsLocale.meta, `root.pages.stats.locales.${lang}.meta`);
  const header = asRecord(statsLocale.header, `root.pages.stats.locales.${lang}.header`);
  const sections = asRecord(statsLocale.sections, `root.pages.stats.locales.${lang}.sections`);
  const wakatime = asRecord(sections.wakatime, `root.pages.stats.locales.${lang}.sections.wakatime`);
  const githubCommits = asRecord(
    sections.github_commits,
    `root.pages.stats.locales.${lang}.sections.github_commits`,
  );
  const leetcode = asRecord(sections.leetcode, `root.pages.stats.locales.${lang}.sections.leetcode`);
  const learningPath = asRecord(
    sections.learning_path,
    `root.pages.stats.locales.${lang}.sections.learning_path`,
  );
  const goodreads = asRecord(sections.goodreads, `root.pages.stats.locales.${lang}.sections.goodreads`);

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
        ogImageAlt: readString(localeRaw, "og_image_alt", `root.site.locales.${lang}`),
      },
    },
    meta: {
      title: readString(meta, "title", `root.pages.stats.locales.${lang}.meta`),
      description: readString(meta, "description", `root.pages.stats.locales.${lang}.meta`),
      keywords: readString(meta, "keywords", `root.pages.stats.locales.${lang}.meta`),
    },
    header: {
      siteTitle: readString(header, "site_title", `root.pages.stats.locales.${lang}.header`),
    },
    intro: readStringArray(statsLocale, "intro", `root.pages.stats.locales.${lang}`),
    sections: {
      wakatime: {
        title: readString(wakatime, "title", `root.pages.stats.locales.${lang}.sections.wakatime`),
        statusText: readString(
          wakatime,
          "status_text",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        languagesUrl: readString(
          wakatime,
          "languages_url",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        summaryUrl: readString(
          wakatime,
          "summary_url",
          `root.pages.stats.locales.${lang}.sections.wakatime`,
        ),
        ariaLabel: readString(wakatime, "aria_label", `root.pages.stats.locales.${lang}.sections.wakatime`),
      },
      githubCommits: {
        title: readString(
          githubCommits,
          "title",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        description: readString(
          githubCommits,
          "description",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        statusText: readString(
          githubCommits,
          "status_text",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        contribUrl: readString(
          githubCommits,
          "contrib_url",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        sourceLabel: readString(
          githubCommits,
          "source_label",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        sourceHref: readString(
          githubCommits,
          "source_href",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        sourceText: readString(
          githubCommits,
          "source_text",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        heatmapAriaLabel: readString(
          githubCommits,
          "heatmap_aria_label",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
        legendAriaLabel: readString(
          githubCommits,
          "legend_aria_label",
          `root.pages.stats.locales.${lang}.sections.github_commits`,
        ),
      },
      leetcode: {
        title: readString(leetcode, "title", `root.pages.stats.locales.${lang}.sections.leetcode`),
        copy: readString(leetcode, "copy", `root.pages.stats.locales.${lang}.sections.leetcode`),
        thanks: readString(leetcode, "thanks", `root.pages.stats.locales.${lang}.sections.leetcode`),
        cardSrc: readString(leetcode, "card_src", `root.pages.stats.locales.${lang}.sections.leetcode`),
        cardAlt: readString(leetcode, "card_alt", `root.pages.stats.locales.${lang}.sections.leetcode`),
      },
      learningPath: {
        title: readString(
          learningPath,
          "title",
          `root.pages.stats.locales.${lang}.sections.learning_path`,
        ),
        copy: readString(learningPath, "copy", `root.pages.stats.locales.${lang}.sections.learning_path`),
        href: readString(learningPath, "href", `root.pages.stats.locales.${lang}.sections.learning_path`),
        imageSrc: readString(
          learningPath,
          "image_src",
          `root.pages.stats.locales.${lang}.sections.learning_path`,
        ),
        imageAlt: readString(
          learningPath,
          "image_alt",
          `root.pages.stats.locales.${lang}.sections.learning_path`,
        ),
      },
      goodreads: {
        title: readString(goodreads, "title", `root.pages.stats.locales.${lang}.sections.goodreads`),
        copy: readString(goodreads, "copy", `root.pages.stats.locales.${lang}.sections.goodreads`),
        widgetId: readString(
          goodreads,
          "widget_id",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        userId: readString(goodreads, "user_id", `root.pages.stats.locales.${lang}.sections.goodreads`),
        userName: readString(goodreads, "user_name", `root.pages.stats.locales.${lang}.sections.goodreads`),
        profileHref: readString(
          goodreads,
          "profile_href",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        profileLabel: readString(
          goodreads,
          "profile_label",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
        scriptSrc: readString(
          goodreads,
          "script_src",
          `root.pages.stats.locales.${lang}.sections.goodreads`,
        ),
      },
    },
    footerHtml: readString(statsLocale, "footer_html", `root.pages.stats.locales.${lang}`),
    homeRoute: routeIndex[lang],
    route: routeStats[lang],
    pageRoutes: routeStats,
  };
}
