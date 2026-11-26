import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertContentValid, findContentIssues, formatIssue } from "../../src/lib/content-validate.ts";
import { CONTENT_SCHEMAS, statsSnapshotSourceSchemas } from "../../src/lib/content-schema.ts";
import { listSiteContentFilePaths } from "../../src/lib/content-loader-shared.ts";
import { ALL_PAGE_IDS } from "../../src/lib/locale-config.ts";
import { isRecord } from "../../src/scripts/modules/guards.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
type Json = Record<string, unknown>;

/** Replaces a file's text instead of editing its JSON. */
interface Raw {
  readonly raw: string;
}
type Mutate = (data: Json) => unknown;

/** The object (or array, by index) found by walking `path` from `value`. */
function at(value: unknown, ...path: readonly (string | number)[]): Json {
  const found = path.reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), value);
  assert.ok(isRecord(found), `no object at ${path.join(".")}`);
  return found;
}

/** The array found by walking `path` from `value`. */
function list(value: unknown, ...path: readonly (string | number)[]): unknown[] {
  const found: unknown = at(value, ...path);
  assert.ok(Array.isArray(found), `no array at ${path.join(".")}`);
  return found;
}

const isRaw = (value: unknown): value is Raw => isRecord(value) && typeof value["raw"] === "string";
const readJson = (name: string): Json => at(JSON.parse(readFileSync(join(ROOT, "src/data", name), "utf8")));

