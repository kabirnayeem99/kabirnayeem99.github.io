import { isRecord, toArray, toRecord, hasText } from "./guards";
import { personPortfolioSnapshots } from "./stats-snapshots";
import { liveStatus, refreshFailedStatus, savedStatus, unavailableStatus, type SavedFigures } from "./stats-status";

/** The API response; every field is checked where it is read. */
interface RawSolvedPayload {
  readonly solvedProblem?: unknown;
  readonly easySolved?: unknown;
  readonly mediumSolved?: unknown;
  readonly hardSolved?: unknown;
  readonly totalSubmissionNum?: unknown;
  readonly acSubmissionNum?: unknown;
}

interface LeetCodePayload {
  readonly solved: RawSolvedPayload;
}

interface LeetCodeCacheEntry {
  readonly payload: LeetCodePayload;
  readonly isFresh: boolean;
  readonly cachedAt: number;
}

interface NormalizedStats {
  readonly totalSolved: number;
  readonly easySolved: number;
  readonly mediumSolved: number;
  readonly hardSolved: number;
  readonly acceptanceRate: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function toSafeNumber(value: unknown): number {
  const num = Number(value);
  return isFinite(num) ? num : 0;
}

document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>("[data-leetcode-widget]");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const apiUrl = widget.getAttribute("data-leetcode-api-url") ?? "";
  const statusEl = widget.querySelector<HTMLElement>('[data-role="status"]');
  const visualsEl = widget.querySelector<HTMLElement>('[data-role="visuals"]');
  const summaryEl = widget.querySelector<HTMLElement>('[data-role="summary-cards"]');
  const difficultyEl = widget.querySelector<HTMLElement>('[data-role="difficulty"]');

  const cacheKey = `person-portfolio:leetcode:v1:${encodeURIComponent(apiUrl)}`;

  const setStatus = (message: string, isError: boolean): void => {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = message.length === 0;
  };

  const fetchJsonWithTimeout = async (url: string, timeoutMs: number): Promise<unknown> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, {
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const computeAcceptanceRate = (solved: RawSolvedPayload): number => {
    const findAll = (counts: unknown) =>
      toArray(counts)
        .filter(isRecord)
        .find((entry) => String(entry["difficulty"]).toLowerCase() === "all");
    const total = toSafeNumber(findAll(solved.totalSubmissionNum)?.["submissions"]);
    const accepted = toSafeNumber(findAll(solved.acSubmissionNum)?.["submissions"]);
    if (total <= 0) {
      return 0;
    }
    return Math.round((accepted / total) * 1000) / 10;
  };

  const normalizeStats = (payload: LeetCodePayload): NormalizedStats => ({
    totalSolved: toSafeNumber(payload.solved.solvedProblem),
    easySolved: toSafeNumber(payload.solved.easySolved),
    mediumSolved: toSafeNumber(payload.solved.mediumSolved),
    hardSolved: toSafeNumber(payload.solved.hardSolved),
    acceptanceRate: computeAcceptanceRate(payload.solved),
  });

  const formatNumber = (n: number): string =>
    n > 0 ? n.toLocaleString("en-US") : "n/a";

  const summaryCard = (label: string, value: string, modifier?: string): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = hasText(modifier) ? `leetcode-card leetcode-card--${modifier}` : "leetcode-card";

    const title = document.createElement("div");
    title.className = "leetcode-card-label";
    title.textContent = label;

    const text = document.createElement("div");
    text.className = "leetcode-card-value";
    text.textContent = value;

    card.appendChild(title);
    card.appendChild(text);
    return card;
  };

  const renderSummaryCards = (stats: NormalizedStats): void => {
    if (!(summaryEl instanceof HTMLElement)) {
      return;
    }
    summaryEl.innerHTML = "";
    summaryEl.appendChild(summaryCard("Solved", formatNumber(stats.totalSolved)));
    summaryEl.appendChild(summaryCard("Easy", formatNumber(stats.easySolved), "easy"));
    summaryEl.appendChild(summaryCard("Medium", formatNumber(stats.mediumSolved), "medium"));
    summaryEl.appendChild(summaryCard("Hard", formatNumber(stats.hardSolved), "hard"));
    if (stats.acceptanceRate > 0) {
      summaryEl.appendChild(summaryCard("Acceptance", `${stats.acceptanceRate}%`));
    }
  };

