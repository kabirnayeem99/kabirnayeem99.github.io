import { loadBlogPageContent } from "../lib/blog-content";
import { loadIndexPageContent } from "../lib/index-content";
import { DEFAULT_LANG } from "../lib/locale-config";
import {
  buildMarkdownResponse,
  estimateMarkdownTokens,
  toMarkdownText,
} from "../lib/markdown-response";
import { loadStatsPageContent } from "../lib/stats-content";
import {
  loadProjectPageContent,
  loadWorkPageContent,
} from "../lib/work-project-content";

function toAbsoluteUrl(baseUrl: string, route: string): string {
  return route === "index.html" ? `${baseUrl}/` : `${baseUrl}/${route}`;
}

function buildIndexSection(): string {
  const content = loadIndexPageContent(DEFAULT_LANG);
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
    if (text.length > 0) lines.push(`- ${text}`);
  }
  for (const section of content.sections) {
    lines.push("");
    lines.push(`## ${toMarkdownText(section.title)}`);
    for (const paragraph of section.paragraphs) {
      const text = toMarkdownText(paragraph);
      if (text.length > 0) lines.push(text);
    }
    for (const highlight of section.highlights) {
      lines.push("");
      lines.push(`### ${toMarkdownText(highlight.title)}`);
      if (highlight.meta !== undefined) lines.push(`- Meta: ${toMarkdownText(highlight.meta)}`);
      if (highlight.href !== undefined) lines.push(`- Link: ${highlight.href}`);
      for (const p of highlight.paragraphs) {
        const text = toMarkdownText(p);
        if (text.length > 0) lines.push(`- ${text}`);
      }
      for (const b of highlight.bullets) {
        const text = toMarkdownText(b);
        if (text.length > 0) lines.push(`- ${text}`);
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
  return lines.join("\n");
}

function buildWorkSection(): string {
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
    if (entry.meta !== undefined) lines.push(`- Meta: ${toMarkdownText(entry.meta)}`);
    if (entry.href !== undefined) lines.push(`- Link: ${entry.href}`);
    for (const p of entry.paragraphs) {
      const text = toMarkdownText(p);
      if (text.length > 0) lines.push(`- ${text}`);
    }
    for (const b of entry.bullets) {
      const text = toMarkdownText(b);
      if (text.length > 0) lines.push(`- ${text}`);
    }
  }
  return lines.join("\n");
}

function buildProjectSection(): string {
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
      if (item.meta !== undefined) lines.push(`- Meta: ${toMarkdownText(item.meta)}`);
      if (item.href !== undefined) lines.push(`- Link: ${item.href}`);
      for (const p of item.paragraphs) {
        const text = toMarkdownText(p);
        if (text.length > 0) lines.push(`- ${text}`);
      }
      for (const b of item.bullets) {
        const text = toMarkdownText(b);
        if (text.length > 0) lines.push(`- ${text}`);
      }
    }
  }
  return lines.join("\n");
}

function buildBlogSection(): string {
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
  return lines.join("\n");
}

function buildStatsSection(): string {
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
  for (const p of content.intro) {
    const text = toMarkdownText(p);
    if (text.length > 0) lines.push(`- ${text}`);
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
  lines.push(`- API: ${content.sections.leetcode.apiUrl}`);
  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.learningPath.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.learningPath.copy)}`);
  lines.push(`- Roadmap: ${content.sections.learningPath.href}`);
  lines.push("");
  lines.push(`## ${toMarkdownText(content.sections.goodreads.title)}`);
  lines.push(`- ${toMarkdownText(content.sections.goodreads.copy)}`);
  lines.push(`- Profile: [${toMarkdownText(content.sections.goodreads.userName)}](${content.sections.goodreads.profileHref})`);
  return lines.join("\n");
}

export function GET(): Response {
  const sections = [
    buildIndexSection(),
    buildWorkSection(),
    buildProjectSection(),
    buildBlogSection(),
    buildStatsSection(),
  ];
  const body = sections.join("\n\n---\n\n") + "\n";
  const response = buildMarkdownResponse(body);
  const tokenCount = estimateMarkdownTokens(body);
  const headers = new Headers(response.headers);
  headers.set("x-markdown-tokens", String(tokenCount));
  return new Response(body, { headers });
}
