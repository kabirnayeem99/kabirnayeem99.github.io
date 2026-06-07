import { buildSeoFileContext } from "../../lib/seo-files.js";

export function GET() {
  const { baseUrl } = buildSeoFileContext();

  const body = {
    name: "Kabir Nayeem Portfolio",
    description:
      "Personal portfolio of Naimul Kabir — software engineer, bibliophile. Exposes read-only content skills for retrieving work history, projects, blog posts, and developer stats.",
    url: `${baseUrl}/`,
    version: "1.0.0",
    documentationUrl: `${baseUrl}/docs/api`,
    provider: {
      organization: "Naimul Kabir",
      url: `${baseUrl}/`,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: null,
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/markdown", "application/json"],
    skills: [
      {
        id: "get-full-content",
        name: "Get Full Content",
        description: "Retrieve all page content as concatenated Markdown in one request.",
        tags: ["content", "markdown", "portfolio"],
        examples: ["What is Kabir's work history?", "Summarise Kabir's projects"],
        inputModes: ["text/plain"],
        outputModes: ["text/markdown"],
      },
      {
        id: "get-structured-data",
        name: "Get Structured Metadata",
        description: "Retrieve machine-readable JSON metadata about this portfolio.",
        tags: ["metadata", "json", "structured-data"],
        examples: ["What APIs does this site expose?"],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
    ],
    _meta: {
      status: "informational",
      note: "Static GitHub Pages deployment. No live A2A endpoint exists; this card advertises read-only content skills accessible via HTTP GET.",
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
