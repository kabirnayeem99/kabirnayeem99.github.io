import {
  AGENT_DISCOVERY_LINKS,
  toAbsoluteDiscoveryHref,
} from "../../lib/agent-discovery";
import { buildSeoFileContext } from "../../lib/seo-files";

function toLinksetItem(baseUrl, link) {
  const item = {
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

export function GET() {
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
