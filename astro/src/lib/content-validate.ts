// Checks every content file against content-schema.ts, plus what a schema of one value cannot
// see: translations that drifted apart, links inside HTML copy, and missing image files.
// astro.config.mjs runs this before every build.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { z } from "astro/zod";
import { CONTENT_SCHEMAS, langOfPath } from "./content-schema.ts";
import { LANGS } from "./locale-config.ts";

export interface ContentIssue {
  /** Path from the astro directory. */
  readonly file: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

function formatJsonPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((output, part) => {
    if (typeof part === "number") {
      return `${output}[${part}]`;
    }
    return output.length === 0 ? String(part) : `${output}.${String(part)}`;
  }, "");
}

export function formatIssue({ file, path, message }: ContentIssue): string {
  const lang = langOfPath(path) ?? "all languages";
  const where = formatJsonPath(path);
  return `${file}: ${where === "" ? "(whole file)" : where} [${lang}]: ${message}`;
}

function contentError(issues: readonly ContentIssue[]): Error {
  const lines = issues.map((issue) => `  - ${formatIssue(issue)}`);
  return new Error(`Invalid content (${issues.length}):\n${lines.join("\n")}`);
}

function schemaIssues(file: string, error: z.ZodError): ContentIssue[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ file, path: [...issue.path, key], message: "unknown key (typo?)" }));
    }
    const missing = issue.code === "invalid_type" && issue.input === undefined;
    const message = missing ? "missing (required value or translation)" : issue.message;
    return [{ file, path: issue.path, message }];
  });
}

type Parsed<T> = { readonly data: T } | { readonly issues: readonly ContentIssue[] };

function readAndParse<T>(root: string, file: string, schema: z.ZodType<T>): Parsed<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(root, file), "utf-8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { issues: [{ file, path: [], message: `cannot be read as JSON: ${reason}` }] };
  }
  const result = schema.safeParse(raw, { reportInput: true });
  return result.success ? { data: result.data } : { issues: schemaIssues(file, result.error) };
}

/** Reads one content file (path from the astro directory) and returns it typed, or throws. */
export function readContentFile<T>(root: string, file: string, schema: z.ZodType<T>): T {
  const parsed = readAndParse(root, file, schema);
  if ("issues" in parsed) {
    throw contentError(parsed.issues);
  }
  return parsed.data;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Pages whose translations mirror the English one entry for entry. The home page does not:
// its other languages are laid out differently, so only its number of sections is compared.
const PARALLEL_PAGES = ["work", "project", "blog", "stats"];
// Prose may be split into a different number of pieces in each language.
const FREE_LENGTH_KEYS: ReadonlySet<PropertyKey> = new Set(["paragraphs", "bullets", "intro"]);

function parityIssues(file: string, english: unknown, other: unknown, path: readonly PropertyKey[]): ContentIssue[] {
  if (Array.isArray(english) && Array.isArray(other)) {
    const key = path.at(-1);
    if (key !== undefined && FREE_LENGTH_KEYS.has(key)) {
      return [];
    }
    if (english.length !== other.length) {
      return [{ file, path, message: `has ${other.length} entries, English has ${english.length}` }];
    }
    return english.flatMap((entry, index) => parityIssues(file, entry, other[index], [...path, index]));
  }
  if (!isObject(english) || !isObject(other)) {
    return [];
  }
  return [...new Set([...Object.keys(english), ...Object.keys(other)])].flatMap((key) => {
    if (!(key in other)) {
      return [{ file, path: [...path, key], message: "missing translation: English has it" }];
    }
    if (!(key in english)) {
      return [{ file, path: [...path, key], message: "not in the English entry" }];
    }
    return parityIssues(file, english[key], other[key], [...path, key]);
  });
}

function translationIssues(file: string, data: unknown): ContentIssue[] {
  const page = /pages\/(\w+)\.json$/.exec(file)?.[1];
  if (page === undefined || !isObject(data) || !isObject(data["locales"])) {
    return [];
  }
  const { en, ...others } = data["locales"];
  return LANGS.filter((lang) => lang in others).flatMap((lang) => {
    const other = others[lang];
    if (PARALLEL_PAGES.includes(page)) {
      return parityIssues(file, en, other, ["locales", lang]);
    }
    if (page === "index" && isObject(en) && isObject(other)) {
      const expected = Array.isArray(en["sections"]) ? en["sections"].length : 0;
      const actual = Array.isArray(other["sections"]) ? other["sections"].length : 0;
      if (expected !== actual) {
        const message = `has ${actual} entries, English has ${expected}`;
        return [{ file, path: ["locales", lang, "sections"], message }];
      }
    }
    return [];
  });
}

function walkStrings(
  value: unknown,
  path: readonly PropertyKey[],
  visit: (text: string, path: readonly PropertyKey[]) => void,
): void {
  if (typeof value === "string") {
    visit(value, path);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkStrings(entry, [...path, index], visit);
    });
  } else if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      walkStrings(entry, [...path, key], visit);
    }
  }
}

