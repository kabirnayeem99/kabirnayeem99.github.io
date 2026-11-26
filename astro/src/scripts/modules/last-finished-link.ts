import { withoutSeries } from "../../lib/book-title";
import { applyScriptLang } from "../../lib/script-lang";

/** Points every "last finished" mention on the page at the given book. */
export function showLastFinished(href: string, title: string): void {
  const clean = withoutSeries(title);
  if (href.length === 0 || clean.length === 0) {
    return;
  }
  document.querySelectorAll<HTMLAnchorElement>("a[data-last-finished]").forEach((link) => {
    link.href = href;
    link.textContent = clean;
    applyScriptLang(link, clean);
  });
}
