import { buildSeoFileContext } from "../../../lib/seo-files";

export function GET() {
  const { baseUrl } = buildSeoFileContext();
  const body = {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: "kabirnayeem99-portfolio",
      title: "Kabir Nayeem Portfolio",
      version: "0.1.0",
    },
    description:
      "Discovery card for a planned HTTP MCP endpoint associated with this portfolio.",
    documentationUrl: `${baseUrl}/docs/api`,
    transport: {
      type: "streamable-http",
      endpoint: `${baseUrl}/mcp`,
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: false,
      },
      prompts: {
        listChanged: false,
      },
    },
    tools: [],
    resources: [],
    prompts: [],
    _meta: {
      status: "planned",
      notes:
        "Static GitHub Pages deployment currently serves discovery metadata only.",
    },
  };

  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
