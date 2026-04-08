import { assetHref } from "./work-project-content";

export const UMAMI_WEBSITE_ID = "cdec8895-be63-42d6-a490-12dd2ea8f35c";

const OG_IMAGE_PATH = "assets/images/og-card.png";
const STYLESHEET_PATH = "assets/css/styles.css";
const FAVICON_32_PATH = "assets/icons/favicon-32x32.png";
const FAVICON_16_PATH = "assets/icons/favicon-16x16.png";
const FAVICON_ICO_PATH = "assets/icons/favicon.ico";
const APPLE_TOUCH_ICON_PATH = "assets/icons/apple-touch-icon.png";
const MANIFEST_PATH = "site.webmanifest";
const SERVICE_WORKER_PATH = "service-worker.js";

export const PAGE_LAYOUT = {
  skipLinkClass: "skip-link",
  siteClass: "site",
  mainContentId: "main-content",
} as const;

export function buildOgImageUrl(baseUrl: string): string {
  return `${baseUrl}/${OG_IMAGE_PATH}`;
}

export interface PageAssetHrefs {
  readonly stylesheetHref: string;
  readonly favicon32Href: string;
  readonly favicon16Href: string;
  readonly faviconIcoHref: string;
  readonly appleTouchIconHref: string;
  readonly manifestHref: string;
  readonly swPath: string;
}

export function buildPageAssetHrefs(currentRoute: string): PageAssetHrefs {
  return {
    stylesheetHref: assetHref(currentRoute, STYLESHEET_PATH),
    favicon32Href: assetHref(currentRoute, FAVICON_32_PATH),
    favicon16Href: assetHref(currentRoute, FAVICON_16_PATH),
    faviconIcoHref: assetHref(currentRoute, FAVICON_ICO_PATH),
    appleTouchIconHref: assetHref(currentRoute, APPLE_TOUCH_ICON_PATH),
    manifestHref: assetHref(currentRoute, MANIFEST_PATH),
    swPath: assetHref(currentRoute, SERVICE_WORKER_PATH),
  };
}
