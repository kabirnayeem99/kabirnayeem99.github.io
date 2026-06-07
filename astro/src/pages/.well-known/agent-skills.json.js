import { buildSeoFileContext } from "../../lib/seo-files.js";

export function GET() {
  const { baseUrl } = buildSeoFileContext();

  const body = {
    schema_version: "v1",
    name: "Kabir Nayeem Portfolio",
    description:
      "Read-only skills for retrieving content from Kabir Nayeem's personal portfolio.",
    url: `${baseUrl}/`,
    authentication: { type: "none" },
    skills: [
      {
        name: "get-content-index",
        description:
          "Retrieve a curated index of all main pages and machine-readable endpoints.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/llms.txt`,
          content_type: "text/plain",
        },
      },
      {
        name: "get-full-content",
        description:
          "Retrieve the full markdown content of all main pages concatenated into one document.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/llms-full.txt`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-homepage",
        description: "Read the homepage biography, highlights, and quick links as Markdown.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/index.md`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-work-history",
        description: "Read professional experience and work responsibilities as Markdown.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/work.md`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-projects",
        description: "Read portfolio projects and technical summaries as Markdown.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/project.md`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-blog",
        description: "Read the blog article list and summaries as Markdown.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/blog.md`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-stats",
        description: "Read public developer stats (coding, reading, leetcode) as Markdown.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/stats.md`,
          content_type: "text/markdown",
        },
      },
      {
        name: "get-structured-data",
        description:
          "Retrieve structured JSON metadata about this portfolio site and its owner.",
        endpoint: {
          method: "GET",
          url: `${baseUrl}/docs/api.json`,
          content_type: "application/json",
        },
      },
    ],
  };

  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
