// @ts-check
/**
 * Explicit light/dark theme control with localStorage persistence.
 *
 * The site defaults to light mode. Dark mode is applied only when the user
 * explicitly selects it.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @type {HTMLButtonElement | null} */
  var candidateButton = /** @type {HTMLButtonElement | null} */ (
    document.querySelector("[data-theme-toggle]")
  );
  if (!(candidateButton instanceof HTMLButtonElement)) {
    return;
  }

  /** @type {HTMLButtonElement} */
  var button = candidateButton;
  /** @type {HTMLElement | null} */
  var icon = /** @type {HTMLElement | null} */ (button.querySelector("[data-theme-toggle-icon]"));
  var storageKey = "person-portfolio-theme";

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
  function applyTheme(theme) {
    var isDark = theme === "dark";
    document.documentElement.setAttribute("data-theme", theme);
    button.setAttribute("aria-pressed", String(isDark));

    var nextLabel = isDark ? button.dataset.lightLabel : button.dataset.darkLabel;
    if (typeof nextLabel === "string" && nextLabel) {
      button.setAttribute("aria-label", nextLabel);
      button.title = nextLabel;
    }

    if (icon) {
      icon.textContent = isDark ? "☀" : "☾";
    }
  }

  applyTheme(currentTheme());

  button.addEventListener("click", function () {
    var nextTheme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch (_error) {
      // Ignore storage failures and keep the session theme only in memory.
    }
  });
});
