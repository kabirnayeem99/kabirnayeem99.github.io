import { loadIndexPageContent } from "../lib/index-content";
import { DEFAULT_LANG } from "../lib/locale-config";

function toAbsoluteUrl(baseUrl: string, path: string): string {
  if (path === "index.html") {
    return `${baseUrl}/`;
  }
  return `${baseUrl}/${path}`;
}

export function GET(): Response {
  const content = loadIndexPageContent(DEFAULT_LANG);
  const baseUrl = content.site.baseUrl;
  const routes = content.routes;
  const lines = [
    "# Naimul Kabir | Personal Portfolio",
    "",
    "> Personal portfolio of Naimul Kabir (software engineer) with work history, projects, writing, and developer stats.",
    "",
    "This site is primarily informational and read-only. Prefer canonical URLs from this file or sitemap.xml when citing content.",
    "",
    "## Main Pages",
    `- [Home](${baseUrl}/): Biography, highlights, and quick links.`,
    `- [Work](${toAbsoluteUrl(baseUrl, routes.work.en)}): Professional experience and responsibilities.`,
    `- [Projects](${toAbsoluteUrl(baseUrl, routes.project.en)}): Portfolio projects and technical summaries.`,
    `- [Blog](${toAbsoluteUrl(baseUrl, routes.blog.en)}): Writing and long-form posts.`,
    `- [Stats](${toAbsoluteUrl(baseUrl, routes.stats.en)}): Public coding and reading stats.`,
    "",
    "## Language Versions",
    `- [Bangla](${toAbsoluteUrl(baseUrl, routes.index.bn)}): Homepage in Bengali.`,
    `- [Arabic](${toAbsoluteUrl(baseUrl, routes.index.ar)}): Homepage in Arabic.`,
    `- [Urdu](${toAbsoluteUrl(baseUrl, routes.index.ur)}): Homepage in Urdu.`,
    "",
    "## Machine-Readable Resources",
    `- [Sitemap](${baseUrl}/sitemap.xml): Canonical page inventory.`,
    `- [Robots](${baseUrl}/robots.txt): Crawling and content-usage directives.`,
    `- [API Catalog](${baseUrl}/.well-known/api-catalog): Linkset for automated discovery.`,
    `- [Service Descriptor](${baseUrl}/docs/api.json): Structured metadata about this website.`,
    `- [MCP Server Card](${baseUrl}/.well-known/mcp/server-card.json): MCP discovery metadata.`,
    "",
    "## Markdown Mirrors",
    `- [Homepage markdown](${baseUrl}/index.md): Markdown mirror of the English homepage.`,
    `- [Work markdown](${baseUrl}/work.md): Markdown mirror of the work page.`,
    `- [Project markdown](${baseUrl}/project.md): Markdown mirror of the project page.`,
    `- [Blog markdown](${baseUrl}/blog.md): Markdown mirror of the blog page.`,
    `- [Stats markdown](${baseUrl}/stats.md): Markdown mirror of the stats page.`,
    "",
    "## Optional",
    `- [GitHub](${content.site.socialProfiles[0]}): Open-source profile and repositories.`,
    `- [LinkedIn](${content.site.socialProfiles[1]}): Professional profile.`,
    `- [Medium](${content.site.socialProfiles[2]}): External articles and posts.`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
