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
  var cookiePrefix = storageKey + "=";
  var windowNamePrefix = storageKey + "=";

  /**
   * @returns {"light" | "dark" | null}
   */
  function readCookieTheme() {
    var cookies = document.cookie ? document.cookie.split("; ") : [];

    for (var index = 0; index < cookies.length; index += 1) {
      var entry = cookies[index];
      if (entry.indexOf(cookiePrefix) !== 0) {
        continue;
      }

      var value = entry.slice(cookiePrefix.length);
      if (value === "light" || value === "dark") {
        return value;
      }
    }

    return null;
  }

  /**
   * @param {"light" | "dark"} theme
   * @returns {void}
   */
  function persistTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (_error) {
      // Ignore storage failures and keep the cookie fallback.
    }

    document.cookie =
      storageKey + "=" + theme + "; Path=/; Max-Age=31536000; SameSite=Lax";
    window.name = windowNamePrefix + theme;
  }

  /**
   * @returns {"light" | "dark" | null}
   */
  function readWindowNameTheme() {
    if (window.name.indexOf(windowNamePrefix) !== 0) {
      return null;
    }

    var value = window.name.slice(windowNamePrefix.length);
    if (value === "light" || value === "dark") {
      return value;
    }

    return null;
  }

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
    document.dispatchEvent(new CustomEvent("site-theme-change", { detail: { theme: theme } }));
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

  var storedTheme = readWindowNameTheme();
  var cookieTheme = readCookieTheme();
  if (cookieTheme === "light" || cookieTheme === "dark") {
    storedTheme = cookieTheme;
  }
  try {
    var localTheme = window.localStorage.getItem(storageKey);
    if (localTheme === "light" || localTheme === "dark") {
      storedTheme = localTheme;
    }
  } catch (_error) {
    // Ignore storage failures and keep the cookie fallback.
  }

  applyTheme(storedTheme === "dark" ? "dark" : currentTheme());
  persistTheme(currentTheme());

  button.addEventListener("click", function () {
    var nextTheme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  });
});
