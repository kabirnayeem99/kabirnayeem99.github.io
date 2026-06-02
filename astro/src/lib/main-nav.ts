import navigation from "../data/site-content/navigation.json";
import navigationLabels from "../data/site-content/navigation-labels.json";
import routes from "../data/site-content/routes.json";
import { routeHref } from "./work-project-content";

type Lang = "en" | "bn" | "ar" | "ur";
type PageId = keyof typeof routes;

const LANGS: readonly Lang[] = ["en", "bn", "ar", "ur"];

export interface MainNavItem {
  readonly label: string;
  readonly href: string;
  readonly isCurrent: boolean;
}

/** Detect the active locale from a page's own route (e.g. "bn/work.html" -> "bn"). */
function detectLang(currentRoute: string): Lang {
  for (const lang of LANGS) {
    for (const pageId of Object.keys(routes) as PageId[]) {
      if ((routes as Record<PageId, Record<Lang, string>>)[pageId][lang] === currentRoute) {
        return lang;
      }
    }
  }
  return "en";
}

/**
 * Build the main page navigation for the locale inferred from `currentRoute`.
 * Hrefs are made relative to `currentRoute`; the matching page is flagged current.
 */
export function buildMainNav(currentRoute: string): readonly MainNavItem[] {
  const lang = detectLang(currentRoute);
  const order = (navigation as Record<Lang, PageId[]>)[lang];
  return order.map((pageId) => {
    const target = (routes as Record<PageId, Record<Lang, string>>)[pageId][lang];
    return {
      label: (navigationLabels as Record<PageId, Record<Lang, string>>)[pageId][lang],
      href: routeHref(currentRoute, target),
      isCurrent: target === currentRoute,
    };
  });
}
