import type { Lang } from "./locale-config";
import type { BotanicalName } from "./botanicals";

// Gregorian calendar everywhere: the Arabic default (ar-SA) would switch to Hijri dates.
const READ_DATE_LOCALE: Readonly<Record<Lang, string>> = {
  en: "en-GB",
  bn: "bn-BD",
  ar: "ar-u-ca-gregory",
  ur: "ur-PK",
};

/** Short, hand-writable date for the tape strip above a book cover ("6 Oct 2026"). */
export function formatReadDate(iso: string | undefined, lang: Lang): string | undefined {
  if (typeof iso !== "string" || iso.length === 0) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(READ_DATE_LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Date written in the margin beside the "Right now" entry. */
export function formatMarginDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(READ_DATE_LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export interface ClippingMast {
  readonly publication: string;
  readonly topic: string | undefined;
}

/** Newspaper nameplate for a blog clipping: "Medium · career" → Medium / career. */
export function clippingMast(href: string, meta?: string): ClippingMast {
  if (typeof meta === "string" && meta.trim().length > 0) {
    const [publication = "", ...rest] = meta.split("·").map((part) => part.trim());
    const topic = rest.join(" · ");
    return { publication, topic: topic.length > 0 ? topic : undefined };
  }
  let host = "";
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    host = "";
  }
  const publication = host === "medium.com" || host.endsWith(".medium.com") ? "Medium" : host.replace(/^www\./, "");
  return { publication, topic: undefined };
}

/** Kicker above the name on the home masthead. */
export const MASTHEAD_KICKER: Readonly<Record<Lang, string>> = {
  en: "this notebook belongs to —",
  bn: "এই খাতাটি যার —",
  ar: "هٰذَا ٱلدَّفْتَرُ لِـ —",
  ur: "یہ نوٹ بک ہے —",
};

/** Flowers taped into cards, cycled so neighbours differ. */
const PINNED_CYCLE: readonly BotanicalName[] = ["sage", "cosmos-head", "dandelion", "euc", "cosmos-head", "buds"];

export function pinnedBotanical(index: number): BotanicalName {
  return PINNED_CYCLE[index % PINNED_CYCLE.length] ?? "cosmos-head";
}

export function isTallBotanical(name: BotanicalName): boolean {
  return name !== "cosmos-head";
}
