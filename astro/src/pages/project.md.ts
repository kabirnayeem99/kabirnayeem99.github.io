import { buildMarkdownResponse, toMarkdownText } from "../lib/markdown-response";
import { loadProjectPageContent } from "../lib/work-project-content";

export function GET(): Response {
  const content = loadProjectPageContent("en");
  const canonicalUrl = `${content.site.baseUrl}/${content.route}`;
  const lines: string[] = [];

  lines.push(`# ${toMarkdownText(content.header.siteTitle)}`);
  lines.push("");
  lines.push(`> ${toMarkdownText(content.meta.description)}`);
  lines.push("");
  lines.push(`Canonical: ${canonicalUrl}`);

  for (const group of content.groups) {
    lines.push("");
    lines.push(`## ${toMarkdownText(group.title)}`);
    for (const item of group.items) {
      lines.push("");
      lines.push(`### ${toMarkdownText(item.title)}`);
      if (item.meta !== undefined) {
        lines.push(`- Meta: ${toMarkdownText(item.meta)}`);
      }
      if (item.href !== undefined) {
        lines.push(`- Link: ${item.href}`);
      }
      for (const paragraph of item.paragraphs) {
        const text = toMarkdownText(paragraph);
        if (text.length > 0) {
          lines.push(`- ${text}`);
        }
      }
      for (const bullet of item.bullets) {
        const text = toMarkdownText(bullet);
        if (text.length > 0) {
          lines.push(`- ${text}`);
        }
      }
    }
  }

  lines.push("");
  return buildMarkdownResponse(`${lines.join("\n")}\n`);
}
