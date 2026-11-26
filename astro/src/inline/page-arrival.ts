// On arrival through a page transition or Back/Forward: re-read the theme (a page prerendered
// or cached before a theme toggle would show the old one). Inline in <head>, compiled to ES5.
import type {} from "./theme-api.ts";

function sync(): void {
  window.personPortfolioTheme?.sync();
}

addEventListener("pagereveal", sync);
addEventListener("pageshow", sync);
