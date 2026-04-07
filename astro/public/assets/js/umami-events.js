// @ts-check
/**
 * Umami interaction tracking for navigation, theme, language, articles, and
 * stats section engagement.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @typedef {{ track: (eventName: string, eventData?: Record<string, string>) => void }} UmamiApi */
  /** @typedef {Window & { umami?: UmamiApi }} UmamiWindow */

  /**
   * @returns {UmamiApi | null}
   */
  function getUmami() {
    var root = /** @type {UmamiWindow} */ (window);
    if (!root.umami || typeof root.umami.track !== "function") {
      return null;
    }
    return root.umami;
  }

  /**
   * @param {string} eventName
   * @param {Record<string, string>} payload
   * @returns {void}
   */
  function track(eventName, payload) {
    var umami = getUmami();
    if (umami === null) {
      return;
    }
    umami.track(eventName, payload);
  }

  /**
   * @param {string | null} value
   * @returns {string}
   */
  function textOrUnknown(value) {
    if (typeof value !== "string") {
      return "unknown";
    }
    var trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "unknown";
  }

  /**
   * @param {HTMLElement} section
   * @returns {string}
   */
  function statsSectionName(section) {
    /** @type {HTMLElement | null} */
    var title = /** @type {HTMLElement | null} */ (section.querySelector(".section-title"));
    return textOrUnknown(title ? title.textContent : null);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    /** @type {HTMLAnchorElement | null} */
    var navLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[data-nav-page-id]'));
    if (navLink instanceof HTMLAnchorElement) {
      var navPage = navLink.dataset.navPageId;
      if (navPage === "work" || navPage === "project" || navPage === "stats") {
        track("nav-click", { page: navPage });
      }
    }

    /** @type {HTMLAnchorElement | null} */
    var articleLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[data-umami-track-article="true"]'));
    if (articleLink instanceof HTMLAnchorElement) {
      track("article-click", {
        href: textOrUnknown(articleLink.getAttribute("href")),
        title: textOrUnknown(articleLink.textContent),
      });
    }

    /** @type {HTMLAnchorElement | null} */
    var languageLink = /** @type {HTMLAnchorElement | null} */ (target.closest("[data-language-switcher-menu] a[lang]"));
    if (languageLink instanceof HTMLAnchorElement) {
      track("language-change", {
        from: textOrUnknown(document.documentElement.lang),
        to: textOrUnknown(languageLink.getAttribute("lang")),
      });
    }

    var pageId = document.body.getAttribute("data-page-id");
    if (pageId === "stats") {
      /** @type {HTMLElement | null} */
      var interactive = /** @type {HTMLElement | null} */ (target.closest("a, button"));
      if (!(interactive instanceof HTMLElement)) {
        return;
      }

      /** @type {HTMLElement | null} */
      var section = /** @type {HTMLElement | null} */ (interactive.closest("main section"));
      if (!(section instanceof HTMLElement)) {
        return;
      }

      var sectionName = statsSectionName(section);
      if (sectionName === "unknown") {
        return;
      }

      track("stats-section-click", {
        section: sectionName,
        target: interactive.tagName.toLowerCase(),
      });
    }
  });

  document.addEventListener("site-theme-change", function (event) {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    var detail = event.detail;
    var theme = detail && (detail.theme === "light" || detail.theme === "dark") ? detail.theme : "unknown";
    track("theme-change", { to: theme });
  });
});
