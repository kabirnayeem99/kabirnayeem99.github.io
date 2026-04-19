import { computeLegacyBuildTimestamp } from "./build-timestamp";
import { loadIndexPageContent } from "./index-content";
import { DEFAULT_LANG, LANGS, type Lang } from "./locale-config";

type SitemapPriority = "1.0" | "0.8" | "0.7" | "0.6";

export interface SitemapEntry {
  readonly href: string;
  readonly priority: SitemapPriority;
}

export interface SeoFileContext {
  readonly baseUrl: string;
  readonly lastModifiedDate: string;
  readonly sitemapEntries: readonly SitemapEntry[];
}

const DEFAULT_PRIORITY_BY_LANG: Readonly<Record<Lang, SitemapPriority>> = {
  en: "0.8",
  bn: "0.7",
  ar: "0.6",
  ur: "0.6",
};

function buildLastModifiedDate(): string {
  const timestamp = computeLegacyBuildTimestamp();
  const [datePart] = timestamp.iso.split("T");
  if (datePart === undefined) {
    throw new Error("Missing date part in build timestamp");
  }
  return datePart;
}

export function buildSeoFileContext(): SeoFileContext {
  const indexPage = loadIndexPageContent(DEFAULT_LANG);
  const baseUrl = indexPage.site.baseUrl;
  const routes = indexPage.routes;
  const sitemapEntries: SitemapEntry[] = [{ href: `${baseUrl}/`, priority: "1.0" }];

  for (const lang of LANGS) {
    if (lang === DEFAULT_LANG) {
      continue;
    }
    sitemapEntries.push({
      href: `${baseUrl}/${routes.index[lang]}`,
      priority: DEFAULT_PRIORITY_BY_LANG[lang],
    });
  }

  for (const pageId of ["work", "project", "blog", "stats"] as const) {
    for (const lang of LANGS) {
      sitemapEntries.push({
        href: `${baseUrl}/${routes[pageId][lang]}`,
        priority: DEFAULT_PRIORITY_BY_LANG[lang],
      });
    }
  }

  sitemapEntries.push(
    { href: `${baseUrl}/llms.txt`, priority: "0.7" },
    { href: `${baseUrl}/index.md`, priority: "0.7" },
    { href: `${baseUrl}/work.md`, priority: "0.6" },
    { href: `${baseUrl}/project.md`, priority: "0.6" },
    { href: `${baseUrl}/blog.md`, priority: "0.6" },
    { href: `${baseUrl}/stats.md`, priority: "0.6" },
    { href: `${baseUrl}/docs/api`, priority: "0.7" },
    { href: `${baseUrl}/docs/api.json`, priority: "0.6" },
    { href: `${baseUrl}/.well-known/api-catalog`, priority: "0.6" },
    { href: `${baseUrl}/.well-known/mcp/server-card.json`, priority: "0.6" },
  );

  return {
    baseUrl,
    lastModifiedDate: buildLastModifiedDate(),
    sitemapEntries,
  };
}
