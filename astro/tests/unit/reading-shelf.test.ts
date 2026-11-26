import test from "node:test";
import assert from "node:assert/strict";

import { groupShelfByYear, type ShelfGroup } from "../../src/lib/reading-shelf.ts";

const TEXT = { title: "", copy: "", recentLabel: "Recent", undatedLabel: "Undated", countOne: "{count} book", countOther: "{count} books" };
interface Book {
  readonly id: string | number;
  readonly dateRead?: string | null | undefined;
}
const book = (id: string | number, dateRead?: string | null): Book => ({ id, dateRead });
const shape = (groups: readonly ShelfGroup<Book>[]) => groups.map((group) => [group.key, group.books.map((b) => b.id)]);

test("groups by year, newest year first, keeping the order within a year", () => {
  const groups = groupShelfByYear(
    [book("a", "2024-05-01T00:00:00Z"), book("b", "2026-01-02T00:00:00Z"), book("c", "2024-02-01T00:00:00Z")],
    TEXT,
    "en",
  );
  assert.deepEqual(shape(groups), [["2026", ["b"]], ["2024", ["a", "c"]], ["undated", []]]);
});

test("undated books before the first dated one are recent; later ones are undated", () => {
  const groups = groupShelfByYear(
    [book("new1", null), book("new2"), book("a", "2025-03-01"), book("old", ""), book("bad", "not a date")],
    TEXT,
    "en",
  );
  assert.deepEqual(shape(groups), [["recent", ["new1", "new2"]], ["2025", ["a"]], ["undated", ["old", "bad"]]]);
  assert.deepEqual(groups.map((group) => group.heading), ["Recent", "2025", "Undated"]);
});

test("with no dated book at all, everything is undated", () => {
  assert.deepEqual(shape(groupShelfByYear([book("a", null), book("b")], TEXT, "en")), [["undated", ["a", "b"]]]);
});

test("an empty shelf still has the undated group, for books fetched later", () => {
  const groups = groupShelfByYear([], TEXT, "en");
  assert.deepEqual(shape(groups), [["undated", []]]);
  assert.equal(groups[0]?.count, "0 books");
});

test("the year is read in UTC, except for a date written as 1 January", () => {
  const yearOf = (date: string) => groupShelfByYear([book("a", date)], TEXT, "en")[0]?.key;
  assert.equal(yearOf("2024-12-31T23:00:00-08:00"), "2025");
  assert.equal(yearOf("2025-01-01T03:00:00+06:00"), "2025");
});

test("counts pick the singular or plural and use the language's digits", () => {
  const many = Array.from({ length: 1200 }, (_, id) => book(id, "2025-06-01"));
  assert.equal(groupShelfByYear(many, TEXT, "en")[0]?.count, "1,200 books");
  assert.equal(groupShelfByYear([book("a", "2025-06-01")], TEXT, "en")[0]?.count, "1 book");
  const [bangla] = groupShelfByYear(many.slice(0, 2), TEXT, "bn");
  assert.equal(bangla?.heading, "২০২৫");
  assert.equal(bangla.count, "২ books");
});
