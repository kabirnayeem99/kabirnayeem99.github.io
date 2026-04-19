import {
  AGENT_DISCOVERY_LINKS,
  type AgentDiscoveryLink,
  toAbsoluteDiscoveryHref,
} from "../../lib/agent-discovery";
import { buildSeoFileContext } from "../../lib/seo-files";

interface DiscoveryResource {
  readonly rel: AgentDiscoveryLink["rel"];
  readonly href: string;
  readonly type?: string;
  readonly title?: string;
}

function toDiscoveryResource(
  baseUrl: string,
  link: AgentDiscoveryLink,
): DiscoveryResource {
  const resource: {
    rel: AgentDiscoveryLink["rel"];
    href: string;
    type?: string;
    title?: string;
  } = {
    rel: link.rel,
    href: toAbsoluteDiscoveryHref(baseUrl, link.href),
  };

  if (link.type !== undefined) {
    resource.type = link.type;
  }
  if (link.title !== undefined) {
    resource.title = link.title;
  }

  return resource;
}

export function GET(): Response {
  const { baseUrl } = buildSeoFileContext();
  const resources = AGENT_DISCOVERY_LINKS.map((link) =>
    toDiscoveryResource(baseUrl, link),
  );

  const body = {
    service: {
      name: "Kabir Nayeem Portfolio",
      homepage: `${baseUrl}/`,
      deployment: "Astro static site on GitHub Pages",
      interactionModel: "Read-only website resources",
    },
    discovery: resources,
    endpoints: [
      {
        href: `${baseUrl}/robots.txt`,
        purpose: "Crawler policy and sitemap location",
        type: "text/plain",
      },
      {
        href: `${baseUrl}/sitemap.xml`,
        purpose: "Canonical page URL inventory",
        type: "application/xml",
      },
    ],
  };

  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
