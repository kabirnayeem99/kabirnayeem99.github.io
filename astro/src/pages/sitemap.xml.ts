import { buildSeoFileContext } from "../lib/seo-files";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET(): Response {
  const context = buildSeoFileContext();
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  for (const entry of context.sitemapEntries) {
    lines.push("    <url>");
    lines.push(`        <loc>${escapeXml(entry.href)}</loc>`);
    lines.push(`        <lastmod>${context.lastModifiedDate}</lastmod>`);
    lines.push(`        <priority>${entry.priority}</priority>`);
    lines.push("    </url>");
  }

  lines.push("</urlset>");

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
