export type AgentDiscoveryRelation =
  | "api-catalog"
  | "service-desc"
  | "service-doc"
  | "describedby"
  | "alternate";

export interface AgentDiscoveryLink {
  readonly rel: AgentDiscoveryRelation;
  readonly href: `/${string}`;
  readonly type?: string;
  readonly title?: string;
}

export const AGENT_DISCOVERY_LINKS = [
  {
    rel: "api-catalog",
    href: "/.well-known/api-catalog",
    type: "application/linkset+json",
    title: "API catalog (Linkset)",
  },
  {
    rel: "service-desc",
    href: "/docs/api.json",
    type: "application/json",
    title: "Service descriptor (JSON)",
  },
  {
    rel: "service-doc",
    href: "/docs/api",
    type: "text/html",
    title: "Service documentation",
  },
  {
    rel: "describedby",
    href: "/sitemap.xml",
    type: "application/xml",
    title: "Sitemap",
  },
  {
    rel: "alternate",
    href: "/index.md",
    type: "text/markdown",
    title: "Homepage markdown mirror",
  },
  {
    rel: "alternate",
    href: "/work.md",
    type: "text/markdown",
    title: "Work page markdown mirror",
  },
  {
    rel: "alternate",
    href: "/project.md",
    type: "text/markdown",
    title: "Project page markdown mirror",
  },
  {
    rel: "alternate",
    href: "/blog.md",
    type: "text/markdown",
    title: "Blog page markdown mirror",
  },
  {
    rel: "alternate",
    href: "/stats.md",
    type: "text/markdown",
    title: "Stats page markdown mirror",
  },
] as const satisfies readonly AgentDiscoveryLink[];

function stripTrailingSlash(input: string): string {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

export function toAbsoluteDiscoveryHref(
  baseUrl: string,
  href: `/${string}`,
): string {
  return `${stripTrailingSlash(baseUrl)}${href}`;
}
