// Runs inline in <head> before the first paint, so the right theme is there from the start.
// A stored toggle choice wins; without one the page follows the OS, live changes included.
// Compiled to ES5 by scripts/compile-script.ts, hence `var` and plain functions.
// The two theme-color values are --bg of each theme in src/styles/foundation/tokens.css.
import type { Theme } from "./theme-api.ts";

var key = "person-portfolio-theme";
var root = document.documentElement;
var media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
// The choice made on this page, for browsers where storage is unavailable.
var picked: Theme | null = null;

function stored(): Theme | null {
  try {
    var saved = window.localStorage.getItem(key);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Storage is blocked.
  }
  return null;
}

// Sets the theme, and tells the page's scripts when it differs from the one showing.
function apply(theme: Theme, source: "system" | "toggle"): void {
  var previous = root.getAttribute("data-theme");
  root.setAttribute("data-theme", theme);
  var metas = document.querySelectorAll("meta[name='theme-color']");
  for (var i = 0; i < metas.length; i++) {
    metas[i]?.setAttribute("content", theme === "dark" ? "#12100d" : "#faf8f3");
  }
  if (previous !== null && previous !== "" && previous !== theme) {
    document.dispatchEvent(new CustomEvent("site-theme-change", { detail: { theme: theme, source: source } }));
  }
}

function sync(): void {
  apply(stored() ?? picked ?? (media?.matches === true ? "dark" : "light"), "system");
}

function choose(theme: Theme): void {
  picked = theme;
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    // Storage is blocked: the choice lasts for this page.
  }
  apply(theme, "toggle");
}

window.personPortfolioTheme = { sync: sync, choose: choose };
sync();
if (media !== null && typeof media.addEventListener === "function") {
  media.addEventListener("change", sync);
}
