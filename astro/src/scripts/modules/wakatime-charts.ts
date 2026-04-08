import { formatDuration, formatPercent, toSafeNumber } from "./stats-utils";
import { personPortfolioSnapshots } from "./stats-snapshots";

interface RawLanguageItem {
  readonly name?: unknown;
  readonly percent?: unknown;
  readonly color?: unknown;
}

interface WakatimeLanguagePayload {
  readonly data?: readonly RawLanguageItem[];
}

interface WakatimeSummaryData {
  readonly best_day?: {
    readonly date?: unknown;
    readonly text?: unknown;
  };
  readonly grand_total?: {
    readonly total_seconds?: unknown;
    readonly total_seconds_including_other_language?: unknown;
    readonly human_readable_total?: unknown;
    readonly human_readable_total_including_other_language?: unknown;
    readonly human_readable_daily_average?: unknown;
    readonly human_readable_daily_average_including_other_language?: unknown;
  };
  readonly range?: {
    readonly start?: unknown;
    readonly end?: unknown;
  };
}

interface WakatimeSummaryPayload {
  readonly data?: WakatimeSummaryData;
}

interface WakatimeCachedPayload {
  readonly languagePayload: WakatimeLanguagePayload;
  readonly summaryPayload: WakatimeSummaryPayload;
}

interface WakatimeCacheEnvelope {
  readonly cachedAt?: unknown;
  readonly payload?: unknown;
}

interface WakatimeCacheEntry {
  readonly payload: WakatimeCachedPayload;
  readonly isFresh: boolean;
}

interface LanguageItem {
  readonly name: string;
  readonly percent: number;
  readonly color: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const EXCLUDED_LANGUAGE_NAMES: ReadonlySet<string> = new Set([
  "html",
  "xml",
  "gradle",
  "other",
  "markdown",
  "groovy",
  "yaml",
  "toml",
  "blade template",
  "css",
  "bash",
  "shell script",
  "zsh",
  "sh",
]);

const EXCLUDED_LANGUAGE_KEYWORDS = [
  "template",
  "config",
  "project",
  "properties",
  "gitignore",
  "text",
  "json",
  "svg",
  "image",
  "csv",
  "ini",
  "plist",
  "xcode",
  "cocoapods",
  "editorconfig",
  "asset catalog",
  "font",
  "module",
  "file",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asLanguagePayload(value: unknown): WakatimeLanguagePayload {
  return isRecord(value) ? (value as WakatimeLanguagePayload) : {};
}

function asSummaryPayload(value: unknown): WakatimeSummaryPayload {
  return isRecord(value) ? (value as WakatimeSummaryPayload) : {};
}

function formatDate(isoDate: unknown): string {
  const safeDate = typeof isoDate === "string" ? isoDate : "";
  return safeDate.length > 0 ? safeDate.slice(0, 10) : "n/a";
}

document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>("[data-wakatime-widget]");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const languagesUrl = widget.getAttribute("data-wakatime-languages-url") ?? "";
  const summaryUrl = widget.getAttribute("data-wakatime-summary-url") ?? "";
  const displayMode = widget.getAttribute("data-wakatime-display") === "compact" ? "compact" : "full";

  const statusEl = widget.querySelector<HTMLElement>('[data-role="status"]');
  const visualsEl = widget.querySelector<HTMLElement>('[data-role="visuals"]');
  const barsEl = widget.querySelector<HTMLOListElement>('[data-role="language-bars"]');
  const summaryEl = widget.querySelector<HTMLElement>('[data-role="summary-cards"]');
  const chipsEl = widget.querySelector<HTMLUListElement>('[data-role="language-chips"]');
  const topBarEl = widget.querySelector<HTMLDivElement>('[data-role="language-topbar"]');

  const cacheKey = `person-portfolio:wakatime:v1:${encodeURIComponent(languagesUrl)}:${encodeURIComponent(summaryUrl)}`;

  const normalizeLanguageName = (name: unknown): string => String(name ?? "").trim().toLowerCase();

  const shouldExcludeLanguage = (name: unknown): boolean => {
    const normalized = normalizeLanguageName(name);
    if (normalized.length === 0) {
      return true;
    }

    if (EXCLUDED_LANGUAGE_NAMES.has(normalized)) {
      return true;
    }

    return EXCLUDED_LANGUAGE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  };

  const setStatus = (message: string, isError: boolean): void => {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = message.length === 0;
  };

  const totalTrackedSeconds = (payload: WakatimeSummaryPayload): number => {
    const data = isRecord(payload.data) ? payload.data : {};
    const grandTotal = isRecord(data.grand_total) ? data.grand_total : {};

    return toSafeNumber(grandTotal.total_seconds_including_other_language ?? grandTotal.total_seconds);
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

  const fetchWakatime = (url: string): Promise<unknown> => {
    return fetchJsonWithTimeout(url, 10_000);
  };

  const getStaticSnapshot = (): WakatimeCachedPayload | null => {
    const snapshot = personPortfolioSnapshots.wakatime;
    if (!isRecord(snapshot)) {
      return null;
    }

    if (!isRecord(snapshot.languagePayload) || !isRecord(snapshot.summaryPayload)) {
      return null;
    }

    return {
      languagePayload: snapshot.languagePayload as WakatimeLanguagePayload,
      summaryPayload: snapshot.summaryPayload as WakatimeSummaryPayload,
    };
  };

  const readCacheEntry = (): WakatimeCacheEntry | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as WakatimeCacheEnvelope;
      if (!isRecord(parsed) || !isRecord(parsed.payload)) {
        return null;
      }

      const payload = parsed.payload;
      if (!isRecord(payload.languagePayload) || !isRecord(payload.summaryPayload)) {
        return null;
      }

      const cachedAt = toSafeNumber(parsed.cachedAt);
      const ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      const isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= CACHE_TTL_MS;

      return {
        payload: {
          languagePayload: payload.languagePayload as WakatimeLanguagePayload,
          summaryPayload: payload.summaryPayload as WakatimeSummaryPayload,
        },
        isFresh,
      };
    } catch {
      return null;
    }
  };

