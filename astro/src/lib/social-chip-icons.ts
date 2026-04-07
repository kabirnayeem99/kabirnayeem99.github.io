export type SocialPlatform = "github" | "linkedin" | "medium" | "leetcode";

export type SocialChipIconName = "email" | SocialPlatform;

export const SOCIAL_CHIP_ICON_CLASS_BY_NAME: Readonly<Record<SocialChipIconName, string>> = {
  email: "social-chip-icon--email",
  github: "social-chip-icon--github",
  linkedin: "social-chip-icon--linkedin",
  medium: "social-chip-icon--medium",
  leetcode: "social-chip-icon--leetcode",
};

export const SOCIAL_CHIP_LABEL_BY_PLATFORM: Readonly<Record<SocialPlatform, string>> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  medium: "Medium",
  leetcode: "LeetCode",
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
