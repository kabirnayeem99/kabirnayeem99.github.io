import {
  AGENT_DISCOVERY_LINKS,
  toAbsoluteDiscoveryHref,
  type AgentDiscoveryLink,
} from "../../lib/agent-discovery";
import { buildSeoFileContext } from "../../lib/seo-files";

interface LinksetItem {
  href: string;
  rel: AgentDiscoveryLink["rel"];
  type?: string;
  title?: string;
}

function toLinksetItem(baseUrl: string, link: AgentDiscoveryLink): LinksetItem {
  const item: LinksetItem = {
    href: toAbsoluteDiscoveryHref(baseUrl, link.href),
    rel: link.rel,
  };

  if (link.type !== undefined) {
    item.type = link.type;
  }
  if (link.title !== undefined) {
    item.title = link.title;
  }

  return item;
}

export function GET(): Response {
  const { baseUrl } = buildSeoFileContext();
  const linkHeader = AGENT_DISCOVERY_LINKS.map(
    (link) => `<${link.href}>; rel="${link.rel}"`,
  ).join(", ");

  const body = {
    linkset: [
      {
        anchor: `${baseUrl}/`,
        item: AGENT_DISCOVERY_LINKS.map((link) => toLinksetItem(baseUrl, link)),
      },
    ],
  };

  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      Link: linkHeader,
    },
  });
}
