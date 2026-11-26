// Refreshes src/data/stats-snapshots.json, the figures the stats page shows before (or instead
// of) its live requests. Run by the deploy workflow and by hand: `npm run stats:refresh`.
//
// It calls the same public endpoints as the browser (read from pages/stats.json), with no
// keys. Each source stands alone: one that fails or returns something unexpected keeps its
// previous figures and date. It always exits 0, so it can never stop a deploy.
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SNAPSHOT_FILE = fileURLToPath(new URL("../src/data/stats-snapshots.json", import.meta.url));
const STATS_PAGE_FILE = fileURLToPath(new URL("../src/data/site-content/pages/stats.json", import.meta.url));

// The heatmap shows 53 weeks; older days are left out to keep the bundle small.
const HEATMAP_DAYS = 53 * 7;
const TOP_REPOS = 6;

function check(condition, what) {
  if (!condition) {
    throw new Error(`unexpected response: ${what}`);
  }
}

const isCount = (value) => Number.isInteger(value) && value >= 0;

async function fetchJson(url, timeoutMs = 20_000) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "stats-snapshot-refresh" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  }
  return response.json();
}

async function wakatime({ wakatime: urls }) {
  const [languages, summary] = await Promise.all([fetchJson(urls.languages_url), fetchJson(urls.summary_url)]);
  const items = languages?.data;
  check(Array.isArray(items) && items.length > 0, "WakaTime languages");
  const { best_day: bestDay, grand_total: total, range } = summary?.data ?? {};
  check(total?.total_seconds > 0 && bestDay?.date && range?.start && range?.end, "WakaTime summary");
  return {
    languagePayload: {
      data: items.map(({ name, percent, color }) => {
        check(typeof name === "string" && Number.isFinite(percent), "WakaTime language");
        return { name, percent, color: color ?? "" };
      }),
    },
    summaryPayload: { data: { best_day: bestDay, grand_total: total, range } },
  };
}

async function githubCommits({ github_commits: urls }) {
  const { total, contributions } = await fetchJson(urls.contrib_url);
  check(total && Object.keys(total).length > 0 && Object.values(total).every(isCount), "contribution totals");
  check(Array.isArray(contributions) && contributions.length > 0, "contributions");
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - HEATMAP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const past = contributions
    .filter((day) => typeof day.date === "string" && isCount(day.count) && day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  check(past.length > 0, "contribution days");
  // The best day ever stays in, whatever its age: the page names it.
  const best = past.reduce((top, day) => (day.count > top.count ? day : top));
  return {
    total,
    contributions: past
      .filter((day) => day.date >= cutoff || day === best)
      .map(({ date, count, level }) => ({ date, count, level })),
  };
}

async function githubProfile({ github_profile: urls }) {
  const [rawRepos, prs, issues] = await Promise.all([
    fetchJson(urls.repos_api_url),
    fetchJson(urls.prs_api_url),
    fetchJson(urls.issues_api_url),
  ]);
  check(Array.isArray(rawRepos), "repositories");
  check(isCount(prs?.total_count) && isCount(issues?.total_count), "search counts");
  // Same selection as scripts/modules/github-profile.ts.
  const own = rawRepos
    .filter((repo) => repo.fork !== true && typeof repo.name === "string")
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
  check(own.length > 0, "own repositories");
  const languages = {};
  for (const { language } of own) {
    if (language) {
      languages[language] = (languages[language] ?? 0) + 1;
    }
  }
  return {
    repos: own.slice(0, TOP_REPOS).map((repo) => ({
      name: repo.name,
      description: repo.description ?? "",
      stars: repo.stargazers_count,
      language: repo.language ?? null,
      htmlUrl: repo.html_url,
    })),
    mergedPrs: prs.total_count,
    issuesOpened: issues.total_count,
    languages,
  };
}

async function leetcode({ leetcode: urls }) {
  // The API sleeps when idle and can take most of a minute to wake.
  const solved = await fetchJson(`${urls.api_url}/solved`, 60_000);
  const counts = ["solvedProblem", "easySolved", "mediumSolved", "hardSolved"];
  check(counts.every((key) => isCount(solved?.[key])) && solved.solvedProblem > 0, "LeetCode solved");
  check(Array.isArray(solved.totalSubmissionNum) && Array.isArray(solved.acSubmissionNum), "LeetCode submissions");
  return {
    solved: {
      ...Object.fromEntries(counts.map((key) => [key, solved[key]])),
      totalSubmissionNum: solved.totalSubmissionNum,
      acSubmissionNum: solved.acSubmissionNum,
    },
  };
}

const SOURCES = { wakatime, githubCommits, githubProfile, leetcode };

// Prettier keeps the file passing `npm run format:check`; plain JSON will do without it.
async function serialize(data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  try {
    const prettier = await import("prettier");
    const options = await prettier.resolveConfig(SNAPSHOT_FILE);
    return await prettier.format(json, { ...options, filepath: SNAPSHOT_FILE });
  } catch {
    return json;
  }
}

async function main() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8"));
  const sections = JSON.parse(await readFile(STATS_PAGE_FILE, "utf8")).locales.en.sections;
  const names = Object.keys(SOURCES);
  const results = await Promise.allSettled(names.map(async (name) => SOURCES[name](sections)));

  let refreshed = 0;
  results.forEach((result, index) => {
    const name = names[index];
    if (result.status === "fulfilled") {
      snapshot[name] = { generatedAt: new Date().toISOString(), ...result.value };
      refreshed += 1;
      console.log(`${name}: refreshed`);
    } else {
      // "::warning::" shows up on the GitHub Actions run page.
      console.log(`::warning::${name}: kept the snapshot from ${snapshot[name]?.generatedAt} (${result.reason?.message})`);
    }
  });

  if (refreshed > 0) {
    const temporary = `${SNAPSHOT_FILE}.tmp`;
    await writeFile(temporary, await serialize(snapshot), "utf8");
    await rename(temporary, SNAPSHOT_FILE);
  }
  console.log(`${refreshed} of ${names.length} sources refreshed`);
}

try {
  await main();
} catch (error) {
  console.log(`::warning::stats snapshot left as it was (${error?.message ?? error})`);
}
