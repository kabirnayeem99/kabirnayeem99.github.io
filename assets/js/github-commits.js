// @ts-check
/**
 * Renders a GitHub-style contribution heatmap with cache-first loading.
 *
 * Display order:
 * 1) bundled static snapshot (while loading local storage)
 * 2) localStorage cache (valid for 1 day; stale cache is shown until live refresh finishes)
 * 3) live API response (only when cache is invalid or missing)
 */
(function () {
  "use strict";

  /**
   * @typedef {{
   *   toSafeNumber: function(unknown): number,
   *   formatNumber: function(number): string,
   *   toUtcDateOnly: function(Date): Date,
   *   parseDateOnly: function(unknown): Date | null,
   *   addUtcDays: function(Date, number): Date,
   *   dateKey: function(Date): string,
   *   formatDate: function(Date): string
   * }} StatsUtils
   */

  /** @typedef {{ date?: unknown, count?: unknown, level?: unknown }} RawContribution */
  /** @typedef {{ total?: Record<string, unknown>, contributions?: RawContribution[] }} GitHubContributionPayload */
  /** @typedef {{ payload: GitHubContributionPayload, isFresh: boolean }} GitHubCacheEntry */
  /** @typedef {{ date: Date, count: number }} NormalizedContribution */
  /** @typedef {{ week: number, day: number, date: Date, count: number, isFuture: boolean }} HeatmapDay */
  /** @typedef {Window & { personPortfolioStatsUtils?: unknown, personPortfolioSnapshots?: unknown }} PortfolioWindow */

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  function isRecord(value) {
    return Boolean(value) && typeof value === "object";
  }

  /**
   * @returns {StatsUtils}
   */
  function createFallbackStatsUtils() {
    /** @param {unknown} value */
    function toSafeNumber(value) {
      var numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }

    /** @param {number} value */
    function formatNumber(value) {
      return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(toSafeNumber(value))));
    }

    /** @param {Date} date */
    function toUtcDateOnly(date) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }

    /** @param {unknown} value */
    function parseDateOnly(value) {
      if (typeof value !== "string" || !value) {
        return null;
      }

      var parsed = new Date(value + "T00:00:00Z");
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return toUtcDateOnly(parsed);
    }

    /** @param {Date} date @param {number} days */
    function addUtcDays(date, days) {
      var millisPerDay = 86400000;
      return new Date(date.getTime() + days * millisPerDay);
    }

    /** @param {Date} date */
    function dateKey(date) {
      return date.toISOString().slice(0, 10);
    }

    /** @param {Date} date */
    function formatDate(date) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return {
      toSafeNumber: toSafeNumber,
      formatNumber: formatNumber,
      toUtcDateOnly: toUtcDateOnly,
      parseDateOnly: parseDateOnly,
      addUtcDays: addUtcDays,
      dateKey: dateKey,
      formatDate: formatDate,
    };
  }

  /**
   * @returns {StatsUtils}
   */
  function getStatsUtils() {
    var root = /** @type {PortfolioWindow} */ (window).personPortfolioStatsUtils;
    if (isRecord(root)) {
      if (
        typeof root.toSafeNumber === "function" &&
        typeof root.formatNumber === "function" &&
        typeof root.toUtcDateOnly === "function" &&
        typeof root.parseDateOnly === "function" &&
        typeof root.addUtcDays === "function" &&
        typeof root.dateKey === "function" &&
        typeof root.formatDate === "function"
      ) {
        return /** @type {StatsUtils} */ (root);
      }
    }

    return createFallbackStatsUtils();
  }

  var widget = document.querySelector("[data-github-commits-widget]");
  if (!widget) {
    return;
  }

  var apiUrl = widget.getAttribute("data-github-contrib-url");
  /** @type {HTMLElement | null} */
  var statusEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="status"]'));
  /** @type {HTMLElement | null} */
  var visualsEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="visuals"]'));
  /** @type {HTMLElement | null} */
  var summaryEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="summary-cards"]'));
  /** @type {HTMLElement | null} */
  var heatmapEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="heatmap"]'));
  /** @type {HTMLElement | null} */
  var legendEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="legend"]'));

  var cacheTtlMs = 24 * 60 * 60 * 1000;
  var cacheKey =
    "person-portfolio:github-commits:v1:" + encodeURIComponent(String(apiUrl || ""));

  var statsUtils = getStatsUtils();
  var toSafeNumber = statsUtils.toSafeNumber;
  var formatNumber = statsUtils.formatNumber;
  var toUtcDateOnly = statsUtils.toUtcDateOnly;
  var parseDateOnly = statsUtils.parseDateOnly;
  var addUtcDays = statsUtils.addUtcDays;
  var dateKey = statsUtils.dateKey;
  var formatDate = statsUtils.formatDate;

  var staticSnapshot = getStaticSnapshot();

  var weeksToShow = 53;
  /** @type {string[]} */
  var greenScale = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  /**
   * @param {string} message
   * @param {boolean} isError
   * @returns {void}
   */
  function setStatus(message, isError) {
    if (!statusEl) {
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  /**
   * @param {string} url
   * @param {number} timeoutMs
   * @returns {Promise<unknown>}
   */
  function fetchJsonWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return fetch(url, {
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(function (response) {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .catch(function (error) {
        clearTimeout(timeoutId);
        throw error;
      });
  }

  /**
   * @returns {GitHubContributionPayload | null}
   */
  function getStaticSnapshot() {
    var rootSnapshot = /** @type {PortfolioWindow} */ (window).personPortfolioSnapshots;
    if (!isRecord(rootSnapshot) || !isRecord(rootSnapshot.githubCommits)) {
      return null;
    }

    return /** @type {GitHubContributionPayload} */ (rootSnapshot.githubCommits);
  }

  /**
   * @returns {GitHubCacheEntry | null}
   */
  function readCacheEntry() {
    try {
      var raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }

      var parsed = /** @type {unknown} */ (JSON.parse(raw));
      if (!isRecord(parsed)) {
        return null;
      }

      var cachedAt = toSafeNumber(parsed.cachedAt);

      if (!isRecord(parsed.payload)) {
        return null;
      }

      var ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      var isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= cacheTtlMs;

      return {
        payload: /** @type {GitHubContributionPayload} */ (parsed.payload),
        isFresh: isFresh,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * @param {GitHubContributionPayload} payload
   * @returns {void}
   */
  function writeCache(payload) {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          cachedAt: Date.now(),
          payload: payload,
        })
      );
    } catch (error) {
      // localStorage may be unavailable or quota-limited.
    }
  }

  /**
   * @param {GitHubContributionPayload} payload
   * @param {Date} todayUtc
   * @returns {NormalizedContribution[]}
   */
  function normalizeContributions(payload, todayUtc) {
    var raw = Array.isArray(payload.contributions) ? payload.contributions : [];
    /** @type {NormalizedContribution[]} */
    var normalized = [];

    raw.forEach(function (item) {
      var date = parseDateOnly(item.date);
      if (!date || date.getTime() > todayUtc.getTime()) {
        return;
      }

      normalized.push({
        date: date,
        count: Math.max(0, Math.round(toSafeNumber(item.count))),
      });
    });

    normalized.sort(function (left, right) {
      return left.date.getTime() - right.date.getTime();
    });

    return normalized;
  }

  /**
   * @param {NormalizedContribution[]} items
   * @returns {Record<string, number>}
   */
  function mapContributionsByDate(items) {
    /** @type {Record<string, number>} */
    var byDate = Object.create(null);

    items.forEach(function (item) {
      byDate[dateKey(item.date)] = item.count;
    });

    return byDate;
  }

  /**
   * @param {GitHubContributionPayload} payload
   * @returns {number}
   */
  function totalContributionsByYear(payload) {
    var yearlyTotals = isRecord(payload.total) ? payload.total : {};

    return Object.keys(yearlyTotals).reduce(function (sum, year) {
      return sum + Math.max(0, Math.round(toSafeNumber(yearlyTotals[year])));
    }, 0);
  }

  /**
   * @param {Record<string, number>} byDate
   * @param {Date} todayUtc
   * @param {number} days
   * @returns {number}
   */
  function sumLastDays(byDate, todayUtc, days) {
    var total = 0;

    for (var offset = 0; offset < days; offset += 1) {
      var day = addUtcDays(todayUtc, -offset);
      total += toSafeNumber(byDate[dateKey(day)]);
    }

    return total;
  }

  /**
   * @param {NormalizedContribution[]} items
   * @returns {NormalizedContribution | null}
   */
  function mostActiveDay(items) {
    return items.reduce(
      function (best, item) {
        if (!best || item.count > best.count) {
          return item;
        }
        return best;
      },
      /** @type {NormalizedContribution | null} */ (null)
    );
  }

  /**
   * @param {Record<string, number>} byDate
   * @param {Date} todayUtc
   * @returns {HeatmapDay[]}
   */
  function buildHeatmapDays(byDate, todayUtc) {
    var currentWeekStart = addUtcDays(todayUtc, -todayUtc.getUTCDay());
    var firstWeekStart = addUtcDays(currentWeekStart, -(weeksToShow - 1) * 7);
    /** @type {HeatmapDay[]} */
    var days = [];

    for (var week = 0; week < weeksToShow; week += 1) {
      for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        var date = addUtcDays(firstWeekStart, week * 7 + dayIndex);
        var isFuture = date.getTime() > todayUtc.getTime();
        var count = isFuture ? 0 : toSafeNumber(byDate[dateKey(date)]);

        days.push({
          week: week,
          day: dayIndex,
          date: date,
          count: count,
          isFuture: isFuture,
        });
      }
    }

    return days;
  }

  /**
   * @param {number} count
   * @param {number} maxCount
   * @returns {0 | 1 | 2 | 3 | 4}
   */
  function levelFromCount(count, maxCount) {
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
  }

  /**
   * @param {string} label
   * @param {string} value
   * @returns {HTMLDivElement}
   */
  function summaryItem(label, value) {
    var card = document.createElement("div");
    card.className = "github-commits-card";

    var title = document.createElement("div");
    title.className = "github-commits-card-label";
    title.textContent = label;

    var text = document.createElement("div");
    text.className = "github-commits-card-value";
    text.textContent = value;

    card.appendChild(title);
    card.appendChild(text);

    return card;
  }

  /**
   * @param {GitHubContributionPayload} payload
   * @param {NormalizedContribution[]} items
   * @param {Record<string, number>} byDate
   * @param {Date} todayUtc
   * @returns {void}
   */
  function renderSummary(payload, items, byDate, todayUtc) {
    if (!summaryEl) {
      return;
    }

    var currentYear = String(todayUtc.getUTCFullYear());
    var yearlyTotals = isRecord(payload.total) ? payload.total : {};
    var currentYearTotal = toSafeNumber(yearlyTotals[currentYear]);
    var allTimeTotal = totalContributionsByYear(payload);
    var last30Days = sumLastDays(byDate, todayUtc, 30);
    var best = mostActiveDay(items);

    summaryEl.innerHTML = "";
    summaryEl.appendChild(summaryItem("All-time contributions", formatNumber(allTimeTotal)));
    summaryEl.appendChild(
      summaryItem(currentYear + " contributions", formatNumber(currentYearTotal))
    );
    summaryEl.appendChild(summaryItem("Last 30 days", formatNumber(last30Days)));
    summaryEl.appendChild(
      summaryItem(
        "Most active day",
        best ? formatNumber(best.count) + " on " + formatDate(best.date) : "n/a"
      )
    );
  }

  /**
   * @returns {void}
   */
  function renderLegend() {
    if (!legendEl) {
      return;
    }
    var safeLegendEl = /** @type {HTMLElement} */ (legendEl);

    safeLegendEl.innerHTML = "";

    var less = document.createElement("span");
    less.className = "github-heatmap-legend-label";
    less.textContent = "Less";
    safeLegendEl.appendChild(less);

    greenScale.forEach(function (color) {
      var swatch = document.createElement("span");
      swatch.className = "github-heatmap-legend-swatch";
      swatch.style.backgroundColor = color;
      safeLegendEl.appendChild(swatch);
    });

    var more = document.createElement("span");
    more.className = "github-heatmap-legend-label";
    more.textContent = "More";
    safeLegendEl.appendChild(more);
  }

  /**
   * @param {HeatmapDay[]} days
   * @returns {void}
   */
  function renderHeatmap(days) {
    if (!heatmapEl) {
      return;
    }
    var safeHeatmapEl = /** @type {HTMLElement} */ (heatmapEl);

    safeHeatmapEl.innerHTML = "";

    var maxCount = days.reduce(function (max, day) {
      return day.isFuture ? max : Math.max(max, day.count);
    }, 0);

    days.forEach(function (day) {
      var dot = document.createElement("span");
      dot.className = "github-heatmap-dot";

      if (day.isFuture) {
        dot.classList.add("is-future");
        dot.style.backgroundColor = "transparent";
      } else {
        var level = levelFromCount(day.count, maxCount);
        var label =
          formatNumber(day.count) + " contributions on " + formatDate(day.date);

        dot.style.backgroundColor = greenScale[level];
        dot.setAttribute("aria-label", label);
        dot.title = label;
      }

      safeHeatmapEl.appendChild(dot);
    });
  }

  /**
   * @param {GitHubContributionPayload} payload
   * @param {string} statusMessage
   * @returns {void}
   */
  function render(payload, statusMessage) {
    var todayUtc = toUtcDateOnly(new Date());
    var items = normalizeContributions(payload, todayUtc);
    var byDate = mapContributionsByDate(items);
    var days = buildHeatmapDays(byDate, todayUtc);

    renderSummary(payload, items, byDate, todayUtc);
    renderHeatmap(days);
    renderLegend();

    if (visualsEl) {
      visualsEl.hidden = false;
    }

    setStatus(statusMessage || "Updated from live GitHub contribution data.", false);
  }

  /**
   * @returns {boolean}
   */
  function renderStaticSnapshot() {
    if (staticSnapshot) {
      try {
        render(staticSnapshot, "Showing bundled GitHub snapshot.");
        return true;
      } catch (error) {
        // Snapshot shape may be invalid; fallback to loading/error states.
      }
    }

    return false;
  }

  /**
   * @param {GitHubCacheEntry} cacheEntry
   * @returns {boolean}
   */
  function renderCacheEntry(cacheEntry) {
    try {
      render(
        cacheEntry.payload,
        cacheEntry.isFresh
          ? "Showing cached GitHub contribution data."
          : "Showing stale cached GitHub contribution data."
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  var hasStaticSnapshot = renderStaticSnapshot();
  var cacheEntry = readCacheEntry();
  var hasRenderedCache = false;
  var hasFreshCache = false;

  if (cacheEntry) {
    hasRenderedCache = renderCacheEntry(cacheEntry);
    hasFreshCache = hasRenderedCache && cacheEntry.isFresh;
  }

  if (hasFreshCache) {
    return;
  }

  fetchJsonWithTimeout(String(apiUrl || ""), 12000)
    .then(function (payload) {
      var safePayload = /** @type {GitHubContributionPayload} */ (
        isRecord(payload) ? payload : {}
      );

      writeCache(safePayload);
      render(safePayload, "Updated from live GitHub contribution data.");
    })
    .catch(function () {
      if (hasRenderedCache) {
        setStatus("Live GitHub refresh failed. Showing cached GitHub contribution data.", false);
        return;
      }

      if (hasStaticSnapshot) {
        setStatus("Live GitHub refresh failed. Showing bundled GitHub snapshot.", false);
        return;
      }

      if (visualsEl) {
        visualsEl.hidden = true;
      }

      setStatus("Could not load GitHub contribution data right now.", true);
    });
})();
