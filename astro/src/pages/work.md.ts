import { buildMarkdownResponse, toMarkdownText } from "../lib/markdown-response";
import { loadWorkPageContent } from "../lib/work-project-content";

export function GET(): Response {
  const content = loadWorkPageContent("en");
  const canonicalUrl = `${content.site.baseUrl}/${content.route}`;
  const lines: string[] = [];

  lines.push(`# ${toMarkdownText(content.header.siteTitle)}`);
  lines.push("");
  lines.push(`> ${toMarkdownText(content.meta.description)}`);
  lines.push("");
  lines.push(`Canonical: ${canonicalUrl}`);
  lines.push("");
  lines.push(`## ${toMarkdownText(content.sectionTitle)}`);
  lines.push(toMarkdownText(content.summary));

  for (const entry of content.entries) {
    lines.push("");
    lines.push(`### ${toMarkdownText(entry.title)}`);
    if (entry.meta !== undefined) {
      lines.push(`- Meta: ${toMarkdownText(entry.meta)}`);
    }
    if (entry.href !== undefined) {
      lines.push(`- Link: ${entry.href}`);
    }
    for (const paragraph of entry.paragraphs) {
      const text = toMarkdownText(paragraph);
      if (text.length > 0) {
        lines.push(`- ${text}`);
      }
    }
    for (const bullet of entry.bullets) {
      const text = toMarkdownText(bullet);
      if (text.length > 0) {
        lines.push(`- ${text}`);
      }
    }
  }

  lines.push("");
  return buildMarkdownResponse(`${lines.join("\n")}\n`);
}
