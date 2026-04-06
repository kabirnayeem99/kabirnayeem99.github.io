// @ts-check
/**
 * Explicit light/dark theme control with cross-page persistence.
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
   * @param {"light" | "dark"} theme
   * @returns {void}
   */
  function persistTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (_error) {
      // Ignore storage failures and keep current in-memory theme.
    }
  }

  /**
   * @returns {"light" | "dark"}
   */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  /**
   * @param {"light" | "dark"} theme
   * @param {boolean} emitEvent
   * @returns {void}
   */
  function applyTheme(theme, emitEvent) {
    var isDark = theme === "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (emitEvent) {
      document.dispatchEvent(new CustomEvent("site-theme-change", { detail: { theme: theme } }));
    }
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

  /** @type {"light" | "dark" | null} */
  var storedTheme = null;
  try {
    var localTheme = window.localStorage.getItem(storageKey);
    if (localTheme === "light" || localTheme === "dark") {
      storedTheme = localTheme;
    }
  } catch (_error) {
    // Ignore storage failures and keep default theme from the bootstrap script.
  }

  applyTheme(storedTheme === "dark" ? "dark" : currentTheme(), false);

  button.addEventListener("click", function () {
    var nextTheme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    persistTheme(nextTheme);
  });
});
