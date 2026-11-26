import type { Lang } from "./locale-config.ts";
import { parseReadDate } from "./read-date.ts";

// Gregorian calendar everywhere: the Arabic default (ar-SA) would switch to Hijri dates.
export const READ_DATE_LOCALE: Readonly<Record<Lang, string>> = {
  en: "en-GB",
  bn: "bn-BD",
  ar: "ar-u-ca-gregory",
  ur: "ur-PK",
};

/** Short, hand-writable date for the tape strip above a book cover ("6 Oct 2026", or "2024"). */
export function formatReadDate(iso: string | null | undefined, lang: Lang): string | undefined {
  if (typeof iso !== "string" || iso.length === 0) {
    return undefined;
  }
  const date = parseReadDate(iso);
  if (date === null) {
    return undefined;
  }
  // 1 January is the placeholder for "read that year, day unknown": show the year alone.
  const yearOnly = date.getUTCMonth() === 0 && date.getUTCDate() === 1;
  return new Intl.DateTimeFormat(READ_DATE_LOCALE[lang], {
    ...(yearOnly ? {} : ({ day: "numeric", month: "short" } as const)),
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
  }).format(parseReadDate(iso) ?? new Date(iso));
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
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    host = "";
  }
  const publication = host === "medium.com" || host.endsWith(".medium.com") ? "Medium" : host.replace(/^www\./, "");
  return { publication, topic: undefined };
}
