import test from "node:test";
import assert from "node:assert/strict";

import { formatReadDate, formatMarginDate, clippingMast } from "../../src/lib/notebook.ts";
import { formatBuildTimestamp, formatIsoDhaka } from "../../src/lib/dhaka-time.ts";
import type { Lang } from "../../src/lib/site-types.ts";

test("formatReadDate writes a short date in each language, always Gregorian", () => {
  const iso = "2026-10-06T00:00:00Z";
  assert.equal(formatReadDate(iso, "en"), "6 Oct 2026");
  assert.equal(formatReadDate(iso, "bn"), "৬ অক্টো, ২০২৬");
  assert.match(formatReadDate(iso, "ar") ?? "", /أكتوبر.*2026/);
  assert.match(formatReadDate(iso, "ur") ?? "", /اکتوبر.*2026/);
});

test("1 January means the day is unknown: the year alone", () => {
  assert.equal(formatReadDate("2024-01-01T00:00:00Z", "en"), "2024");
  assert.equal(formatReadDate("2024-01-01T23:59:59Z", "bn"), "২০২৪");
  assert.equal(formatReadDate("2024-01-02T00:00:00Z", "en"), "2 Jan 2024");
});

test("a date written as 1 January keeps its year in any offset", () => {
  assert.equal(formatReadDate("2012-01-01T00:00:00+06:00", "en"), "2012");
  assert.equal(formatReadDate("2012-01-01T23:00:00-08:00", "en"), "2012");
  assert.equal(formatMarginDate("2012-01-01T00:00:00+06:00", "en"), "1 Jan 2012");
});

test("read dates are shown in UTC", () => {
  assert.equal(formatReadDate("2026-03-01T02:00:00+06:00", "en"), "28 Feb 2026");
});

test("formatReadDate gives nothing for a missing or unreadable date", () => {
  for (const value of [undefined, null, "", "soon"]) {
    assert.equal(formatReadDate(value, "en"), undefined);
  }
});

test("formatMarginDate keeps 1 January in full", () => {
  assert.equal(formatMarginDate("2026-01-01T00:00:00Z", "en"), "1 Jan 2026");
});

test("clippingMast takes the meta line, else the host", () => {
  assert.deepEqual(clippingMast("https://x.org", "Medium · career · tips"), { publication: "Medium", topic: "career · tips" });
  assert.deepEqual(clippingMast("https://x.org", "Medium"), { publication: "Medium", topic: undefined });
  assert.deepEqual(clippingMast("https://me.medium.com/p", "  "), { publication: "Medium", topic: undefined });
  assert.deepEqual(clippingMast("https://www.example.org/p"), { publication: "example.org", topic: undefined });
  assert.deepEqual(clippingMast("nonsense"), { publication: "", topic: undefined });
});

test("formatIsoDhaka is six hours ahead of UTC, across a year end", () => {
  assert.equal(formatIsoDhaka(new Date("2025-12-31T17:59:59Z")), "2025-12-31T23:59:59+06:00");
  assert.equal(formatIsoDhaka(new Date("2025-12-31T18:00:00Z")), "2026-01-01T00:00:00+06:00");
});

const words = { prefix: "built", dayPeriod: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } };
const stamp = (utc: string, lang: Lang = "en") => formatBuildTimestamp(new Date(utc), lang, words);

test("the build stamp uses a twelve-hour clock, turning at midnight and noon", () => {
  assert.equal(stamp("2026-03-04T18:00:00Z"), "built 5 March 2026 12:00:00 AM (Morning)");
  assert.equal(stamp("2026-03-05T05:59:59Z"), "built 5 March 2026 11:59:59 AM (Morning)");
  assert.equal(stamp("2026-03-05T06:00:00Z"), "built 5 March 2026 12:00:00 PM (Afternoon)");
  assert.equal(stamp("2026-03-05T07:05:09Z"), "built 5 March 2026 01:05:09 PM (Afternoon)");
  assert.equal(stamp("2026-03-05T10:59:59Z"), "built 5 March 2026 04:59:59 PM (Afternoon)");
  assert.equal(stamp("2026-03-05T11:00:00Z"), "built 5 March 2026 05:00:00 PM (Evening)");
});

test("the build stamp uses each language's digits and day marker", () => {
  const evening = "2026-03-05T13:00:00Z";
  assert.match(stamp(evening, "bn"), /৫ মার্চ ২০২৬ ০৭:০০:০০ PM/);
  assert.match(stamp(evening, "ar"), /مارس .* م \(Evening\)$/);
  assert.match(stamp(evening, "ur"), /مارچ ۲۰۲۶ [^ ]+ \(Evening\)$|مارچ 2026 [^ ]+ \(Evening\)$/);
});
