import { loadStatsPageContent } from "../lib/stats-content";
import { buildMarkdownResponse, toMarkdownText } from "../lib/markdown-response";

export function GET(): Response {
  const content = loadStatsPageContent("en");
  const canonicalUrl = `${content.site.baseUrl}/${content.route}`;
  const lines: string[] = [];

  lines.push(`# ${toMarkdownText(content.header.siteTitle)}`);
  lines.push("");
  lines.push(`> ${toMarkdownText(content.meta.description)}`);
  lines.push("");
  lines.push(`Canonical: ${canonicalUrl}`);
  lines.push("");
  lines.push("## Intro");
  for (const paragraph of content.intro) {
    const text = toMarkdownText(paragraph);
    if (text.length > 0) {
      lines.push(`- ${text}`);
    }
  }

  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.wakatime.title)}`);
  lines.push(`- Languages JSON: ${content.sections.wakatime.languagesUrl}`);
  lines.push(`- Summary JSON: ${content.sections.wakatime.summaryUrl}`);

  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.githubCommits.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.githubCommits.description)}`);
  lines.push(`- Source: [${toMarkdownText(content.sections.githubCommits.sourceText)}](${content.sections.githubCommits.sourceHref})`);
  lines.push(`- Contributions API: ${content.sections.githubCommits.contribUrl}`);

  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.leetcode.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.leetcode.copy)}`);
  lines.push(`- Card: ${content.sections.leetcode.cardSrc}`);

  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.learningPath.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.learningPath.copy)}`);
  lines.push(`- Roadmap: ${content.sections.learningPath.href}`);
  lines.push(`- Card: ${content.sections.learningPath.imageSrc}`);

  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.goodreads.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.goodreads.copy)}`);
  lines.push(`- Profile: [${toMarkdownText(content.sections.goodreads.userName)}](${content.sections.goodreads.profileHref})`);

  lines.push("");
  return buildMarkdownResponse(`${lines.join("\n")}\n`);
}
