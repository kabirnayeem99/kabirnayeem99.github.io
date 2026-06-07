import type { APIRoute } from "astro";
import { loadBlogPageContent } from "../lib/blog-content";

export const GET: APIRoute = () => {
  const content = loadBlogPageContent("en");
  const baseUrl = content.site.baseUrl;
  const feedUrl = `${baseUrl}/feed.xml`;
  const blogUrl = `${baseUrl}/${content.route}`;

  const items = content.blog.articles
    .map(
      (article) => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${article.href}</link>
      <guid isPermaLink="true">${article.href}</guid>
      <description><![CDATA[${article.summary}]]></description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:sy="http://purl.org/rss/modules/syndication/">
  <channel>
    <title><![CDATA[${content.site.websiteName} — Blog]]></title>
    <link>${blogUrl}</link>
    <description><![CDATA[${content.blog.meta.description}]]></description>
    <language>en</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <sy:updatePeriod>monthly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
