// @ts-check
/**
 * Keep theme-sensitive remote stats embeds aligned with the active site theme.
 */
document.addEventListener("DOMContentLoaded", function () {
  /**
   * @returns {"light" | "dark"}
   */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  /**
   * @param {"light" | "dark"} theme
   * @returns {void}
   */
  function applyThemeToEmbeds(theme) {
    /** @type {NodeListOf<HTMLImageElement>} */
    var images = document.querySelectorAll("img[data-theme-light-src][data-theme-dark-src]");
    var sourceKey = theme === "dark" ? "themeDarkSrc" : "themeLightSrc";

    images.forEach(function (image) {
      var nextSource = image.dataset[sourceKey];
      if (typeof nextSource !== "string" || nextSource.length === 0 || image.src === nextSource) {
        return;
      }

      image.src = nextSource;
    });
  }

  /**
   * @param {"light" | "dark"} theme
   * @returns {void}
   */
  function applyThemeToEmbedLinks(theme) {
    /** @type {NodeListOf<HTMLAnchorElement>} */
    var links = document.querySelectorAll("a[data-theme-light-href][data-theme-dark-href]");
    var hrefKey = theme === "dark" ? "themeDarkHref" : "themeLightHref";

    links.forEach(function (link) {
      var nextHref = link.dataset[hrefKey];
      if (typeof nextHref !== "string" || nextHref.length === 0) {
        return;
      }

      if (link.getAttribute("href") === nextHref) {
        return;
      }

      link.setAttribute("href", nextHref);
    });
  }

  applyThemeToEmbeds(currentTheme());
  applyThemeToEmbedLinks(currentTheme());

  document.addEventListener("site-theme-change", function (event) {
    var nextTheme = currentTheme();
    if (event instanceof CustomEvent) {
      var detailTheme = event.detail && event.detail.theme;
      if (detailTheme === "light" || detailTheme === "dark") {
        nextTheme = detailTheme;
      }
    }

    applyThemeToEmbeds(nextTheme);
    applyThemeToEmbedLinks(nextTheme);
  });
});
