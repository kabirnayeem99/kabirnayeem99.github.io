import { buildSeoFileContext } from "../lib/seo-files";

export function GET(): Response {
  const { baseUrl } = buildSeoFileContext();
  const body = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
