import { buildSeoFileContext } from "../lib/seo-files";

const EXPLICITLY_ALLOWED_AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Google-Extended",
  "Googlebot",
  "ClaudeBot",
  "Claude-User",
  "FacebookBot",
  "Meta-ExternalAgent",
  "Bingbot",
  "BingPreview",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "YouBot",
  "Diffbot",
] as const;

export function GET(): Response {
  const { baseUrl } = buildSeoFileContext();
  const explicitAllowBlocks = EXPLICITLY_ALLOWED_AI_BOTS.map(
    (bot) => `User-agent: ${bot}\nAllow: /`,
  ).join("\n\n");

  const body = `${explicitAllowBlocks}

User-agent: *
Allow: /
Content-Signal: ai-train=yes, search=yes, ai-input=yes

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
