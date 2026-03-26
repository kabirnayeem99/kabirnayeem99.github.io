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

  applyThemeToEmbeds(currentTheme());

  document.addEventListener("site-theme-change", function (event) {
    var nextTheme = currentTheme();
    if (event instanceof CustomEvent) {
      var detailTheme = event.detail && event.detail.theme;
      if (detailTheme === "light" || detailTheme === "dark") {
        nextTheme = detailTheme;
      }
    }

    applyThemeToEmbeds(nextTheme);
  });
});
