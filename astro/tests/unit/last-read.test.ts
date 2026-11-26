import test from "node:test";
import assert from "node:assert/strict";

import { isNewRead, parseKnownReviewIds, reviewIdOf } from "../../src/lib/last-read.ts";
import { fillLastFinished, withLastFinished } from "../../src/lib/last-finished.ts";
import { withoutSeries } from "../../src/lib/book-title.ts";
import { showLastFinished } from "../../src/scripts/modules/last-finished-link.ts";
import { selectShelfPicks } from "../../src/lib/home-shelf.ts";
import snapshot from "../../src/data/site-content/goodreads-snapshot.json" with { type: "json" };

const review = (id: number) => `https://www.goodreads.com/review/show/${id}?utm_medium=api`;

test("reviewIdOf reads the id from a review link only", () => {
  assert.equal(reviewIdOf(review(42)), "42");
  for (const href of ["https://www.goodreads.com/book/show/42", "/review/show/abc", "", null, undefined]) {
    assert.equal(reviewIdOf(href), null);
  }
});

test("parseKnownReviewIds keeps the strings and survives bad input", () => {
  assert.deepEqual([...parseKnownReviewIds('["1","2",3,null,"1"]')], ["1", "2"]);
  for (const json of [null, undefined, "", "{", '{"a":"1"}', '"1"']) {
    assert.equal(parseKnownReviewIds(json).size, 0, String(json));
  }
});

test("a book is a new read only when neither shown nor in the snapshot", () => {
  const known = new Set(["1", "2"]);
  assert.equal(isNewRead("3", review(1), known), true);
  assert.equal(isNewRead("2", review(1), known), false);
  assert.equal(isNewRead("3", review(3), known), false);
  assert.equal(isNewRead(null, review(1), known), false);
  assert.equal(isNewRead("3", null, new Set()), true);
});

test("withoutSeries drops only a trailing series marker", () => {
  assert.equal(withoutSeries("Lonesome Dove (Lonesome Dove, #1)"), "Lonesome Dove");
  assert.equal(withoutSeries("Edge (Saga, #2.5) "), "Edge");
  assert.equal(withoutSeries("Omnibus (Saga, #1-3)"), "Omnibus");
  assert.equal(withoutSeries("Omnibus (Saga, #0.5–2)"), "Omnibus");
  assert.equal(withoutSeries("Dune (Deluxe Edition)"), "Dune (Deluxe Edition)");
  assert.equal(withoutSeries("(Saga, #1) Prelude"), "(Saga, #1) Prelude");
});

test("fillLastFinished writes an escaped link wherever the tag appears", () => {
  const html = fillLastFinished("<last-finished/> and <last-finished />.", {
    href: 'https://x.org/?a=1&b="2"',
    title: "A <B> & $& (Saga, #1)",
  });
  const link =
    '<a href="https://x.org/?a=1&amp;b=&quot;2&quot;" target="_blank" rel="nofollow noreferrer" dir="auto"' +
    " data-last-finished>A &lt;B&gt; &amp; $&amp;</a>";
  assert.equal(html, `${link} and ${link}.`);
});

test("fillLastFinished marks the title's script", () => {
  assert.match(fillLastFinished("<last-finished/>", { href: "h", title: "পথের পাঁচালী" }), / lang="bn" /);
  assert.match(fillLastFinished("<last-finished/>", { href: "h", title: "حجاز کی آندھی" }), / lang="ur" /);
});

test("fillLastFinished needs a book only when the tag is there", () => {
  assert.equal(fillLastFinished("plain", undefined), "plain");
  assert.throws(() => fillLastFinished("<last-finished/>", undefined), /no books/);
});

test("withLastFinished names the snapshot's newest book", () => {
  assert.equal(withLastFinished("<last-finished/>"), fillLastFinished("<last-finished/>", snapshot.books[0]));
});

test("showLastFinished updates every mention, and ignores a blank link or title", (t) => {
  const links = [0, 1].map(() => ({ href: "old", textContent: "Old", removeAttribute: () => undefined }));
  Object.assign(globalThis, { document: { querySelectorAll: () => links } });
  t.after(() => Reflect.deleteProperty(globalThis, "document"));

  showLastFinished("", "New");
  showLastFinished("new", "  ");
  assert.deepEqual(links.map((link) => link.textContent), ["Old", "Old"]);

  showLastFinished("new", "New (Saga, #3)");
  assert.deepEqual(links.map((link) => [link.href, link.textContent]), [["new", "New"], ["new", "New"]]);
});

const shelf = (id: string, dateRead: string | null = null) => ({ imageFileName: id, dateRead });
const names = (books: readonly { readonly imageFileName: string }[]) => books.map((book) => book.imageFileName);
const BOOKS = [shelf("last", "2026-01-01"), shelf("a", "2024-01-01"), shelf("b"), shelf("c", "2025-01-01"), shelf("d")];

test("shelf picks: newest read first, undated last in the order picked", () => {
  assert.deepEqual(names(selectShelfPicks(BOOKS, ["d", "a", "b", "c"], 8)), ["c", "a", "d", "b"]);
});

test("shelf picks never repeat the last read book, skip unknown names and respect the limit", () => {
  assert.deepEqual(names(selectShelfPicks(BOOKS, ["last", "gone", "a", "c"], 1)), ["c"]);
});

test("with no usable pick, recent reads after the last one fill the shelf", () => {
  assert.deepEqual(names(selectShelfPicks(BOOKS, ["last", "gone"], 2)), ["a", "b"]);
  assert.deepEqual(names(selectShelfPicks([], ["a"], 2)), []);
  assert.deepEqual(names(selectShelfPicks([shelf("only")], [], 2)), []);
});