const HTML_LINK = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

function isGoodHtmlLink(link: string, routes: ReadonlySet<string>, publicDir: string): boolean {
  if (/^#[^\s]*$/.test(link) || /^mailto:[^\s@]+@[^\s@]+$/.test(link)) {
    return true;
  }
  if (/^https?:\/\/[^\s]+$/.test(link)) {
    return URL.canParse(link);
  }
  // A link within the site must lead to a page or a public file.
  const target = /^\/([^\s?#]*)/.exec(link)?.[1];
  return target !== undefined && (target === "" || routes.has(target) || existsSync(join(publicDir, target)));
}

/** Links written inside HTML copy, and image files the content names. */
function referenceIssues(root: string, file: string, data: unknown, routes: ReadonlySet<string>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  walkStrings(data, [], (value, path) => {
    if (path.at(-1) === "src" && value.startsWith("assets/") && !existsSync(resolve(root, "public", value))) {
      issues.push({ file, path, message: `no such file: public/${value}` });
    }
    for (const match of value.matchAll(HTML_LINK)) {
      const link = match[1] ?? match[2] ?? match[3] ?? "";
      if (!isGoodHtmlLink(link, routes, resolve(root, "public"))) {
        issues.push({ file, path, message: `bad link in HTML: "${link}"` });
      }
    }
  });
  return issues;
}

function listJsonFiles(directory: string, prefix: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      return listJsonFiles(join(directory, entry.name), `${name}/`);
    }
    return entry.name.endsWith(".json") ? [name] : [];
  });
}

function routeSet(data: unknown): ReadonlySet<string> {
  const routes = new Set<string>();
  walkStrings(data, [], (value) => {
    routes.add(value);
  });
  return routes;
}

/** Every problem in the content under `root` (the astro directory). */
export function findContentIssues(root: string): readonly ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const name of listJsonFiles(resolve(root, "src/data"), "")) {
    if (!(name in CONTENT_SCHEMAS)) {
      const message = "no schema for this file: add one to src/lib/content-schema.ts";
      issues.push({ file: `src/data/${name}`, path: [], message });
    }
  }

  const parsed = Object.entries(CONTENT_SCHEMAS).map(([name, schema]) => {
    const file = `src/data/${name}`;
    return { file, result: readAndParse(root, file, schema) };
  });
  const routesFile = parsed.find(({ file }) => file.endsWith("/routes.json"))?.result;
  const routes = routeSet(routesFile !== undefined && "data" in routesFile ? routesFile.data : {});

  for (const { file, result } of parsed) {
    if ("issues" in result) {
      issues.push(...result.issues);
      continue;
    }
    issues.push(...translationIssues(file, result.data));
    // Generated files hold third-party text, and a data refresh must not be able to fail this.
    if (!file.endsWith("stats-snapshots.json") && !file.endsWith("goodreads-snapshot.json")) {
      issues.push(...referenceIssues(root, file, result.data, routes));
    }
  }
  return issues;
}

export function assertContentValid(root: string): void {
  const issues = findContentIssues(root);
  if (issues.length > 0) {
    throw contentError(issues);
  }
}
