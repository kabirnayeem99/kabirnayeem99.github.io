import { isProductionHostMatch, readExpectedSiteHostname } from "../../lib/runtime-host-gating";

type UmamiPayload = Record<string, string>;

interface UmamiApi {
  track: (eventName: string, eventData?: UmamiPayload) => void;
}

interface SiteThemeChangeDetail {
  readonly theme?: "light" | "dark";
}

declare global {
  interface Window {
    umami?: UmamiApi;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const expectedHostname = readExpectedSiteHostname();
  const trackingHostAllowed = isProductionHostMatch(expectedHostname, window.location.hostname);

  const getUmami = (): UmamiApi | null => {
    if (!window.umami || typeof window.umami.track !== "function") {
      return null;
    }

    return window.umami;
  };

  const track = (eventName: string, payload: UmamiPayload): void => {
    if (!trackingHostAllowed) {
      return;
    }

    const umami = getUmami();
    if (umami === null) {
      return;
    }

    umami.track(eventName, payload);
  };

  const textOrUnknown = (value: string | null | undefined): string => {
    if (typeof value !== "string") {
      return "unknown";
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "unknown";
  };

  const statsSectionName = (section: HTMLElement): string => {
    const title = section.querySelector<HTMLElement>(".section-title");
    return textOrUnknown(title?.textContent ?? null);
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const navLink = event.target.closest<HTMLAnchorElement>("a[data-nav-page-id]");
    if (navLink instanceof HTMLAnchorElement) {
      const navPage = navLink.dataset.navPageId;
      if (navPage === "work" || navPage === "project" || navPage === "stats") {
        track("nav-click", { page: navPage, source: navLink.dataset.navSource ?? "nav" });
      }
    }

    const articleLink = event.target.closest<HTMLAnchorElement>('a[data-umami-track-article="true"]');
    if (articleLink instanceof HTMLAnchorElement) {
      track("article-click", {
        href: textOrUnknown(articleLink.getAttribute("href")),
        title: textOrUnknown(articleLink.textContent),
      });
    }

    const socialLink = event.target.closest<HTMLAnchorElement>('a[data-umami-track-social="true"]');
    if (socialLink instanceof HTMLAnchorElement) {
      track("social-click", {
        platform: textOrUnknown(socialLink.dataset.socialPlatform),
        href: textOrUnknown(socialLink.getAttribute("href")),
      });
    }

    const bookLink = event.target.closest<HTMLAnchorElement>('a[data-umami-track-book="true"]');
    if (bookLink instanceof HTMLAnchorElement) {
      track("book-click", {
        title: textOrUnknown(
          bookLink.getAttribute("title") ??
            bookLink.querySelector(".book-catalogue-title")?.textContent ??
            bookLink.textContent,
        ),
        href: textOrUnknown(bookLink.getAttribute("href")),
      });
    }

    const languageLink = event.target.closest<HTMLAnchorElement>("[data-language-switcher-menu] a[lang]");
    if (languageLink instanceof HTMLAnchorElement) {
      track("language-change", {
        from: textOrUnknown(document.documentElement.lang),
        to: textOrUnknown(languageLink.getAttribute("lang")),
      });
    }

    const pageId = document.body?.getAttribute("data-page-id");
    if (pageId !== "stats") {
      return;
    }

    const interactive = event.target.closest<HTMLElement>("a, button");
    if (!(interactive instanceof HTMLElement)) {
      return;
    }

    const section = interactive.closest<HTMLElement>("main section");
    if (!(section instanceof HTMLElement)) {
      return;
    }

    const sectionName = statsSectionName(section);
    if (sectionName === "unknown") {
      return;
    }

    track("stats-section-click", {
      section: sectionName,
      target: interactive.tagName.toLowerCase(),
    });
  });

  document.addEventListener("site-theme-change", (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const detail = (event as CustomEvent<SiteThemeChangeDetail>).detail;
    const theme = detail?.theme === "light" || detail?.theme === "dark" ? detail.theme : "unknown";

    track("theme-change", { to: theme });
  });

  const viewTargets = document.querySelectorAll<HTMLElement>("[data-umami-track-view]");
  if (viewTargets.length > 0 && "IntersectionObserver" in window) {
    const seenSections = new Set<string>();

    const sectionObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const target = entry.target;
          if (!(target instanceof HTMLElement)) {
            continue;
          }

          const sectionName = target.dataset.umamiTrackView;
          if (sectionName === undefined || seenSections.has(sectionName)) {
            continue;
          }

          seenSections.add(sectionName);
          track("section-view", { section: sectionName });
          observer.unobserve(target);

          if (seenSections.size >= viewTargets.length) {
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );

    for (const target of viewTargets) {
      sectionObserver.observe(target);
    }
  }
});
