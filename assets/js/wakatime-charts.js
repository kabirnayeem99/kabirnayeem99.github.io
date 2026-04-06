// @ts-check
/**
 * Renders WakaTime language and summary charts with cache-first loading.
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
   *   formatPercent: function(number): string,
   *   formatDuration: function(number): string
   * }} StatsUtils
   */

  /** @typedef {{ name?: unknown, percent?: unknown, color?: unknown }} RawLanguageItem */
  /** @typedef {{ data?: RawLanguageItem[] }} WakatimeLanguagePayload */
  /** @typedef {{
   *   best_day?: { date?: string, text?: string },
   *   grand_total?: {
   *     total_seconds?: unknown,
   *     total_seconds_including_other_language?: unknown,
   *     human_readable_total?: string,
   *     human_readable_total_including_other_language?: string,
   *     human_readable_daily_average?: string,
   *     human_readable_daily_average_including_other_language?: string
   *   },
   *   range?: { start?: string, end?: string }
   * }} WakatimeSummaryData */
  /** @typedef {{ data?: WakatimeSummaryData }} WakatimeSummaryPayload */
  /** @typedef {{ languagePayload: WakatimeLanguagePayload, summaryPayload: WakatimeSummaryPayload }} WakatimeCachedPayload */
  /** @typedef {{ payload: WakatimeCachedPayload, isFresh: boolean }} WakatimeCacheEntry */
  /** @typedef {{ name: string, percent: number, color: string }} LanguageItem */
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
    function formatPercent(value) {
      if (value < 1) {
        return value.toFixed(2) + "%";
      }
      return value.toFixed(1) + "%";
    }

    /** @param {number} seconds */
    function formatDuration(seconds) {
      var totalSeconds = Math.max(0, Math.round(toSafeNumber(seconds)));
      var hours = Math.floor(totalSeconds / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var secondsRemainder = totalSeconds % 60;

      if (hours > 0 && minutes > 0) {
        return hours + " hrs " + minutes + " mins";
      }
      if (hours > 0) {
        return hours + " hrs";
      }
      if (minutes > 0) {
        return minutes + " mins";
      }
      return secondsRemainder + " secs";
    }

    return {
      toSafeNumber: toSafeNumber,
      formatPercent: formatPercent,
      formatDuration: formatDuration,
    };
  }

  /**
   * @returns {StatsUtils}
   */
  function getStatsUtils() {
    var root = /** @type {PortfolioWindow} */ (window).personPortfolioStatsUtils;
    if (isRecord(root)) {
      var toSafeNumber = root.toSafeNumber;
      var formatPercent = root.formatPercent;
      var formatDuration = root.formatDuration;

      if (
        typeof toSafeNumber === "function" &&
        typeof formatPercent === "function" &&
        typeof formatDuration === "function"
      ) {
        return /** @type {StatsUtils} */ (root);
      }
    }

    return createFallbackStatsUtils();
  }

  var widget = document.querySelector("[data-wakatime-widget]");
  if (!widget) {
    return;
  }

  var languagesUrl = widget.getAttribute("data-wakatime-languages-url");
  var summaryUrl = widget.getAttribute("data-wakatime-summary-url");
  /** @type {HTMLElement | null} */
  var statusEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="status"]'));
  /** @type {HTMLElement | null} */
  var visualsEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="visuals"]'));
  /** @type {HTMLOListElement | null} */
  var barsEl = /** @type {HTMLOListElement | null} */ (widget.querySelector('[data-role="language-bars"]'));
  /** @type {HTMLElement | null} */
  var summaryEl = /** @type {HTMLElement | null} */ (widget.querySelector('[data-role="summary-cards"]'));
  var cacheTtlMs = 24 * 60 * 60 * 1000;
  var cacheKey =
    "person-portfolio:wakatime:v1:" +
    encodeURIComponent(languagesUrl || "") +
    ":" +
    encodeURIComponent(summaryUrl || "");

  var statsUtils = getStatsUtils();
  var toSafeNumber = statsUtils.toSafeNumber;
  var formatPercent = statsUtils.formatPercent;
  var formatDuration = statsUtils.formatDuration;
  var staticSnapshot = getStaticSnapshot();

  /** @type {Record<string, true>} */
  var excludedLanguageNames = {
    html: true,
    xml: true,
    gradle: true,
    other: true,
    markdown: true,
    groovy: true,
    yaml: true,
    toml: true,
    "blade template": true,
    css: true,
    bash: true,
    "shell script": true,
    zsh: true,
    sh: true,
  };

  /** @type {string[]} */
  var excludedLanguageKeywords = [
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
  ];

  /**
   * @param {unknown} name
   * @returns {string}
   */
  function normalizeLanguageName(name) {
    return String(name || "").trim().toLowerCase();
  }

  /**
   * @param {unknown} name
   * @returns {boolean}
   */
  function shouldExcludeLanguage(name) {
    var normalized = normalizeLanguageName(name);
    if (!normalized) {
      return true;
    }

    if (excludedLanguageNames[normalized]) {
      return true;
    }

    return excludedLanguageKeywords.some(function (keyword) {
      return normalized.indexOf(keyword) >= 0;
    });
  }

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
   * @param {unknown} isoDate
   * @returns {string}
   */
  function formatDate(isoDate) {
    var safeDate = typeof isoDate === "string" ? isoDate : "";
    if (!safeDate) {
      return "n/a";
    }

    return safeDate.slice(0, 10);
  }

  /**
   * @param {WakatimeSummaryPayload} payload
   * @returns {number}
   */
  function totalTrackedSeconds(payload) {
    var data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    var grandTotal = isRecord(data.grand_total) ? data.grand_total : {};

    return toSafeNumber(
      grandTotal.total_seconds_including_other_language || grandTotal.total_seconds
    );
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
   * @param {string} url
   * @returns {Promise<unknown>}
   */
  function fetchWakatime(url) {
    return fetchJsonWithTimeout(url, 10000);
  }

  /**
   * @returns {WakatimeCachedPayload | null}
   */
  function getStaticSnapshot() {
    var rootSnapshot = /** @type {PortfolioWindow} */ (window).personPortfolioSnapshots;
    if (!isRecord(rootSnapshot)) {
      return null;
    }

    var wakatimeSnapshot = rootSnapshot.wakatime;
    if (!isRecord(wakatimeSnapshot)) {
      return null;
    }

    if (!isRecord(wakatimeSnapshot.languagePayload) || !isRecord(wakatimeSnapshot.summaryPayload)) {
      return null;
    }

    return /** @type {WakatimeCachedPayload} */ (wakatimeSnapshot);
  }

  /**
   * @returns {WakatimeCacheEntry | null}
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

      if (!isRecord(parsed.payload.languagePayload) || !isRecord(parsed.payload.summaryPayload)) {
        return null;
      }

      var ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      var isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= cacheTtlMs;

      return {
        payload: /** @type {WakatimeCachedPayload} */ (parsed.payload),
        isFresh: isFresh,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * @param {WakatimeCachedPayload} payload
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
   * @param {WakatimeLanguagePayload} payload
   * @returns {LanguageItem[]}
   */
  function normalizeLanguages(payload) {
    var raw = Array.isArray(payload.data) ? payload.data : [];

    return raw
      .map(function (item) {
        return {
          name: String(item && item.name ? item.name : "Unknown"),
          percent: toSafeNumber(item && item.percent),
          color:
            item && typeof item.color === "string" && item.color ? item.color : "#6b7280",
        };
      })
      .filter(function (item) {
        return item.percent > 0 && !shouldExcludeLanguage(item.name);
      })
      .sort(function (left, right) {
        return right.percent - left.percent;
      });
  }

  /**
   * @param {LanguageItem} item
   * @param {number} trackedSeconds
   * @returns {HTMLLIElement}
   */
  function createLanguageRow(item, trackedSeconds) {
    var row = document.createElement("li");
    row.className = "wakatime-bar-row";

    var head = document.createElement("div");
    head.className = "wakatime-bar-head";

    var name = document.createElement("span");
    name.className = "wakatime-name";

    var swatch = document.createElement("span");
    swatch.className = "wakatime-swatch";
    swatch.style.backgroundColor = item.color;

    var label = document.createElement("span");
    label.textContent = item.name;

    name.appendChild(swatch);
    name.appendChild(label);

    var metrics = document.createElement("span");
    metrics.className = "wakatime-metrics";

    var percent = document.createElement("span");
    percent.className = "wakatime-percent";
    percent.textContent = formatPercent(item.percent);
    metrics.appendChild(percent);

    if (trackedSeconds > 0) {
      var time = document.createElement("span");
      time.className = "wakatime-time";
      time.textContent = "~" + formatDuration((trackedSeconds * item.percent) / 100);
      metrics.appendChild(time);
    }

    head.appendChild(name);
    head.appendChild(metrics);

    var track = document.createElement("div");
    track.className = "wakatime-track";

    var fill = document.createElement("div");
    fill.className = "wakatime-fill";
    fill.style.width = Math.min(item.percent, 100) + "%";
    fill.style.backgroundColor = item.color;

    track.appendChild(fill);
    row.appendChild(head);
    row.appendChild(track);

    return row;
  }

  /**
   * @param {LanguageItem[]} languages
   * @param {WakatimeSummaryPayload} summaryPayload
   * @returns {void}
   */
  function renderLanguageCharts(languages, summaryPayload) {
    if (!barsEl) {
      return;
    }
    var safeBarsEl = /** @type {HTMLOListElement} */ (barsEl);

    safeBarsEl.innerHTML = "";
    var trackedSeconds = totalTrackedSeconds(summaryPayload);

    languages.slice(0, 10).forEach(function (item) {
      safeBarsEl.appendChild(createLanguageRow(item, trackedSeconds));
    });
  }

  /**
   * @param {string} label
   * @param {string} value
   * @returns {HTMLDivElement}
   */
  function summaryItem(label, value) {
    var card = document.createElement("div");
    card.className = "wakatime-card";

    var title = document.createElement("div");
    title.className = "wakatime-card-label";
    title.textContent = label;

    var text = document.createElement("div");
    text.className = "wakatime-card-value";
    text.textContent = value || "n/a";

    card.appendChild(title);
    card.appendChild(text);
    return card;
  }

  /**
   * @param {WakatimeSummaryPayload} payload
   * @returns {void}
   */
  function renderSummary(payload) {
    if (!summaryEl) {
      return;
    }

    var data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    var total = isRecord(data.grand_total) ? data.grand_total : {};
    var best = isRecord(data.best_day) ? data.best_day : {};
    var range = isRecord(data.range) ? data.range : {};

    summaryEl.innerHTML = "";
    summaryEl.appendChild(
      summaryItem(
        "Total coded",
        String(
          total.human_readable_total_including_other_language ||
            total.human_readable_total ||
            "n/a"
        )
      )
    );

    summaryEl.appendChild(
      summaryItem(
        "Daily average",
        String(
          total.human_readable_daily_average_including_other_language ||
            total.human_readable_daily_average ||
            "n/a"
        )
      )
    );

    summaryEl.appendChild(
      summaryItem(
        "Best day",
        String(best.text || "n/a") + (best.date ? " · " + formatDate(best.date) : "")
      )
    );

    summaryEl.appendChild(
      summaryItem(
        "Tracking range",
        (range.start ? formatDate(range.start) : "n/a") +
          (range.end ? " to " + formatDate(range.end) : "")
      )
    );
  }

  /**
   * @param {WakatimeLanguagePayload} languagePayload
   * @param {WakatimeSummaryPayload} summaryPayload
   * @param {string} statusMessage
   * @returns {void}
   */
  function renderFromPayloads(languagePayload, summaryPayload, statusMessage) {
    var languages = normalizeLanguages(languagePayload);
    if (!languages.length) {
      throw new Error("No language data available");
    }

    renderLanguageCharts(languages, summaryPayload);
    renderSummary(summaryPayload);

    if (visualsEl) {
      visualsEl.hidden = false;
    }

    setStatus(statusMessage, false);
  }

  /**
   * @returns {boolean}
   */
  function renderStaticSnapshot() {
    if (staticSnapshot) {
      try {
        renderFromPayloads(
          staticSnapshot.languagePayload,
          staticSnapshot.summaryPayload,
          "Showing bundled WakaTime snapshot."
        );
        return true;
      } catch (error) {
        // Snapshot shape mismatch; fallback to loading/error states.
      }
    }

    return false;
  }

  /**
   * @param {WakatimeCacheEntry} cacheEntry
   * @returns {boolean}
   */
  function renderCacheEntry(cacheEntry) {
    try {
      renderFromPayloads(
        cacheEntry.payload.languagePayload,
        cacheEntry.payload.summaryPayload,
        cacheEntry.isFresh
          ? "Showing cached WakaTime data."
          : "Showing stale cached WakaTime data."
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

  Promise.all([
    fetchWakatime(String(languagesUrl || "")),
    fetchWakatime(String(summaryUrl || "")),
  ])
    .then(function (results) {
      var languagePayload = /** @type {WakatimeLanguagePayload} */ (results[0]);
      var summaryPayload = /** @type {WakatimeSummaryPayload} */ (results[1]);
      var cachePayload = {
        languagePayload: languagePayload,
        summaryPayload: summaryPayload,
      };

      writeCache(cachePayload);
      renderFromPayloads(languagePayload, summaryPayload, "Updated from WakaTime shared data.");
    })
    .catch(function () {
      if (hasRenderedCache) {
        setStatus("Live WakaTime refresh failed. Showing cached WakaTime data.", false);
        return;
      }

      if (hasStaticSnapshot) {
        setStatus("Live WakaTime refresh failed. Showing bundled WakaTime snapshot.", false);
        return;
      }

      setStatus("Could not load live WakaTime charts right now.", true);
      if (visualsEl) {
        visualsEl.hidden = true;
      }
    });
})();
