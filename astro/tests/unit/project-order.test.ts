import test from "node:test";
import assert from "node:assert/strict";

import { metaYear, newestFirst } from "../../src/lib/project-order.ts";

test("metaYear takes the latest year named", () => {
  assert.equal(metaYear("2024 - Kotlin"), 2024);
  assert.equal(metaYear("2025–2026"), 2026);
  assert.equal(metaYear("2026, started 2019"), 2026);
});

test("metaYear reads Bengali, Arabic and Urdu digits", () => {
  assert.equal(metaYear("২০২৪ - কটলিন"), 2024);
  assert.equal(metaYear("٢٠٢٢"), 2022);
  assert.equal(metaYear("۲۰۲۳ - ڈارٹ"), 2023);
});

test("metaYear gives 0 without a year, and ignores other numbers", () => {
  for (const meta of [undefined, "", "Ongoing", "20245", "API 2100", "v12"]) {
    assert.equal(metaYear(meta), 0, String(meta));
  }
});

test("newestFirst sorts by year, keeps written order for ties, and puts undated last", () => {
  const cards = [{ id: "u" }, { id: "a", meta: "2021" }, { id: "b", meta: "2026" }, { id: "c", meta: "২০২১" }];
  assert.deepEqual(newestFirst(cards).map((card) => card.id), ["b", "a", "c", "u"]);
  assert.deepEqual(cards.map((card) => card.id), ["u", "a", "b", "c"]);
  assert.deepEqual(newestFirst([]), []);
});
