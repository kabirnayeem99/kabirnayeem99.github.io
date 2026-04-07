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

interface BlogArticle {
  readonly title: string;
  readonly href: string;
  readonly meta: string;
  readonly summary: string;
}

interface BlogSiteData extends SiteData {
  readonly locale: LocaleInfo;
}

interface BlogPageData {
  readonly meta: MetaText;
  readonly title: string;
  readonly articles: readonly BlogArticle[];
  readonly footerHtml: string;
}

export interface BlogPageContent {
  readonly lang: Lang;
  readonly site: BlogSiteData;
  readonly blog: BlogPageData;
  readonly homeRoute: string;
  readonly route: string;
  readonly pageRoutes: RouteMap;
}

function readBlogArticles(source: Record<string, unknown>, key: string, path: string): readonly BlogArticle[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }

  const output: BlogArticle[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const articlePath = `${path}.${key}[${index}]`;
    const article = asRecord(value[index], articlePath);
    output.push({
      title: readString(article, "title", articlePath),
      href: readString(article, "href", articlePath),
      meta: readString(article, "meta", articlePath),
      summary: readString(article, "summary", articlePath),
    });
  }
  return output;
}

export function loadBlogPageContent(lang: Lang): BlogPageContent {
  const root = loadSiteContentRoot();

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const localeRaw = asRecord(siteLocales[lang], `root.site.locales.${lang}`);

  const routes = asRecord(root.routes, "root.routes");
  const routeIndex = readRouteMap(asRecord(routes.index, "root.routes.index"), "root.routes.index");
  const routeBlog = readRouteMap(asRecord(routes.blog, "root.routes.blog"), "root.routes.blog");

  const pages = asRecord(root.pages, "root.pages");
  const blogPage = asRecord(pages.blog, "root.pages.blog");
  const blogLocales = asRecord(blogPage.locales, "root.pages.blog.locales");
  const blogLocale = asRecord(blogLocales[lang] ?? blogLocales.en, `root.pages.blog.locales.${lang}`);
  const blogMeta = asRecord(blogLocale.meta, `root.pages.blog.locales.${lang}.meta`);
  const blogHeader = asRecord(blogLocale.header, `root.pages.blog.locales.${lang}.header`);

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
    blog: {
      meta: {
        title: readString(blogMeta, "title", `root.pages.blog.locales.${lang}.meta`),
        description: readString(blogMeta, "description", `root.pages.blog.locales.${lang}.meta`),
        keywords: readString(blogMeta, "keywords", `root.pages.blog.locales.${lang}.meta`),
      },
      title: readString(blogHeader, "site_title", `root.pages.blog.locales.${lang}.header`),
      articles: readBlogArticles(blogLocale, "articles", `root.pages.blog.locales.${lang}`),
      footerHtml: readString(blogLocale, "footer_html", `root.pages.blog.locales.${lang}`),
    },
    homeRoute: routeIndex[lang],
    route: routeBlog[lang],
    pageRoutes: routeBlog,
  };
}
