import {
  addUtcDays,
  dateKey,
  formatDate,
  formatNumber,
  parseDateOnly,
  toSafeNumber,
  toUtcDateOnly,
} from "./stats-utils";
import { personPortfolioSnapshots } from "./stats-snapshots";

interface RawContribution {
  readonly date?: unknown;
  readonly count?: unknown;
}

interface GitHubContributionPayload {
  readonly total?: Record<string, unknown>;
  readonly contributions?: readonly RawContribution[];
}

interface GitHubCacheEnvelope {
  readonly cachedAt?: unknown;
  readonly payload?: unknown;
}

interface GitHubCacheEntry {
  readonly payload: GitHubContributionPayload;
  readonly isFresh: boolean;
}

interface NormalizedContribution {
  readonly date: Date;
  readonly count: number;
}

interface HeatmapDay {
  readonly week: number;
  readonly day: number;
  readonly date: Date;
  readonly count: number;
  readonly isFuture: boolean;
}

const WEEKS_TO_SHOW = 53;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HEATMAP_SCALE = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] as const;
const SVG_NS = "http://www.w3.org/2000/svg";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asPayload(value: unknown): GitHubContributionPayload {
  return isRecord(value) ? (value as GitHubContributionPayload) : {};
}

function asElement<T extends Element>(value: T | null): T | null {
  return value instanceof Element ? value : null;
}

