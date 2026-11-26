import type { IndexPageContent } from "./index-content";
import { resolveSocialPlatformFromHref, type SocialChipIconName } from "./social-chip-icons";

// Email and social profiles: in the sidebar on wide screens, in the footer on phones.
export interface ContactLink {
  readonly href: string;
  readonly label: string;
  readonly icon: SocialChipIconName;
  readonly external: boolean;
}

export function buildContactLinks(content: IndexPageContent): readonly ContactLink[] {
  return [
    ...content.topActions
      .filter((action) => action.href?.startsWith("mailto:") === true)
      .map((action) => ({
        href: action.href ?? "",
        label: action.label.replace(/^✉\s*/, ""),
        icon: "email" as const,
        external: false,
      })),
    ...content.site.socialProfiles.map((href) => {
      const platform = resolveSocialPlatformFromHref(href);
      return { href, label: content.site.locale.socialPlatformLabels[platform], icon: platform, external: true };
    }),
  ];
}
