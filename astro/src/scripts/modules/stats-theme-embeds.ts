import { toRecord } from "./guards";

type Theme = "light" | "dark";

document.addEventListener("DOMContentLoaded", () => {
  const currentTheme = (): Theme => (
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  const applyThemeToEmbeds = (theme: Theme): void => {
    const images = document.querySelectorAll<HTMLImageElement>(
      "img[data-theme-light-src][data-theme-dark-src]",
    );
    const sourceKey = theme === "dark" ? "themeDarkSrc" : "themeLightSrc";

    images.forEach((image) => {
      const nextSource = image.dataset[sourceKey];
      if (typeof nextSource !== "string" || nextSource.length === 0 || image.src === nextSource) {
        return;
      }

      image.src = nextSource;
    });
  };

  const applyThemeToEmbedLinks = (theme: Theme): void => {
    const links = document.querySelectorAll<HTMLAnchorElement>(
      "a[data-theme-light-href][data-theme-dark-href]",
    );
    const hrefKey = theme === "dark" ? "themeDarkHref" : "themeLightHref";

    links.forEach((link) => {
      const nextHref = link.dataset[hrefKey];
      if (typeof nextHref !== "string" || nextHref.length === 0) {
        return;
      }

      if (link.getAttribute("href") === nextHref) {
        return;
      }

      link.setAttribute("href", nextHref);
    });
  };

  const applyThemeUpdates = (theme: Theme): void => {
    applyThemeToEmbeds(theme);
    applyThemeToEmbedLinks(theme);
  };

  applyThemeUpdates(currentTheme());

  document.addEventListener("site-theme-change", (event: Event) => {
    if (event instanceof CustomEvent) {
      const { theme } = toRecord(event.detail);
      if (theme === "light" || theme === "dark") {
        applyThemeUpdates(theme);
        return;
      }
    }

    applyThemeUpdates(currentTheme());
  });
});
