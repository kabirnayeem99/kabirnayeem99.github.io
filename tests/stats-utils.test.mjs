import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const statsUtils = require("../assets/js/stats-utils.js");

test("toSafeNumber handles invalid inputs", function () {
  assert.equal(statsUtils.toSafeNumber(42), 42);
  assert.equal(statsUtils.toSafeNumber("5.5"), 5.5);
  assert.equal(statsUtils.toSafeNumber("abc"), 0);
  assert.equal(statsUtils.toSafeNumber(null), 0);
});

test("formatPercent applies compact display rules", function () {
  assert.equal(statsUtils.formatPercent(0.2345), "0.23%");
  assert.equal(statsUtils.formatPercent(9.876), "9.9%");
});

test("formatDuration renders seconds, minutes, and hours", function () {
  assert.equal(statsUtils.formatDuration(45), "45 secs");
  assert.equal(statsUtils.formatDuration(130), "2 mins");
  assert.equal(statsUtils.formatDuration(5400), "1 hrs 30 mins");
});

test("date helpers are UTC-safe", function () {
  const parsed = statsUtils.parseDateOnly("2026-03-10");
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), "2026-03-10T00:00:00.000Z");

  const shifted = statsUtils.addUtcDays(parsed, 2);
  assert.equal(statsUtils.dateKey(shifted), "2026-03-12");
});

test("parseDateOnly rejects malformed input", function () {
  assert.equal(statsUtils.parseDateOnly(""), null);
  assert.equal(statsUtils.parseDateOnly("not-a-date"), null);
  assert.equal(statsUtils.parseDateOnly(1234), null);
});

test("formatNumber rounds and clamps negatives", function () {
  assert.equal(statsUtils.formatNumber(1234.4), "1,234");
  assert.equal(statsUtils.formatNumber(1234.6), "1,235");
  assert.equal(statsUtils.formatNumber(-10), "0");
});
