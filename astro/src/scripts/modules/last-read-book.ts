import { isNewRead, LAST_READ_CACHE_KEY, parseKnownReviewIds, reviewIdOf } from "../../lib/last-read";
import { applyScriptLang } from "../../lib/script-lang";
import { isRecord } from "./guards";
import { showLastFinished } from "./last-finished-link";
// First slot on the home shelf: the last book read. The server renders the snapshot's
// newest book; a newer one seen on an earlier visit comes back from localStorage at once,
// and goodreads-loader hands over the live Goodreads response once the reader engages.
//
// Goodreads' widget order is unreliable for undated shelf entries, so its first book is
// only trusted when the snapshot has never seen it (a genuinely new read). The widget
// carries no read date, so a new book shows its "last read" tape without one until the
// next snapshot refresh dates it.

interface LastReadEntry {
  readonly reviewId: string;
  readonly href: string;
  readonly title: string;
  readonly imageSrc: string;
}

export interface LastReadSlot {
  readonly acceptLive: (sourceGrid: ParentNode) => void;
}

function readCache(): LastReadEntry | null {
  try {
    const entry: unknown = JSON.parse(window.localStorage.getItem(LAST_READ_CACHE_KEY) ?? "null");
    if (
      !isRecord(entry) ||
      typeof entry["reviewId"] !== "string" ||
      typeof entry["href"] !== "string" ||
      typeof entry["title"] !== "string" ||
      typeof entry["imageSrc"] !== "string"
    ) {
      return null;
    }
    return { reviewId: entry["reviewId"], href: entry["href"], title: entry["title"], imageSrc: entry["imageSrc"] };
  } catch {
    return null;
  }
}

function writeCache(entry: LastReadEntry | null): void {
  try {
    if (entry === null) {
      window.localStorage.removeItem(LAST_READ_CACHE_KEY);
    } else {
      window.localStorage.setItem(LAST_READ_CACHE_KEY, JSON.stringify(entry));
    }
  } catch {
    // Storage may be unavailable (private mode); the server-rendered book stays.
  }
}

export function setupLastReadSlot(widget: HTMLElement): LastReadSlot | null {
  const slot = widget.querySelector<HTMLElement>("[data-last-read]");
  const link = slot?.querySelector<HTMLAnchorElement>("a[href]");
  const image = link?.querySelector("img");
  if (!slot || !link || !image) {
    return null;
  }

  const knownReviewIds = parseKnownReviewIds(document.getElementById("goodreads-known-reviews")?.textContent);
  const dateStrip = slot.querySelector<HTMLElement>(".book-strip--date");
  const titleStrip = slot.querySelector<HTMLElement>(".book-strip--title");

  // The server-rendered book (the snapshot's newest), kept so a stale cached book can be undone.
  const serverReviewId = reviewIdOf(link.getAttribute("href"));
  const serverEntry = { href: link.href, title: link.title, imageSrc: image.src, alt: image.alt };
  const serverDateHidden = dateStrip?.hidden ?? true;

  const isNew = (reviewId: string | null): reviewId is string =>
    isNewRead(reviewId, link.getAttribute("href"), knownReviewIds);

  const show = (entry: LastReadEntry): void => {
    link.href = entry.href;
    link.title = entry.title;
    image.src = entry.imageSrc;
    image.alt = entry.title;
    if (titleStrip) {
      titleStrip.textContent = entry.title;
      applyScriptLang(titleStrip, entry.title);
    }
    // Only the snapshot knows read dates; a book newer than it has none to show yet.
    if (dateStrip) dateStrip.hidden = true;
    // The "These days" copy names the same book.
    showLastFinished(entry.href, entry.title);
  };

  // A cached book the snapshot has since caught up with is stale: the server render wins.
  const cached = readCache();
  if (cached !== null) {
    if (isNew(cached.reviewId)) {
      show(cached);
    } else if (knownReviewIds.has(cached.reviewId)) {
      writeCache(null);
    }
  }

  return {
    acceptLive(sourceGrid) {
      const first = sourceGrid.querySelector(".gr_grid_book_container a[href]");
      const liveImage = first?.querySelector("img");
      const reviewId = reviewIdOf(first?.getAttribute("href"));
      // Goodreads agrees with the snapshot, so a cached newer book is gone from the shelf:
      // put the server-rendered book back.
      if (reviewId !== null && reviewId === serverReviewId && reviewIdOf(link.getAttribute("href")) !== serverReviewId) {
        link.href = serverEntry.href;
        link.title = serverEntry.title;
        image.src = serverEntry.imageSrc;
        image.alt = serverEntry.alt;
        if (titleStrip) {
          titleStrip.textContent = serverEntry.title;
          applyScriptLang(titleStrip, serverEntry.title);
        }
        if (dateStrip) dateStrip.hidden = serverDateHidden;
        showLastFinished(serverEntry.href, serverEntry.title);
        writeCache(null);
        return;
      }
      if (!first || !liveImage || !isNew(reviewId)) {
        return;
      }
      const entry: LastReadEntry = {
        reviewId,
        href: first.getAttribute("href") ?? "",
        title: first.getAttribute("title") ?? liveImage.getAttribute("alt") ?? "",
        imageSrc: liveImage.getAttribute("src") ?? "",
      };
      if (entry.href.length === 0 || entry.imageSrc.length === 0) {
        return;
      }
      show(entry);
      writeCache(entry);
    },
  };
}