/** The issues reported after changing one file in a copy of the content. */
function issuesAfter(name: string, mutate: Mutate): readonly string[] {
  const copy = mkdtempSync(join(tmpdir(), "content-"));
  try {
    cpSync(join(ROOT, "src/data"), join(copy, "src/data"), { recursive: true });
    symlinkSync(join(ROOT, "public"), join(copy, "public"));
    const data = readJson(name);
    const replaced = mutate(data);
    writeFileSync(join(copy, "src/data", name), isRaw(replaced) ? replaced.raw : JSON.stringify(data));
    return findContentIssues(copy).map(formatIssue);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

function assertReports(name: string, mutate: Mutate, ...fragments: readonly string[]): void {
  const issues = issuesAfter(name, mutate);
  assert.ok(
    issues.some((issue) => fragments.every((fragment) => issue.includes(fragment))),
    `expected an issue with ${JSON.stringify(fragments)}, got:\n${issues.join("\n")}`,
  );
}

test("every content file is valid", () => {
  assert.deepEqual(findContentIssues(ROOT).map(formatIssue), []);
  assert.doesNotThrow(() => {
    assertContentValid(ROOT);
  });
});

test("a failure names the file, the JSON path and the language", () => {
  const issue = { file: "src/data/x.json", path: ["locales", "bn", "entries", 2, "title"], message: "missing" };
  assert.equal(formatIssue(issue), "src/data/x.json: locales.bn.entries[2].title [bn]: missing");
});

test("every JSON file under src/data has a schema, and the reverse", () => {
  const files = readdirSync(join(ROOT, "src/data"), { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".json"));
  assert.deepEqual(files.sort(), Object.keys(CONTENT_SCHEMAS).sort());
});

const work = "site-content/pages/work.json";
const index = "site-content/pages/index.json";

type Failure = readonly [what: string, file: string, mutate: Mutate, ...fragments: string[]];

const FAILURES: readonly Failure[] = [
  ["a missing label translation", "site-content/navigation-labels.json", (d) => delete at(d, "work")["ur"], "work.ur [ur]", "missing"],
  ["a missing page locale", work, (d) => delete at(d, "locales")["ar"], "locales.ar [ar]", "missing"],
  ["a missing field", work, (d) => delete at(d, "locales", "bn")["summary"], "locales.bn.summary [bn]", "missing"],
  ["an optional field left untranslated", work, (d) => delete at(d, "locales", "bn", "entries", 0)["meta"], "locales.bn.entries[0].meta [bn]", "missing translation"],
  ["a missing entry", work, (d) => list(d, "locales", "ur", "entries").pop(), "locales.ur.entries [ur]", "English has"],
  ["a missing home section", index, (d) => list(d, "locales", "ar", "sections").pop(), "locales.ar.sections [ar]"],
  ["missing home actions", index, (d) => delete at(d, "locales", "bn")["top_actions"], "locales.bn.top_actions [bn]", "missing"],
  ["a mistyped key", work, (d) => (at(d, "locales", "en", "entries", 0)["bulets"] = []), "locales.en.entries[0].bulets [en]", "unknown key"],
  ["an empty string", work, (d) => (at(d, "locales", "ar")["section_title"] = " "), "locales.ar.section_title [ar]", "empty"],
  ["an unknown icon", work, (d) => (at(d, "locales", "bn", "entries", 0, "stickers", 0)["icon"] = "kotln"), "stickers[0].icon [bn]", 'unknown icon "kotln"'],
  ["an unknown skill icon", "site-content/skills.json", (d) => (at(d, "groups", 0, "items", 0)["icon"] = "kotln"), "groups[0].items[0].icon", "unknown icon"],
  ["a bad link", index, (d) => (at(d, "locales", "en", "top_actions", 0)["href"] = "mailto:nobody"), "top_actions[0].href [en]", "mailto:"],
  ["a bad link inside HTML", index, (d) => (at(d, "locales", "bn")["footer_html"] = '<a href="htps://x.org">x</a>'), "locales.bn.footer_html [bn]", "htps://x.org"],
  ["a dead in-site link", index, (d) => (at(d, "locales", "ur")["footer_html"] = '<a href="/ur/wrok.html">x</a>'), "[ur]", "/ur/wrok.html"],
  ["a missing image", index, (d) => (at(d, "locales", "en", "sections", 1, "images", 0)["src"] = "assets/images/none.webp"), "images[0].src [en]", "no such file"],
  ["a bad URL", "site-content/site.json", (d) => (list(d, "social_profiles")[0] = "github.com/x"), "social_profiles[0]", "http(s)"],
  ["a bad route", "site-content/routes.json", (d) => (at(d, "blog")["ar"] = "/ar/blog"), "blog.ar [ar]", "route"],
  ["a bad book date", "site-content/goodreads-snapshot.json", (d) => (at(d, "books", 0)["dateRead"] = "2026-02-30T00:00:00Z"), "books[0].dateRead", "ISO 8601"],
  ["a bad contribution date", "stats-snapshots.json", (d) => (at(d, "githubCommits", "contributions", 0)["date"] = "1/2/2026"), "contributions[0].date", "YYYY-MM-DD"],
  ["a page dropped from the nav", "site-content/navigation.json", (d) => list(d, "bn").pop(), "bn [bn]", "missing"],
  ["a mistyped nav page", "site-content/navigation.json", (d) => (list(d, "en")[0] = "home"), "en[0] [en]"],
  ["broken JSON", work, () => ({ raw: "{" }), "work.json", "cannot be read as JSON"],
];

for (const [what, name, mutate, ...fragments] of FAILURES) {
  test(`rejects ${what}`, () => {
    assertReports(name, mutate, `src/data/${name}`, ...fragments);
  });
}

test("accepts what the Goodreads script can write", () => {
  const book = at(readJson("site-content/goodreads-snapshot.json"), "books", 0);
  const schema = CONTENT_SCHEMAS["site-content/goodreads-snapshot.json"];
  assert.ok(schema, "the Goodreads snapshot has a schema");
  for (const dateRead of [null, "2024-01-01T00:00:00Z", "2024-01-01T10:20:30-07:00", "2024-01-01T00:00:00"]) {
    const snapshot = { generatedAt: "2026-11-26T07:12:37.164239Z", books: [{ ...book, dateRead }] };
    assert.ok(schema.safeParse(snapshot).success, String(dateRead));
  }
});

test("accepts new fields and empty values in refreshed stats", () => {
  const stats = readJson("stats-snapshots.json");
  at(stats, "wakatime", "summaryPayload", "data", "range")["timezone"] = "Asia/Dhaka";
  at(stats, "wakatime", "summaryPayload", "data", "grand_total")["new_field"] = null;
  at(stats, "wakatime", "languagePayload", "data", 0)["color"] = "";
  at(stats, "githubCommits", "total")["2031"] = 0;
  delete at(stats, "githubCommits", "contributions", 0)["level"];
  at(stats, "githubProfile", "repos", 0)["language"] = null;
  at(stats, "githubProfile", "repos", 0)["description"] = "";
  at(stats, "githubProfile")["languages"] = {};
  at(stats, "leetcode", "solved", "acSubmissionNum", 0)["beats"] = 1.5;
  for (const [name, schema] of Object.entries(statsSnapshotSourceSchemas)) {
    assert.equal(schema.safeParse(stats[name]).error, undefined, name);
  }
});

test("'Last updated' counts every page file, reading included", () => {
  const names = listSiteContentFilePaths().map((path) => path.split("/").pop());
  for (const id of ALL_PAGE_IDS) {
    assert.ok(names.includes(`${id}.json`), id);
  }
});