  const writeCache = (payload: WakatimeCachedPayload): void => {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          cachedAt: Date.now(),
          payload,
        }),
      );
    } catch {
      // localStorage may be unavailable or quota-limited.
    }
  };

  const normalizeLanguages = (payload: WakatimeLanguagePayload): LanguageItem[] => {
    const raw = Array.isArray(payload.data) ? payload.data : [];

    return raw
      .map((item): LanguageItem => ({
        name: String(item?.name ?? "Unknown"),
        percent: toSafeNumber(item?.percent),
        color: typeof item?.color === "string" && item.color.length > 0 ? item.color : "#6b7280",
      }))
      .filter((item) => item.percent > 0 && !shouldExcludeLanguage(item.name))
      .sort((left, right) => right.percent - left.percent);
  };

  const createLanguageRow = (item: LanguageItem, trackedSeconds: number): HTMLLIElement => {
    const row = document.createElement("li");
    row.className = "wakatime-bar-row";

    const head = document.createElement("div");
    head.className = "wakatime-bar-head";

    const name = document.createElement("span");
    name.className = "wakatime-name";

    const swatch = document.createElement("span");
    swatch.className = "wakatime-swatch";
    swatch.style.backgroundColor = item.color;

    const label = document.createElement("span");
    label.textContent = item.name;

    name.appendChild(swatch);
    name.appendChild(label);

    const metrics = document.createElement("span");
    metrics.className = "wakatime-metrics";

    const percent = document.createElement("span");
    percent.className = "wakatime-percent";
    percent.textContent = formatPercent(item.percent);
    metrics.appendChild(percent);

    if (trackedSeconds > 0) {
      const time = document.createElement("span");
      time.className = "wakatime-time";
      time.textContent = `~${formatDuration((trackedSeconds * item.percent) / 100)}`;
      metrics.appendChild(time);
    }

    head.appendChild(name);
    head.appendChild(metrics);

    const track = document.createElement("div");
    track.className = "wakatime-track";

    const fill = document.createElement("div");
    fill.className = "wakatime-fill";
    fill.style.width = `${Math.min(item.percent, 100)}%`;
    fill.style.backgroundColor = item.color;

    track.appendChild(fill);
    row.appendChild(head);
    row.appendChild(track);

    return row;
  };

  const renderLanguageCharts = (
    languages: readonly LanguageItem[],
    summaryPayload: WakatimeSummaryPayload,
  ): void => {
    if (!(barsEl instanceof HTMLOListElement)) {
      return;
    }

    barsEl.innerHTML = "";
    const trackedSeconds = totalTrackedSeconds(summaryPayload);

    languages.slice(0, 10).forEach((item) => {
      barsEl.appendChild(createLanguageRow(item, trackedSeconds));
    });
  };

  const renderLanguageChips = (languages: readonly LanguageItem[]): void => {
    if (!(chipsEl instanceof HTMLUListElement)) {
      return;
    }

    chipsEl.innerHTML = "";

    languages.slice(0, 14).forEach((item) => {
      const chip = document.createElement("li");
      chip.className = "wakatime-language-chip";

      const swatch = document.createElement("span");
      swatch.className = "wakatime-language-chip-swatch";
      swatch.style.backgroundColor = item.color;

      const name = document.createElement("span");
      name.textContent = item.name;

      chip.appendChild(swatch);
      chip.appendChild(name);
      chipsEl.appendChild(chip);
    });
  };

  const renderLanguageTopBar = (languages: readonly LanguageItem[]): void => {
    if (!(topBarEl instanceof HTMLDivElement)) {
      return;
    }

    const segments = languages.slice(0, 8);
    const total = segments.reduce((sum, item) => sum + item.percent, 0);
    if (total <= 0) {
      topBarEl.style.background = "transparent";
      return;
    }

    let offset = 0;
    const gradients = segments.map((item) => {
      const size = (item.percent / total) * 100;
      const start = offset;
      const end = Math.min(100, start + size);
      offset = end;
      return `${item.color} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    });

    topBarEl.style.background = `linear-gradient(90deg,${gradients.join(",")})`;
  };

  const summaryItem = (label: string, value: string): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = "wakatime-card";

    const title = document.createElement("div");
    title.className = "wakatime-card-label";
    title.textContent = label;

    const text = document.createElement("div");
    text.className = "wakatime-card-value";
    text.textContent = value || "n/a";

    card.appendChild(title);
    card.appendChild(text);
    return card;
  };

  const renderSummary = (payload: WakatimeSummaryPayload): void => {
    if (!(summaryEl instanceof HTMLElement)) {
      return;
    }

    const data = isRecord(payload.data) ? payload.data : {};
    const total = isRecord(data.grand_total) ? data.grand_total : {};
    const best = isRecord(data.best_day) ? data.best_day : {};
    const range = isRecord(data.range) ? data.range : {};

    summaryEl.innerHTML = "";
    summaryEl.appendChild(
      summaryItem(
        "Total coded",
        String(
          total.human_readable_total_including_other_language ??
            total.human_readable_total ??
            "n/a",
        ),
      ),
    );

    summaryEl.appendChild(
      summaryItem(
        "Daily average",
        String(
          total.human_readable_daily_average_including_other_language ??
            total.human_readable_daily_average ??
            "n/a",
        ),
      ),
    );

    summaryEl.appendChild(
      summaryItem(
        "Best day",
        `${String(best.text ?? "n/a")}${best.date ? ` · ${formatDate(best.date)}` : ""}`,
      ),
    );

    summaryEl.appendChild(
      summaryItem(
        "Tracking range",
        `${range.start ? formatDate(range.start) : "n/a"}${range.end ? ` to ${formatDate(range.end)}` : ""}`,
      ),
    );
  };

  const renderFromPayloads = (
    languagePayload: WakatimeLanguagePayload,
    summaryPayload: WakatimeSummaryPayload,
    statusMessage: string,
  ): void => {
    const languages = normalizeLanguages(languagePayload);
    if (languages.length === 0) {
      throw new Error("No language data available");
    }

    if (displayMode === "compact") {
      renderLanguageTopBar(languages);
      renderLanguageChips(languages);
      setStatus("", false);
    } else {
      renderLanguageCharts(languages, summaryPayload);
      renderSummary(summaryPayload);
      setStatus(statusMessage, false);
    }

    if (visualsEl instanceof HTMLElement) {
      visualsEl.hidden = false;
    }
  };

  const renderStaticSnapshot = (): boolean => {
    const snapshot = getStaticSnapshot();
    if (!snapshot) {
      return false;
    }

    try {
      renderFromPayloads(
        snapshot.languagePayload,
        snapshot.summaryPayload,
        "Showing bundled WakaTime snapshot.",
      );
      return true;
    } catch {
      return false;
    }
  };

  const renderCacheEntry = (cacheEntry: WakatimeCacheEntry): boolean => {
    try {
      renderFromPayloads(
        cacheEntry.payload.languagePayload,
        cacheEntry.payload.summaryPayload,
        cacheEntry.isFresh
          ? "Showing cached WakaTime data."
          : "Showing stale cached WakaTime data.",
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

  Promise.all([fetchWakatime(languagesUrl), fetchWakatime(summaryUrl)])
    .then((results) => {
      const languagePayload = asLanguagePayload(results[0]);
      const summaryPayload = asSummaryPayload(results[1]);

      const cachePayload: WakatimeCachedPayload = {
        languagePayload,
        summaryPayload,
      };

      writeCache(cachePayload);
      renderFromPayloads(languagePayload, summaryPayload, "Updated from WakaTime shared data.");
    })
    .catch(() => {
      if (hasRenderedCache) {
        setStatus("Live WakaTime refresh failed. Showing cached WakaTime data.", false);
        return;
      }

      if (hasStaticSnapshot) {
        setStatus("Live WakaTime refresh failed. Showing bundled WakaTime snapshot.", false);
        return;
      }

      setStatus("Could not load live WakaTime charts right now.", true);
      if (visualsEl instanceof HTMLElement) {
        visualsEl.hidden = true;
      }
    });
});
