// Which book counts as "last read": the rules shared by the home shelf and the Reading page.

export const LAST_READ_CACHE_KEY = "goodreads-last-read:v1";

export const reviewIdOf = (href: string | null | undefined): string | null =>
  (typeof href === "string" ? /\/review\/show\/(\d+)/.exec(href)?.[1] : undefined) ?? null;

/** The review ids the server wrote into the page (a JSON array); empty if unreadable. */
export function parseKnownReviewIds(json: string | null | undefined): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(json ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Goodreads' widget order is unreliable for books the snapshot knows, so a live or cached
 * book replaces the one showing only when the snapshot has never seen it.
 */
export function isNewRead(
  reviewId: string | null,
  shownHref: string | null | undefined,
  knownIds: ReadonlySet<string>,
): reviewId is string {
  return reviewId !== null && reviewId !== reviewIdOf(shownHref) && !knownIds.has(reviewId);
}
