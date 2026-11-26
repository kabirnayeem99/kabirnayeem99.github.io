import type { IconName } from "./icons";

export type SocialPlatform = "github" | "linkedin" | "medium" | "leetcode";

export type SocialChipIconName = "email" | SocialPlatform;

/** null: Simple Icons does not carry the brand, so the link shows its name only. */
export const SOCIAL_CHIP_ICON_BY_NAME: Readonly<
  Record<SocialChipIconName, IconName | null>
> = {
  email: "mail",
  github: "github",
  linkedin: null,
  medium: "medium",
  leetcode: "leetcode",
};

function parseHostname(href: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(href);
  } catch {
    throw new Error(`Invalid social profile URL: ${href}`);
  }
  return parsedUrl.hostname.toLowerCase();
}

export function resolveSocialPlatformFromHref(href: string): SocialPlatform {
  const hostname = parseHostname(href);
  if (hostname === "github.com") {
    return "github";
  }
  if (hostname === "linkedin.com" || hostname === "www.linkedin.com") {
    return "linkedin";
  }
  if (hostname === "medium.com" || hostname.endsWith(".medium.com")) {
    return "medium";
  }
  if (hostname === "leetcode.com" || hostname === "www.leetcode.com") {
    return "leetcode";
  }
  throw new Error(`Unsupported social profile hostname: ${hostname}`);
}
