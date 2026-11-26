#!/usr/bin/env node
// Refreshes src/data/stats-snapshots.json, the figures the stats page shows before (or instead
// of) its live requests. Run by the deploy workflow and by hand: `npm run stats:refresh`.
// Usage: `scripts/refresh-stats-snapshots.ts --help`.
//
// It calls the same public endpoints as the browser (read from pages/stats.json), with no
// keys. Each source stands alone: one that fails or returns something unexpected keeps its
// previous figures and date, and the run still succeeds. A run that breaks altogether exits 1;
// the deploy step is `continue-on-error`, so neither can stop a deploy.
import { rmSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isRecord, toRecord } from "../src/scripts/modules/guards.ts";
import { onStopSignal, runCli } from "./cli.ts";

const HELP = `usage: refresh-stats-snapshots.ts [-h]

Fetch the stats page's figures from the public WakaTime, GitHub and LeetCode
endpoints (no keys) and rewrite src/data/stats-snapshots.json. A source that
fails keeps its previous figures and date, with a warning.

options:
  -h, --help  show this help message and exit

npm: stats:refresh

Progress and warnings go to stderr (as ::warning:: lines on GitHub Actions).
exit status: 0 ran (even if some or all sources kept their old figures),
1 failed (file left as it was), 2 usage error, 130 interrupted.
`;

const SNAPSHOT_FILE = fileURLToPath(new URL("../src/data/stats-snapshots.json", import.meta.url));
const STATS_PAGE_FILE = fileURLToPath(new URL("../src/data/site-content/pages/stats.json", import.meta.url));
// Written first, then renamed over the snapshot, so the file is never half-written.
const TEMPORARY_FILE = `${SNAPSHOT_FILE}.tmp`;

// The heatmap shows 53 weeks; older days are left out to keep the bundle small.
const HEATMAP_DAYS = 53 * 7;
const TOP_REPOS = 6;

/** The "wakatime", "github_commits", … sections of pages/stats.json, which hold the URLs. */
type Sections = Readonly<Record<string, unknown>>;

// A declaration, not an arrow: assertion signatures only narrow through declared names.
function check(condition: boolean, what: string): asserts condition {
  if (!condition) {
    throw new Error(`unexpected response: ${what}`);
  }
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

function isNonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  check(isRecord(value), what);
  return value;
}

function endpoint(sections: Sections, section: string, key: string): string {
  const url = toRecord(sections[section])[key];
  if (typeof url !== "string") {
    throw new Error(`pages/stats.json has no ${section}.${key}`);
  }
  return url;
}

async function fetchJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "stats-snapshot-refresh" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  }
  return response.json();
}

async function wakatime(sections: Sections): Promise<object> {
  const [languages, summary] = await Promise.all([
    fetchJson(endpoint(sections, "wakatime", "languages_url")),
    fetchJson(endpoint(sections, "wakatime", "summary_url")),
  ]);
  const items = toRecord(languages)["data"];
  check(isNonEmptyArray(items), "WakaTime languages");
  const { best_day: bestDay, grand_total: total, range } = toRecord(toRecord(summary)["data"]);
  const { date } = toRecord(bestDay);
  const { start, end } = toRecord(range);
  check(
    Number(toRecord(total)["total_seconds"]) > 0 && Boolean(date) && Boolean(start) && Boolean(end),
    "WakaTime summary",
  );
  return {
    languagePayload: {
      data: items.map((item) => {
        const { name, percent, color } = toRecord(item);
        check(typeof name === "string" && Number.isFinite(percent), "WakaTime language");
        return { name, percent, color: color ?? "" };
      }),
    },
    summaryPayload: { data: { best_day: bestDay, grand_total: total, range } },
  };
}

interface ContributionDay extends Record<string, unknown> {
  readonly date: string;
  readonly count: number;
}

function isContributionDay(day: Record<string, unknown>): day is ContributionDay {
  return typeof day["date"] === "string" && isCount(day["count"]);
}