  const renderDifficulty = (stats: NormalizedStats): void => {
    if (!(difficultyEl instanceof HTMLElement)) {
      return;
    }

    const total = stats.easySolved + stats.mediumSolved + stats.hardSolved;
    if (total <= 0) {
      return;
    }

    difficultyEl.innerHTML = "";

    const bar = document.createElement("div");
    bar.className = "leetcode-difficulty-bar";
    bar.setAttribute(
      "aria-label",
      `Difficulty breakdown: ${stats.easySolved} easy, ${stats.mediumSolved} medium, ${stats.hardSolved} hard`,
    );

    const segments: readonly { readonly count: number; readonly cls: string; readonly label: string }[] = [
      { count: stats.easySolved, cls: "easy", label: "Easy" },
      { count: stats.mediumSolved, cls: "medium", label: "Medium" },
      { count: stats.hardSolved, cls: "hard", label: "Hard" },
    ];

    segments.forEach(({ count, cls }) => {
      if (count <= 0) {
        return;
      }
      const seg = document.createElement("span");
      seg.className = `leetcode-difficulty-segment leetcode-difficulty-segment--${cls}`;
      const share = count / total;
      seg.style.width = `${(share * 100).toFixed(2)}%`;
      if (share >= 0.08) {
        seg.textContent = formatNumber(count);
      }
      bar.appendChild(seg);
    });

    difficultyEl.appendChild(bar);

    const legend = document.createElement("div");
    legend.className = "leetcode-difficulty-legend";

    segments.forEach(({ count, cls, label }) => {
      const item = document.createElement("span");
      item.className = `leetcode-difficulty-legend-item leetcode-difficulty-legend-item--${cls}`;

      const swatch = document.createElement("span");
      swatch.className = "leetcode-difficulty-swatch";

      const text = document.createElement("span");
      text.textContent = `${label} · ${formatNumber(count)}`;

      item.appendChild(swatch);
      item.appendChild(text);
      legend.appendChild(item);
    });

    difficultyEl.appendChild(legend);
  };

  const render = (payload: LeetCodePayload, statusMessage: string): void => {
    const stats = normalizeStats(payload);
    if (stats.totalSolved <= 0) {
      throw new Error("No LeetCode data available");
    }
    renderSummaryCards(stats);
    renderDifficulty(stats);
    if (visualsEl instanceof HTMLElement) {
      visualsEl.hidden = false;
    }
    setStatus(statusMessage, false);
  };

  const getStaticSnapshot = (): LeetCodePayload | null => {
    const snap = personPortfolioSnapshots.leetcode;
    if (!isRecord(snap)) {
      return null;
    }
    return { solved: toRecord(snap.solved) };
  };

  const readCacheEntry = (): LeetCodeCacheEntry | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!hasText(raw)) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return null;
      }
      const cachedAt = toSafeNumber(parsed["cachedAt"]);
      const p = parsed["payload"];
      if (!isRecord(p)) {
        return null;
      }
      const ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      const isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= CACHE_TTL_MS;
      return {
        payload: { solved: toRecord(p["solved"]) },
        isFresh,
        cachedAt,
      };
    } catch {
      return null;
    }
  };

  const writeCache = (payload: LeetCodePayload): void => {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({ cachedAt: Date.now(), payload }),
      );
    } catch {
      // localStorage may be unavailable or quota-limited.
    }
  };

  const snapshotFigures: SavedFigures = {
    kind: "snapshot",
    savedAt: personPortfolioSnapshots.leetcode.generatedAt,
  };

  const renderStaticSnapshot = (): boolean => {
    const snapshot = getStaticSnapshot();
    if (!snapshot) {
      return false;
    }
    try {
      render(snapshot, savedStatus("LeetCode", snapshotFigures));
      return true;
    } catch {
      return false;
    }
  };

  const renderCacheEntry = (entry: LeetCodeCacheEntry): boolean => {
    try {
      render(
        entry.payload,
        savedStatus("LeetCode", { kind: "cache", savedAt: entry.cachedAt }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const hasStaticSnapshot = renderStaticSnapshot();
  const cacheEntry = readCacheEntry();
  let hasRenderedCache = false;
  let hasFreshCache = false;

  if (cacheEntry) {
    hasRenderedCache = renderCacheEntry(cacheEntry);
    hasFreshCache = hasRenderedCache && cacheEntry.isFresh;
  }

  if (hasFreshCache) {
    return;
  }

  fetchJsonWithTimeout(`${apiUrl}/solved`, 10_000)
    .then((solvedData) => {
      const payload: LeetCodePayload = { solved: toRecord(solvedData) };
      writeCache(payload);
      render(payload, liveStatus("LeetCode"));
    })
    .catch(() => {
      if (cacheEntry && hasRenderedCache) {
        setStatus(refreshFailedStatus("LeetCode", { kind: "cache", savedAt: cacheEntry.cachedAt }), false);
        return;
      }
      if (hasStaticSnapshot) {
        setStatus(refreshFailedStatus("LeetCode", snapshotFigures), false);
        return;
      }
      if (visualsEl instanceof HTMLElement) {
        visualsEl.hidden = true;
      }
      setStatus(unavailableStatus("LeetCode"), true);
    });
});
