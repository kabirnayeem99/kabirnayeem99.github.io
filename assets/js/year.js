// @ts-check
/**
 * Populates year and "last refreshed" values in the footer based on page language.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @typedef {"bn" | "ar" | "ur"} SupportedLocaleKey */

  var today = new Date();
  var lang = document.documentElement.lang || "en";

  /** @type {Record<SupportedLocaleKey, string>} */
  var localeMap = {
    bn: "bn-BD",
    ar: "ar-SA",
    ur: "ur-PK",
  };

  /** @type {string} */
  var locale = hasOwnLocale(localeMap, lang) ? localeMap[lang] : "en-US";

  /** @type {HTMLElement | null} */
  var yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = today.toLocaleDateString(locale, { year: "numeric" });
  }

  /**
   * Narrows arbitrary strings to supported locale-map keys.
   *
   * @param {Record<SupportedLocaleKey, string>} locales
   * @param {string} key
   * @returns {key is SupportedLocaleKey}
   */
  function hasOwnLocale(locales, key) {
    return Object.prototype.hasOwnProperty.call(locales, key);
  }
});
