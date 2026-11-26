// Goodreads read dates. 1 January stands for "year known, day unknown", judged by the date as
// written: converting "2012-01-01T00:00:00+06:00" to UTC first would move it into 2011.

const WRITTEN_NEW_YEAR = /^(\d{4})-01-01(?!\d)/;

/** The instant to show and sort by; null if missing or unreadable. */
export function parseReadDate(value: string | null | undefined): Date | null {
  const time = Date.parse(value ?? "");
  if (Number.isNaN(time)) {
    return null;
  }
  const year = WRITTEN_NEW_YEAR.exec(value ?? "")?.[1];
  return new Date(year === undefined ? time : Date.UTC(Number(year), 0, 1));
}
