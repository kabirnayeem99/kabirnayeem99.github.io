import { isNewRead, LAST_READ_CACHE_KEY, parseKnownReviewIds, reviewIdOf } from "../../lib/last-read";
import { isRecord, hasText } from "./guards";
import { showLastFinished } from "./last-finished-link";
// Reading page, "Last finished": the server renders the snapshot's newest book. A newer one
// comes from Goodreads itself, two ways:
// - the home shelf caches the newest live book it has seen (same key as last-read-book.ts),
//   so a later visit here shows it at once;
// - when goodreads-loader swaps the live shelf into the page, its first book is used, but only
//   if the snapshot has never seen it (the widget's order is unreliable for known books).

function cachedBook(): { reviewId: string; href: string; title: string } | null {
  try {
    const entry: unknown = JSON.parse(window.localStorage.getItem(LAST_READ_CACHE_KEY) ?? "null");
    if (isRecord(entry) && typeof entry["reviewId"] === "string" && typeof entry["href"] === "string" && typeof entry["title"] === "string") {
      return { reviewId: entry["reviewId"], href: entry["href"], title: entry["title"] };
    }
  } catch {
    // Storage unavailable: the server-rendered book stays.
  }
  return null;
}

function setup(): void {
  const link = document.querySelector<HTMLAnchorElement>("[data-last-finished]");
  if (!link) {
    return;
  }
  const known = parseKnownReviewIds(document.getElementById("goodreads-known-reviews")?.textContent);
  const isNew = (reviewId: string | null): boolean => isNewRead(reviewId, link.getAttribute("href"), known);

  const cached = cachedBook();
  if (cached && isNew(cached.reviewId)) {
    showLastFinished(cached.href, cached.title);
  }

  const widget = document.querySelector<HTMLElement>(".goodreads-widget");
  if (!widget) {
    return;
  }
  const observer = new MutationObserver(() => {
    const first = widget.querySelector<HTMLAnchorElement>(".gr_grid_book_container a[href]");
    const href = first?.getAttribute("href");
    const reviewId = reviewIdOf(href);
    if (!first || !hasText(href) || !isNew(reviewId)) {
      return;
    }
    showLastFinished(href, first.getAttribute("title") ?? first.querySelector("img")?.getAttribute("alt") ?? link.textContent);
  });
  observer.observe(widget, { childList: true, subtree: true });
}

setup();
