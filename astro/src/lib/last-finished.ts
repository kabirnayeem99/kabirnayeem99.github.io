import goodreadsSnapshot from "../data/site-content/goodreads-snapshot.json" with { type: "json" };
import { withoutSeries } from "./book-title.ts";
import { scriptLang } from "./script-lang.ts";

// Page copy writes <last-finished/> where it names the last book finished. It is filled from
// the snapshot's newest book, the same one the home shelf marks "Last read" and the Reading
// page calls "Last finished" (scripts/modules/last-finished-link.ts updates all of them).
// A tag, so the Latin-script transliteration of the ar/ur content leaves it alone.
const PLACEHOLDER = /<last-finished\s*\/>/g;

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function fillLastFinished(
  html: string,
  book: { readonly href: string; readonly title: string } | undefined,
): string {
  return html.replace(PLACEHOLDER, () => {
    if (!book) {
      throw new Error("goodreads-snapshot.json has no books to fill <last-finished/>");
    }
    const title = withoutSeries(book.title);
    const lang = scriptLang(title);
    return (
      `<a href="${escapeHtml(book.href)}" target="_blank" rel="nofollow noreferrer" dir="auto"` +
      `${lang === undefined ? "" : ` lang="${lang}"`} data-last-finished>${escapeHtml(title)}</a>`
    );
  });
}

export const withLastFinished = (html: string): string => fillLastFinished(html, goodreadsSnapshot.books[0]);