async function githubCommits(sections: Sections): Promise<object> {
  const { total, contributions } = toRecord(await fetchJson(endpoint(sections, "github_commits", "contrib_url")));
  check(
    isRecord(total) && Object.keys(total).length > 0 && Object.values(total).every(isCount),
    "contribution totals",
  );
  check(isNonEmptyArray(contributions), "contributions");
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - HEATMAP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const past = contributions
    .map((day) => requireRecord(day, "contribution day"))
    .filter(isContributionDay)
    .filter((day) => day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const [first] = past;
  check(first !== undefined, "contribution days");
  // The best day ever stays in, whatever its age: the page names it.
  const best = past.reduce((top, day) => (day.count > top.count ? day : top), first);
  return {
    total,
    contributions: past
      .filter((day) => day.date >= cutoff || day === best)
      .map(({ date, count, level }) => ({ date, count, level })),
  };
}

async function githubProfile(sections: Sections): Promise<object> {
  const [rawRepos, prs, issues] = await Promise.all([
    fetchJson(endpoint(sections, "github_profile", "repos_api_url")),
    fetchJson(endpoint(sections, "github_profile", "prs_api_url")),
    fetchJson(endpoint(sections, "github_profile", "issues_api_url")),
  ]);
  check(Array.isArray(rawRepos), "repositories");
  const mergedPrs = toRecord(prs)["total_count"];
  const issuesOpened = toRecord(issues)["total_count"];
  check(isCount(mergedPrs) && isCount(issuesOpened), "search counts");
  // Same selection as scripts/modules/github-profile.ts.
  const own = rawRepos
    .map((repo) => requireRecord(repo, "repository"))
    .filter((repo) => repo["fork"] !== true && typeof repo["name"] === "string")
    .sort((a, b) => Number(b["stargazers_count"]) - Number(a["stargazers_count"]));
  check(own.length > 0, "own repositories");
  const languages: Record<string, number> = {};
  for (const { language } of own.map((repo) => ({ language: repo["language"] }))) {
    if (typeof language === "string" && language !== "") {
      languages[language] = (languages[language] ?? 0) + 1;
    }
  }
  return {
    repos: own.slice(0, TOP_REPOS).map((repo) => ({
      name: repo["name"],
      description: repo["description"] ?? "",
      stars: repo["stargazers_count"],
      language: repo["language"] ?? null,
      htmlUrl: repo["html_url"],
    })),
    mergedPrs,
    issuesOpened,
    languages,
  };
}

async function leetcode(sections: Sections): Promise<object> {
  // The API sleeps when idle and can take most of a minute to wake.
  const solved = toRecord(await fetchJson(`${endpoint(sections, "leetcode", "api_url")}/solved`, 60_000));
  const counts = ["solvedProblem", "easySolved", "mediumSolved", "hardSolved"];
  check(
    counts.every((key) => isCount(solved[key])) && Number(solved["solvedProblem"]) > 0,
    "LeetCode solved",
  );
  const { totalSubmissionNum, acSubmissionNum } = solved;
  check(Array.isArray(totalSubmissionNum) && Array.isArray(acSubmissionNum), "LeetCode submissions");
  return {
    solved: {
      ...Object.fromEntries(counts.map((key) => [key, solved[key]])),
      totalSubmissionNum,
      acSubmissionNum,
    },
  };
}

const SOURCES = { wakatime, githubCommits, githubProfile, leetcode };

function isSourceName(name: string): name is keyof typeof SOURCES {
  return Object.hasOwn(SOURCES, name);
}

function errorMessage(error: unknown): unknown {
  return toRecord(error)["message"];
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

function warn(message: string): void {
  // "::warning::" shows up on the GitHub Actions run page.
  log(`${process.env["GITHUB_ACTIONS"] === "true" ? "::warning::" : "warning: "}${message}`);
}

// Prettier keeps the file passing `npm run format:check`; plain JSON will do without it.
async function serialize(data: unknown): Promise<string> {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  try {
    const prettier = await import("prettier");
    const options = await prettier.resolveConfig(SNAPSHOT_FILE);
    return await prettier.format(json, { ...options, filepath: SNAPSHOT_FILE });
  } catch {
    return json;
  }
}

async function refresh(): Promise<number> {
  const snapshot = requireRecord(JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")), "bundled snapshot");
  const page = requireRecord(JSON.parse(await readFile(STATS_PAGE_FILE, "utf8")), "pages/stats.json");
  const sections = requireRecord(toRecord(toRecord(page["locales"])["en"])["sections"], "stats sections");
  // The build rejects a snapshot that does not match its schema, so one is never written.
  const { statsSnapshotSourceSchemas: schemas } = await import("../src/lib/content-schema.ts");
  const names = Object.keys(SOURCES).filter(isSourceName);
  const results = await Promise.allSettled(
    names.map(async (name) => {
      const fresh = { generatedAt: new Date().toISOString(), ...(await SOURCES[name](sections)) };
      // Checked as it will be read back: JSON drops undefined fields.
      const result = schemas[name].safeParse(JSON.parse(JSON.stringify(fresh)));
      check(
        result.success,
        result.error?.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") ?? "schema",
      );
      return { name, fresh };
    }),
  );

  let refreshed = 0;
  results.forEach((result, index) => {
    const name = String(names[index]);
    if (result.status === "fulfilled") {
      snapshot[name] = result.value.fresh;
      refreshed += 1;
      log(`${name}: refreshed`);
    } else {
      const previous = String(toRecord(snapshot[name])["generatedAt"]);
      warn(`${name}: kept the snapshot from ${previous} (${String(errorMessage(result.reason))})`);
    }
  });

  if (refreshed > 0) {
    await writeFile(TEMPORARY_FILE, await serialize(snapshot), "utf8");
    await rename(TEMPORARY_FILE, SNAPSHOT_FILE);
  }
  log(`${String(refreshed)} of ${String(names.length)} sources refreshed`);
  return 0;
}

async function main(): Promise<number> {
  onStopSignal((_signal, exitCode) => {
    rmSync(TEMPORARY_FILE, { force: true });
    process.exit(exitCode);
  });
  try {
    return await refresh();
  } catch (error) {
    rmSync(TEMPORARY_FILE, { force: true });
    warn(`stats snapshot left as it was (${String(errorMessage(error) ?? error)})`);
    return 1;
  }
}

await runCli({ name: "refresh-stats-snapshots.ts", help: HELP, flags: [] }, main);