document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>("[data-github-commits-widget]");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const apiUrl = widget.getAttribute("data-github-contrib-url") ?? "";
  const statusEl = asElement(widget.querySelector<HTMLElement>('[data-role="status"]'));
  const visualsEl = asElement(widget.querySelector<HTMLElement>('[data-role="visuals"]'));
  const summaryEl = asElement(widget.querySelector<HTMLElement>('[data-role="summary-cards"]'));
  const heatmapEl = asElement(widget.querySelector<HTMLElement>('[data-role="heatmap"]'));
  const legendEl = asElement(widget.querySelector<HTMLElement>('[data-role="legend"]'));

  const cacheKey = `person-portfolio:github-commits:v1:${encodeURIComponent(apiUrl)}`;

  let resizeRafId = 0;

  const setStatus = (message: string, isError: boolean): void => {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
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

  const getStaticSnapshot = (): GitHubContributionPayload | null => {
    return isRecord(personPortfolioSnapshots.githubCommits)
      ? (personPortfolioSnapshots.githubCommits as GitHubContributionPayload)
      : null;
  };

  const readCacheEntry = (): GitHubCacheEntry | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as GitHubCacheEnvelope;
      if (!isRecord(parsed)) {
        return null;
      }

      const cachedAt = toSafeNumber(parsed.cachedAt);
      const payload = asPayload(parsed.payload);
      const ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      const isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= CACHE_TTL_MS;

      return { payload, isFresh };
    } catch {
      return null;
    }
  };

  const writeCache = (payload: GitHubContributionPayload): void => {
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

  const normalizeContributions = (
    payload: GitHubContributionPayload,
    todayUtc: Date,
  ): NormalizedContribution[] => {
    const raw = Array.isArray(payload.contributions) ? payload.contributions : [];
    const normalized: NormalizedContribution[] = [];

    raw.forEach((item) => {
      const date = parseDateOnly(item?.date);
      if (!(date instanceof Date) || date.getTime() > todayUtc.getTime()) {
        return;
      }

      normalized.push({
        date,
        count: Math.max(0, Math.round(toSafeNumber(item?.count))),
      });
    });

    normalized.sort((left, right) => left.date.getTime() - right.date.getTime());
    return normalized;
  };

  const mapContributionsByDate = (items: readonly NormalizedContribution[]): Record<string, number> => {
    const byDate: Record<string, number> = Object.create(null);
    items.forEach((item) => {
      byDate[dateKey(item.date)] = item.count;
    });
    return byDate;
  };

  const totalContributionsByYear = (payload: GitHubContributionPayload): number => {
    const yearlyTotals = isRecord(payload.total) ? payload.total : {};
    return Object.keys(yearlyTotals).reduce((sum, year) => {
      return sum + Math.max(0, Math.round(toSafeNumber(yearlyTotals[year])));
    }, 0);
  };

  const sumLastDays = (byDate: Readonly<Record<string, number>>, todayUtc: Date, days: number): number => {
    let total = 0;
    for (let offset = 0; offset < days; offset += 1) {
      const day = addUtcDays(todayUtc, -offset);
      total += toSafeNumber(byDate[dateKey(day)]);
    }
    return total;
  };

  const mostActiveDay = (items: readonly NormalizedContribution[]): NormalizedContribution | null => {
    return items.reduce<NormalizedContribution | null>((best, item) => {
      if (!best || item.count > best.count) {
        return item;
      }
      return best;
    }, null);
  };

  const buildHeatmapDays = (byDate: Readonly<Record<string, number>>, todayUtc: Date): HeatmapDay[] => {
    const currentWeekStart = addUtcDays(todayUtc, -todayUtc.getUTCDay());
    const firstWeekStart = addUtcDays(currentWeekStart, -(WEEKS_TO_SHOW - 1) * 7);
    const days: HeatmapDay[] = [];

    for (let week = 0; week < WEEKS_TO_SHOW; week += 1) {
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = addUtcDays(firstWeekStart, week * 7 + dayIndex);
        const isFuture = date.getTime() > todayUtc.getTime();
        const count = isFuture ? 0 : toSafeNumber(byDate[dateKey(date)]);

        days.push({ week, day: dayIndex, date, count, isFuture });
      }
    }

    return days;
  };

  const levelFromCount = (count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 => {
    if (count <= 0 || maxCount <= 0) {
      return 0;
    }
    if (count >= maxCount * 0.75) {
      return 4;
    }
    if (count >= maxCount * 0.5) {
      return 3;
    }
    if (count >= maxCount * 0.25) {
      return 2;
    }
    return 1;
  };

  const summaryItem = (label: string, value: string): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = "github-commits-card";

    const title = document.createElement("div");
    title.className = "github-commits-card-label";
    title.textContent = label;

    const text = document.createElement("div");
    text.className = "github-commits-card-value";
    text.textContent = value;

    card.appendChild(title);
    card.appendChild(text);
    return card;
  };

  const renderSummary = (
    payload: GitHubContributionPayload,
    items: readonly NormalizedContribution[],
    byDate: Readonly<Record<string, number>>,
    todayUtc: Date,
  ): void => {
    if (!(summaryEl instanceof HTMLElement)) {
      return;
    }

    const currentYear = String(todayUtc.getUTCFullYear());
    const yearlyTotals = isRecord(payload.total) ? payload.total : {};
    const currentYearTotal = toSafeNumber(yearlyTotals[currentYear]);
    const allTimeTotal = totalContributionsByYear(payload);
    const last30Days = sumLastDays(byDate, todayUtc, 30);
    const best = mostActiveDay(items);

    summaryEl.innerHTML = "";
    summaryEl.appendChild(summaryItem("All-time contributions", formatNumber(allTimeTotal)));
    summaryEl.appendChild(summaryItem(`${currentYear} contributions`, formatNumber(currentYearTotal)));
    summaryEl.appendChild(summaryItem("Last 30 days", formatNumber(last30Days)));
    summaryEl.appendChild(
      summaryItem(
        "Most active day",
        best ? `${formatNumber(best.count)} on ${formatDate(best.date)}` : "n/a",
      ),
    );
  };

  const renderLegend = (): void => {
    if (!(legendEl instanceof HTMLElement)) {
      return;
    }

    legendEl.innerHTML = "";

    const less = document.createElement("span");
    less.className = "github-heatmap-legend-label";
    less.textContent = "Less";
    legendEl.appendChild(less);

    HEATMAP_SCALE.forEach((color, level) => {
      const swatch = document.createElement("span");
      swatch.className = "github-heatmap-legend-swatch";
      swatch.style.backgroundColor = color;
      swatch.dataset.level = String(level);
      legendEl.appendChild(swatch);
    });

    const more = document.createElement("span");
    more.className = "github-heatmap-legend-label";
    more.textContent = "More";
    legendEl.appendChild(more);
  };

  const renderHeatmap = (days: readonly HeatmapDay[]): void => {
    if (!(heatmapEl instanceof HTMLElement)) {
      return;
    }

    heatmapEl.innerHTML = "";
    const weekCount =
      days.reduce((max, day) => Math.max(max, day.week), 0) + 1;
    heatmapEl.setAttribute("data-week-count", String(Math.max(1, weekCount)));

    const maxCount = days.reduce((max, day) => (day.isFuture ? max : Math.max(max, day.count)), 0);

    days.forEach((day) => {
      const dot = document.createElement("span");
      dot.className = "github-heatmap-dot";

      if (day.isFuture) {
        dot.classList.add("is-future");
        dot.style.backgroundColor = "transparent";
      } else {
        const level = levelFromCount(day.count, maxCount);
        const color = HEATMAP_SCALE[level] ?? "#ebedf0";
        const label = `${formatNumber(day.count)} contributions on ${formatDate(day.date)}`;

        dot.style.backgroundColor = color;
        dot.dataset.level = String(level);
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", label);
        dot.title = label;
      }

      heatmapEl.appendChild(dot);
    });

    renderMonthLabels(days);
  };

  // Month names pencilled above the first week of each month, on the same grid as the dots.
  const renderMonthLabels = (days: readonly HeatmapDay[]): void => {
    const scrollWrap = heatmapEl?.parentElement;
    if (!(heatmapEl instanceof HTMLElement) || !(scrollWrap instanceof HTMLElement)) {
      return;
    }
    let monthsEl = scrollWrap.querySelector<HTMLElement>(".github-heatmap-months");
    if (!monthsEl) {
      monthsEl = document.createElement("div");
      monthsEl.className = "github-heatmap-months";
      monthsEl.setAttribute("aria-hidden", "true");
      scrollWrap.insertBefore(monthsEl, heatmapEl);
    }
    monthsEl.innerHTML = "";

    const monthFormat = new Intl.DateTimeFormat(document.documentElement.lang || "en", {
      month: "short",
      timeZone: "UTC",
    });
    let lastMonth = -1;
    let lastWeek = -10;
    let lastLabel: HTMLSpanElement | null = null;
    days
      .filter((day) => day.day === 0)
      .forEach((day) => {
        const month = day.date.getUTCMonth();
        if (month === lastMonth) {
          return;
        }
        lastMonth = month;
        if (day.week - lastWeek < 3) {
          // A sliver of a month at the start gives way to the next full one.
          lastLabel?.remove();
        }
        lastWeek = day.week;
        const label = document.createElement("span");
        label.className = "github-heatmap-month";
        label.style.gridColumn = String(day.week + 1);
        label.textContent = monthFormat.format(day.date);
        monthsEl?.appendChild(label);
        lastLabel = label;
      });
  };

  const fitHeatmapToContainer = (): void => {
    if (!(heatmapEl instanceof HTMLElement)) {
      return;
    }

    const scrollWrap = heatmapEl.parentElement;
    if (!(scrollWrap instanceof HTMLElement)) {
      return;
    }

    const availableWidth = scrollWrap.clientWidth;
    if (!(availableWidth > 0)) {
      return;
    }

    const weekCount = Math.max(
      1,
      Math.round(toSafeNumber(heatmapEl.getAttribute("data-week-count"))),
    );
    const gapPx = 3;
    const totalGap = (weekCount - 1) * gapPx;
    const computedCell = Math.floor((availableWidth - totalGap) / weekCount);
    // Keep contribution cells readable on mobile and allow horizontal scroll when needed.
    const cellSize = Math.max(8, Math.min(16, computedCell));

    // Set on the scroll box so the month row shares the dot grid.
    scrollWrap.style.setProperty("--github-heatmap-gap", `${gapPx}px`);
    scrollWrap.style.setProperty("--github-heatmap-cell", `${cellSize}px`);
    // When the year doesn't fit, start at the most recent weeks.
    if (scrollWrap.scrollWidth > scrollWrap.clientWidth) {
      scrollWrap.scrollLeft = document.documentElement.dir === "rtl" ? -scrollWrap.scrollWidth : scrollWrap.scrollWidth;
    }
  };

  const scheduleHeatmapFit = (): void => {
    if (resizeRafId !== 0) {
      return;
    }

    resizeRafId = window.requestAnimationFrame(() => {
      resizeRafId = 0;
      fitHeatmapToContainer();
      const yearlyEl = widget.querySelector<HTMLElement>('[data-role="yearly-chart"]');
      if (yearlyPayload && yearlyEl && Math.abs(yearlyEl.clientWidth - yearlyWidth) > 8) {
        renderYearlyChart(yearlyPayload, false);
      }
    });
  };

  let yearlyPayload: GitHubContributionPayload | null = null;
  let yearlyWidth = 0;

  // Deterministic wobble so the "hand-drawn" bars don't jump between renders.
  const jitter = (seed: number, amount: number): number => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return (x - Math.floor(x) - 0.5) * 2 * amount;
  };

  const svgNode = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Readonly<Record<string, string>>,
  ): SVGElementTagNameMap[K] => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    return el;
  };

  /** A pencilled rectangle: corners nudged a little, sides bowed a hair. */
  const sketchedBarPath = (x: number, y: number, w: number, h: number, seed: number): string => {
    const j = (n: number, amount = 1.2): string => jitter(seed + n, amount).toFixed(2);
    const bottom = y + h;
    return [
      `M ${(x + Number(j(1))).toFixed(2)} ${bottom.toFixed(2)}`,
      `Q ${(x - 0.8).toFixed(2)} ${(y + h / 2).toFixed(2)} ${(x + Number(j(2))).toFixed(2)} ${(y + Number(j(3))).toFixed(2)}`,
      `Q ${(x + w / 2).toFixed(2)} ${(y - 1 + Number(j(4, 0.8))).toFixed(2)} ${(x + w + Number(j(5))).toFixed(2)} ${(y + Number(j(6))).toFixed(2)}`,
      `Q ${(x + w + 0.8).toFixed(2)} ${(y + h / 2).toFixed(2)} ${(x + w + Number(j(7))).toFixed(2)} ${bottom.toFixed(2)}`,
    ].join(" ");
  };

  const renderYearlyChart = (payload: GitHubContributionPayload, animate = true): void => {
    const yearlyEl = widget.querySelector<HTMLElement>('[data-role="yearly-chart"]');
    if (!(yearlyEl instanceof HTMLElement)) {
      return;
    }
    yearlyPayload = payload;

    const yearlyTotals = isRecord(payload.total) ? payload.total : {};
    const entries = Object.entries(yearlyTotals)
      .map(([year, count]) => ({ year, count: Math.max(0, Math.round(toSafeNumber(count))) }))
      .sort((a, b) => Number(a.year) - Number(b.year));

    if (entries.length === 0) {
      yearlyEl.innerHTML = "";
      return;
    }

    // Drawn at the real pixel size so text stays a readable size at every width.
    const width = Math.max(entries.length * 34, Math.round(yearlyEl.clientWidth || 640));
    yearlyWidth = width;
    const compact = width < 560;
    const height = compact ? 190 : 230;
    const top = 34;
    const baseY = height - 34;
    const barMaxH = baseY - top;
    const padX = compact ? 20 : 12;
    const colW = (width - padX * 2) / entries.length;
    const barW = Math.min(52, colW * 0.58);
    const maxCount = entries.reduce((max, e) => Math.max(max, e.count), 0);
    const peakIndex = entries.findIndex((e) => e.count === maxCount);
    const currentYear = String(new Date().getUTCFullYear());

    const svg = svgNode("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width: String(width),
      height: String(height),
      class: animate ? "github-yearly-chart is-drawing" : "github-yearly-chart",
      role: "img",
      "aria-label": `Contributions per year: ${entries.map((e) => `${e.year} ${formatNumber(e.count)}`).join(", ")}`,
    });

    const defs = svgNode("defs", {});
    for (const tone of ["sage", "ox"]) {
      // Pattern contents don't inherit from the bar using them, so each tone gets its own.
      const hatch = svgNode("pattern", {
        id: `gh-yearly-hatch-${tone}`,
        patternUnits: "userSpaceOnUse",
        width: "5",
        height: "5",
        patternTransform: "rotate(38)",
      });
      hatch.appendChild(
        svgNode("line", { x1: "0", y1: "0", x2: "0", y2: "5", class: `github-yearly-hatch github-yearly-hatch--${tone}` }),
      );
      defs.appendChild(hatch);
    }
    svg.appendChild(defs);

    entries.forEach((entry, index) => {
      const barH = maxCount > 0 ? Math.max(4, (entry.count / maxCount) * barMaxH) : 4;
      const cx = padX + index * colW + colW / 2;
      const barX = cx - barW / 2;
      const barY = baseY - barH;
      const d = sketchedBarPath(barX, barY, barW, barH, index * 7 + 3);

      const classes = ["github-yearly-col"];
      if (entry.year === currentYear) classes.push("is-current");
      if (index === peakIndex) classes.push("is-peak");
      const col = svgNode("g", { class: classes.join(" ") });
      col.style.setProperty("--i", String(index));

      const title = svgNode("title", {});
      title.textContent = `${entry.year}: ${formatNumber(entry.count)} contributions`;
      col.appendChild(title);

      const bar = svgNode("g", { class: "github-yearly-bar" });
      bar.appendChild(svgNode("path", { d: `${d} Z`, class: "github-yearly-wash" }));
      bar.appendChild(svgNode("path", { d: `${d} Z`, class: "github-yearly-hatchfill", fill: `url(#gh-yearly-hatch-${entry.year === currentYear ? "ox" : "sage"})` }));
      bar.appendChild(svgNode("path", { d, class: "github-yearly-outline" }));
      col.appendChild(bar);

      const label = svgNode("text", {
        x: cx.toFixed(1),
        y: (barY - 9).toFixed(1),
        "text-anchor": "middle",
        class: "github-yearly-label",
      });
      label.textContent = formatNumber(entry.count);
      col.appendChild(label);

      if (index === peakIndex && maxCount > 0) {
        // Pencil loop around the best year's number.
        const rx = Math.max(20, label.textContent.length * 5.2);
        col.appendChild(
          svgNode("ellipse", {
            cx: (cx + 1).toFixed(1),
            cy: (barY - 14).toFixed(1),
            rx: rx.toFixed(1),
            ry: "13",
            transform: `rotate(-4 ${cx.toFixed(1)} ${(barY - 14).toFixed(1)})`,
            class: "github-yearly-ring",
          }),
        );
      }

      const year = svgNode("text", {
        x: cx.toFixed(1),
        y: (baseY + 24).toFixed(1),
        "text-anchor": "middle",
        class: "github-yearly-year",
      });
      year.textContent = compact && entries.length > 6 ? `'${entry.year.slice(2)}` : entry.year;
      col.appendChild(year);

      svg.appendChild(col);
    });

    // Ruled baseline, drawn freehand.
    const wobble = [0, 0.25, 0.5, 0.75, 1]
      .map((t, i) => `${i === 0 ? "M" : "L"} ${(t * width).toFixed(1)} ${(baseY + 0.5 + jitter(i + 40, 0.9)).toFixed(2)}`)
      .join(" ");
    svg.appendChild(svgNode("path", { d: wobble, class: "github-yearly-baseline" }));

    yearlyEl.innerHTML = "";
    yearlyEl.appendChild(svg);
  };

  const render = (payload: GitHubContributionPayload, statusMessage: string): void => {
    const todayUtc = toUtcDateOnly(new Date());
    const items = normalizeContributions(payload, todayUtc);
    const byDate = mapContributionsByDate(items);
    const days = buildHeatmapDays(byDate, todayUtc);

    renderSummary(payload, items, byDate, todayUtc);
    renderYearlyChart(payload);
    renderHeatmap(days);
    fitHeatmapToContainer();
    renderLegend();

    if (visualsEl instanceof HTMLElement) {
      visualsEl.hidden = false;
    }

    setStatus(statusMessage || "Updated from live GitHub contribution data.", false);
  };

  const renderStaticSnapshot = (): boolean => {
    const snapshot = getStaticSnapshot();
    if (!snapshot) {
      return false;
    }

    try {
      render(snapshot, "Showing bundled GitHub snapshot.");
      return true;
    } catch {
      return false;
    }
  };

  const renderCacheEntry = (cacheEntry: GitHubCacheEntry): boolean => {
    try {
      render(
        cacheEntry.payload,
        cacheEntry.isFresh
          ? "Showing cached GitHub contribution data."
          : "Showing stale cached GitHub contribution data.",
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

  window.addEventListener("resize", scheduleHeatmapFit, { passive: true });

  if (cacheEntry) {
    hasRenderedCache = renderCacheEntry(cacheEntry);
    hasFreshCache = hasRenderedCache && cacheEntry.isFresh;
  }

  if (hasFreshCache) {
    return;
  }

  fetchJsonWithTimeout(apiUrl, 12_000)
    .then((payload) => {
      const safePayload = asPayload(payload);
      writeCache(safePayload);
      render(safePayload, "Updated from live GitHub contribution data.");
    })
    .catch(() => {
      if (hasRenderedCache) {
        setStatus("Live GitHub refresh failed. Showing cached GitHub contribution data.", false);
        return;
      }

      if (hasStaticSnapshot) {
        setStatus("Live GitHub refresh failed. Showing bundled GitHub snapshot.", false);
        return;
      }

      if (visualsEl instanceof HTMLElement) {
        visualsEl.hidden = true;
      }

      setStatus("Could not load GitHub contribution data right now.", true);
    });
});
