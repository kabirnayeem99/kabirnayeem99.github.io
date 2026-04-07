import { computeLegacyBuildTimestamp } from "./build-timestamp";
import { loadIndexPageContent } from "./index-content";

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

function buildLastModifiedDate(): string {
  const timestamp = computeLegacyBuildTimestamp();
  const [datePart] = timestamp.iso.split("T");
  if (datePart === undefined) {
    throw new Error("Missing date part in build timestamp");
  }
  return datePart;
}

export function buildSeoFileContext(): SeoFileContext {
  const indexPage = loadIndexPageContent("en");
  const baseUrl = indexPage.site.baseUrl;
  const routes = indexPage.routes;

  return {
    baseUrl,
    lastModifiedDate: buildLastModifiedDate(),
    sitemapEntries: [
      { href: `${baseUrl}/`, priority: "1.0" },
      { href: `${baseUrl}/${routes.index.bn}`, priority: "0.7" },
      { href: `${baseUrl}/${routes.index.ar}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.index.ur}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.work.en}`, priority: "0.8" },
      { href: `${baseUrl}/${routes.work.bn}`, priority: "0.7" },
      { href: `${baseUrl}/${routes.work.ar}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.work.ur}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.project.en}`, priority: "0.8" },
      { href: `${baseUrl}/${routes.project.bn}`, priority: "0.7" },
      { href: `${baseUrl}/${routes.project.ar}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.project.ur}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.blog.en}`, priority: "0.8" },
      { href: `${baseUrl}/${routes.blog.bn}`, priority: "0.7" },
      { href: `${baseUrl}/${routes.blog.ar}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.blog.ur}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.stats.en}`, priority: "0.8" },
      { href: `${baseUrl}/${routes.stats.bn}`, priority: "0.7" },
      { href: `${baseUrl}/${routes.stats.ar}`, priority: "0.6" },
      { href: `${baseUrl}/${routes.stats.ur}`, priority: "0.6" },
    ],
  };
}
