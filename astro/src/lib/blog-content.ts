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

interface BlogArticle {
  readonly title: string;
  readonly href: string;
  readonly meta: string;
  readonly summary: string;
}

interface BlogSiteData extends SiteData {
  readonly localeEn: LocaleInfo;
}

interface BlogPageData {
  readonly meta: MetaText;
  readonly title: string;
  readonly articles: readonly BlogArticle[];
  readonly footerHtml: string;
}

export interface BlogPageContent {
  readonly site: BlogSiteData;
  readonly blog: BlogPageData;
  readonly homeRoute: string;
  readonly blogRoute: string;
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

export function loadBlogPageContent(): BlogPageContent {
  const raw = JSON.parse(readFileSync(CONTENT_PATH, "utf-8")) as unknown;
  const root = asRecord(raw, "root");

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const localeEnRaw = asRecord(siteLocales.en, "root.site.locales.en");

  const routes = asRecord(root.routes, "root.routes");
  const routeIndex = asRecord(routes.index, "root.routes.index");
  const routeBlog = asRecord(routes.blog, "root.routes.blog");

  const pages = asRecord(root.pages, "root.pages");
  const blogPage = asRecord(pages.blog, "root.pages.blog");
  const blogLocales = asRecord(blogPage.locales, "root.pages.blog.locales");
  const blogEn = asRecord(blogLocales.en, "root.pages.blog.locales.en");
  const blogMeta = asRecord(blogEn.meta, "root.pages.blog.locales.en.meta");
  const blogHeader = asRecord(blogEn.header, "root.pages.blog.locales.en.header");

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
    blog: {
      meta: {
        title: readString(blogMeta, "title", "root.pages.blog.locales.en.meta"),
        description: readString(blogMeta, "description", "root.pages.blog.locales.en.meta"),
        keywords: readString(blogMeta, "keywords", "root.pages.blog.locales.en.meta"),
      },
      title: readString(blogHeader, "site_title", "root.pages.blog.locales.en.header"),
      articles: readBlogArticles(blogEn, "articles", "root.pages.blog.locales.en"),
      footerHtml: readString(blogEn, "footer_html", "root.pages.blog.locales.en"),
    },
    homeRoute: readString(routeIndex, "en", "root.routes.index"),
    blogRoute: readString(routeBlog, "en", "root.routes.blog"),
  };
}
