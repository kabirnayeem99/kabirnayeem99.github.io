import { parseReadDate } from "./read-date.ts";
import type { Lang } from "./locale-config.ts";
import type { ShelfText } from "./reading-content.ts";

// The shelf is split into one collapsible group per year read, all open to begin with.
// Undated books at the top of the snapshot are the ones the snapshot script has just picked
// up without a date, so they get their own group; any other undated book goes in a last one.

const NUMBER_LOCALE: Readonly<Record<Lang, string>> = {
  en: "en-GB",
  bn: "bn-BD",
  ar: "ar-u-ca-gregory",
  ur: "ur-PK",
};

export interface ShelfGroup<T> {
  readonly key: string;
  readonly heading: string;
  readonly count: string;
  readonly books: readonly T[];
}

export function groupShelfByYear<T extends { readonly dateRead?: string | null | undefined }>(
  books: readonly T[],
  text: ShelfText,
  lang: Lang,
): readonly ShelfGroup<T>[] {
  const yearOf = (book: T): number | null => {
    return parseReadDate(book.dateRead)?.getUTCFullYear() ?? null;
  };

  const firstDated = books.findIndex((book) => yearOf(book) !== null);
  const recent = books.slice(0, firstDated === -1 ? 0 : firstDated);
  const undated: T[] = [];
  const byYear = new Map<number, T[]>();
  for (const book of books.slice(recent.length)) {
    const year = yearOf(book);
    if (year === null) {
      undated.push(book);
    } else {
      byYear.set(year, [...(byYear.get(year) ?? []), book]);
    }
  }

  const locale = NUMBER_LOCALE[lang];
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const yearName = new Intl.NumberFormat(locale, { useGrouping: false });
  const group = (key: string, heading: string, items: readonly T[]): ShelfGroup<T> => ({
    key,
    heading,
    books: items,
    count: (plural.select(items.length) === "one" ? text.countOne : text.countOther).replace(
      "{count}",
      number.format(items.length),
    ),
  });

  const years = [...byYear.keys()].sort((a, b) => b - a);
  return [
    ...(recent.length > 0 ? [group("recent", text.recentLabel, recent)] : []),
    ...years.map((year) => group(String(year), yearName.format(year), byYear.get(year) ?? [])),
    // Always present (hidden while empty): goodreads-loader files newly fetched books here.
    group("undated", text.undatedLabel, undated),
  ];
}
