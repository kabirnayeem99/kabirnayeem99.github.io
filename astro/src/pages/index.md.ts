import { loadIndexPageContent } from "../lib/index-content";
import { buildMarkdownResponse, toMarkdownText } from "../lib/markdown-response";

function toAbsoluteUrl(baseUrl: string, route: string): string {
  if (route === "index.html") {
    return `${baseUrl}/`;
  }
  return `${baseUrl}/${route}`;
}

export function GET(): Response {
  const content = loadIndexPageContent("en");
  const lines: string[] = [];

  lines.push(`# ${toMarkdownText(content.header.siteTitle)}`);
  lines.push("");
  lines.push(`> ${toMarkdownText(content.meta.description)}`);
  lines.push("");
  lines.push(`Canonical: ${content.site.baseUrl}/`);
  lines.push("");
  lines.push("## Summary");
  for (const paragraph of content.summaryCard) {
    const text = toMarkdownText(paragraph);
    if (text.length > 0) {
      lines.push(`- ${text}`);
    }
  }

  for (const section of content.sections) {
    lines.push("");
    lines.push(`## ${toMarkdownText(section.title)}`);

    for (const paragraph of section.paragraphs) {
      const text = toMarkdownText(paragraph);
      if (text.length > 0) {
        lines.push(text);
      }
    }

    for (const highlight of section.highlights) {
      lines.push("");
      lines.push(`### ${toMarkdownText(highlight.title)}`);
      if (highlight.meta !== undefined) {
        lines.push(`- Meta: ${toMarkdownText(highlight.meta)}`);
      }
      if (highlight.href !== undefined) {
        lines.push(`- Link: ${highlight.href}`);
      }
      for (const paragraph of highlight.paragraphs) {
        const text = toMarkdownText(paragraph);
        if (text.length > 0) {
          lines.push(`- ${text}`);
        }
      }
      for (const bullet of highlight.bullets) {
        const text = toMarkdownText(bullet);
        if (text.length > 0) {
          lines.push(`- ${text}`);
        }
      }
    }

    for (const article of section.articles) {
      lines.push(`- [${toMarkdownText(article.title)}](${article.href}): ${toMarkdownText(article.summary)}`);
    }
  }

  lines.push("");
  lines.push("## Main Routes");
  lines.push(`- Home: ${content.site.baseUrl}/`);
  lines.push(`- Work: ${toAbsoluteUrl(content.site.baseUrl, content.routes.work.en)}`);
  lines.push(`- Projects: ${toAbsoluteUrl(content.site.baseUrl, content.routes.project.en)}`);
  lines.push(`- Blog: ${toAbsoluteUrl(content.site.baseUrl, content.routes.blog.en)}`);
  lines.push(`- Stats: ${toAbsoluteUrl(content.site.baseUrl, content.routes.stats.en)}`);
  lines.push("");

  return buildMarkdownResponse(`${lines.join("\n")}\n`);
}
