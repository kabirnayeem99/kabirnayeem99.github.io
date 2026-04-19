import { loadBlogPageContent } from "../lib/blog-content";
import { buildMarkdownResponse, toMarkdownText } from "../lib/markdown-response";

export function GET(): Response {
  const content = loadBlogPageContent("en");
  const canonicalUrl = `${content.site.baseUrl}/${content.route}`;
  const lines: string[] = [];

  lines.push(`# ${toMarkdownText(content.blog.title)}`);
  lines.push("");
  lines.push(`> ${toMarkdownText(content.blog.meta.description)}`);
  lines.push("");
  lines.push(`Canonical: ${canonicalUrl}`);
  lines.push("");
  lines.push("## Articles");

  for (const article of content.blog.articles) {
    lines.push(`- [${toMarkdownText(article.title)}](${article.href})`);
    lines.push(`  - Meta: ${toMarkdownText(article.meta)}`);
    lines.push(`  - Summary: ${toMarkdownText(article.summary)}`);
  }

  lines.push("");
  return buildMarkdownResponse(`${lines.join("\n")}\n`);
}
