import navigationJson from "../data/site-content/navigation.json";
import navigationLabelsJson from "../data/site-content/navigation-labels.json";
import routesJson from "../data/site-content/routes.json";
import { navigationLabelsSchema, navigationSchema, routesSchema } from "./content-schema.ts";
import { ALL_PAGE_IDS, LANGS, type AnyPageId, type Lang } from "./locale-config";
import { routeHref } from "./work-project-content";

export type PageId = AnyPageId;

const navigation = navigationSchema.parse(navigationJson);
const navigationLabels = navigationLabelsSchema.parse(navigationLabelsJson);
const routes = routesSchema.parse(routesJson);

export interface MainNavItem {
  readonly pageId: PageId;
  readonly label: string;
  readonly href: string;
  readonly isCurrent: boolean;
}

/** Detect the active locale from a page's own route (e.g. "bn/work.html" -> "bn"). */
function detectLang(currentRoute: string): Lang {
  return LANGS.find((lang) => ALL_PAGE_IDS.some((pageId) => routes[pageId][lang] === currentRoute)) ?? "en";
}

/**
 * Build the main page navigation for the locale inferred from `currentRoute`.
 * Hrefs are made relative to `currentRoute`; the matching page is flagged current.
 */
export function buildMainNav(currentRoute: string): readonly MainNavItem[] {
  const lang = detectLang(currentRoute);
  return navigation[lang].map((pageId) => {
    const target = routes[pageId][lang];
    return {
      pageId,
      label: navigationLabels[pageId][lang],
      href: routeHref(currentRoute, target),
      isCurrent: target === currentRoute,
    };
  });
}
