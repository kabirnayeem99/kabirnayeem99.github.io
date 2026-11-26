const TAG_PATTERN = /<[^>]*>/gu;
const WHITESPACE_PATTERN = /\s+/gu;
// Web links written into copy survive as Markdown links; every other tag is dropped.
const WEB_LINK_PATTERN = /<a\b[^>]*?\shref="(https?:[^"]+)"[^>]*>(.*?)<\/a>/gu;

function decodeEntity(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ");
}

export function toMarkdownText(value: string): string {
  const linked = value.replace(WEB_LINK_PATTERN, (_match, href: string, inner: string) => {
    const label = inner.replace(TAG_PATTERN, " ").trim();
    return `[${label}](${href})`;
  });
  const withoutTags = linked.replace(TAG_PATTERN, " ");
  const decoded = decodeEntity(withoutTags);
  return decoded.replace(WHITESPACE_PATTERN, " ").trim();
}

export function estimateMarkdownTokens(markdown: string): number {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  // Coarse estimate used by Markdown-for-Agents style tooling.
  return Math.ceil(trimmed.length / 4);
}

export function buildMarkdownResponse(markdown: string): Response {
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(estimateMarkdownTokens(markdown)),
    },
  });
}
