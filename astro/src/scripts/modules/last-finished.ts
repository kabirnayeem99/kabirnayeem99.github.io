import { showLastFinished } from "./last-finished-link";
// Reading page, "Last finished": the server renders the snapshot's newest book. A newer one
// comes from Goodreads itself, two ways:
// - the home shelf caches the newest live book it has seen (same key as last-read-book.ts),
//   so a later visit here shows it at once;
// - when goodreads-loader swaps the live shelf into the page, its first book is used, but only
//   if the snapshot has never seen it (the widget's order is unreliable for known books).

const CACHE_KEY = "goodreads-last-read:v1";

const reviewIdOf = (href: string | null | undefined): string | null =>
  (typeof href === "string" ? /\/review\/show\/(\d+)/.exec(href)?.[1] : undefined) ?? null;


function knownReviewIds(): ReadonlySet<string> {
  try {
    const parsed = JSON.parse(document.getElementById("goodreads-known-reviews")?.textContent ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function cachedBook(): { reviewId: string; href: string; title: string } | null {
  try {
    const entry = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as
      | { reviewId?: unknown; href?: unknown; title?: unknown }
      | null;
    if (entry && typeof entry.reviewId === "string" && typeof entry.href === "string" && typeof entry.title === "string") {
      return { reviewId: entry.reviewId, href: entry.href, title: entry.title };
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
  const known = knownReviewIds();
  const isNewRead = (reviewId: string | null): boolean =>
    reviewId !== null && reviewId !== reviewIdOf(link.getAttribute("href")) && !known.has(reviewId);

  const cached = cachedBook();
  if (cached && isNewRead(cached.reviewId)) {
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
    if (!first || !href || !isNewRead(reviewId)) {
      return;
    }
    showLastFinished(href, first.getAttribute("title") ?? first.querySelector("img")?.getAttribute("alt") ?? link.textContent ?? "");
  });
  observer.observe(widget, { childList: true, subtree: true });
}

setup();
