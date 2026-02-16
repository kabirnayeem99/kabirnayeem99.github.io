(function () {
  "use strict";

  var widget = document.querySelector("[data-github-commits-widget]");
  if (!widget) {
    return;
  }

  var apiUrl = widget.getAttribute("data-github-contrib-url");
  var statusEl = widget.querySelector('[data-role="status"]');
  var visualsEl = widget.querySelector('[data-role="visuals"]');
  var summaryEl = widget.querySelector('[data-role="summary-cards"]');
  var heatmapEl = widget.querySelector('[data-role="heatmap"]');
  var legendEl = widget.querySelector('[data-role="legend"]');
  var cacheTtlMs = 10 * 60 * 1000;
  var cacheKey =
    "person-portfolio:github-commits:v1:" + encodeURIComponent(apiUrl || "");

  var weeksToShow = 53;
  var millisPerDay = 86400000;
  var greenScale = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  function toSafeNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function setStatus(message, isError) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(toSafeNumber(value))));
  }

  function toUtcDateOnly(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

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

  function addUtcDays(date, days) {
    return new Date(date.getTime() + days * millisPerDay);
  }

  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

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

  function readCache() {
    try {
      if (!window.localStorage) {
        return null;
      }
      var raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      var cachedAt = toSafeNumber(parsed.cachedAt);
      if (!cachedAt) {
        return null;
      }
      var ageMs = Date.now() - cachedAt;
      if (ageMs < 0 || ageMs > cacheTtlMs) {
        return null;
      }
      if (!parsed.payload || typeof parsed.payload !== "object") {
        return null;
      }
      return parsed.payload;
    } catch (error) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      if (!window.localStorage) {
        return;
      }
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

  function normalizeContributions(payload, todayUtc) {
    var raw = payload && Array.isArray(payload.contributions) ? payload.contributions : [];
    return raw
      .map(function (item) {
        return {
          date: parseDateOnly(item.date),
          count: Math.max(0, Math.round(toSafeNumber(item.count))),
        };
      })
      .filter(function (item) {
        return item.date && item.date.getTime() <= todayUtc.getTime();
      })
      .sort(function (a, b) {
        return a.date.getTime() - b.date.getTime();
      });
  }

  function mapContributionsByDate(items) {
    var byDate = Object.create(null);
    items.forEach(function (item) {
      byDate[dateKey(item.date)] = item.count;
    });
    return byDate;
  }

  function totalContributionsByYear(payload) {
    var yearlyTotals = payload && payload.total ? payload.total : {};
    return Object.keys(yearlyTotals).reduce(function (sum, year) {
      return sum + Math.max(0, Math.round(toSafeNumber(yearlyTotals[year])));
    }, 0);
  }

  function sumLastDays(byDate, todayUtc, days) {
    var total = 0;
    for (var i = 0; i < days; i += 1) {
      var day = addUtcDays(todayUtc, -i);
      total += toSafeNumber(byDate[dateKey(day)]);
    }
    return total;
  }

  function mostActiveDay(items) {
    return items.reduce(
      function (best, item) {
        if (!best || item.count > best.count) {
          return item;
        }
        return best;
      },
      null
    );
  }

  function buildHeatmapDays(byDate, todayUtc) {
    var currentWeekStart = addUtcDays(todayUtc, -todayUtc.getUTCDay());
    var firstWeekStart = addUtcDays(currentWeekStart, -(weeksToShow - 1) * 7);
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

  function renderSummary(payload, items, byDate, todayUtc) {
    var currentYear = String(todayUtc.getUTCFullYear());
    var currentYearTotal = toSafeNumber(payload && payload.total ? payload.total[currentYear] : 0);
    var allTimeTotal = totalContributionsByYear(payload);
    var last30Days = sumLastDays(byDate, todayUtc, 30);
    var best = mostActiveDay(items);

    summaryEl.innerHTML = "";
    summaryEl.appendChild(summaryItem("All-time contributions", formatNumber(allTimeTotal)));
    summaryEl.appendChild(summaryItem(currentYear + " contributions", formatNumber(currentYearTotal)));
    summaryEl.appendChild(summaryItem("Last 30 days", formatNumber(last30Days)));
    summaryEl.appendChild(
      summaryItem(
        "Most active day",
        best ? formatNumber(best.count) + " on " + formatDate(best.date) : "n/a"
      )
    );
  }

  function renderLegend() {
    legendEl.innerHTML = "";

    var less = document.createElement("span");
    less.className = "github-heatmap-legend-label";
    less.textContent = "Less";
    legendEl.appendChild(less);

    greenScale.forEach(function (color) {
      var swatch = document.createElement("span");
      swatch.className = "github-heatmap-legend-swatch";
      swatch.style.backgroundColor = color;
      legendEl.appendChild(swatch);
    });

    var more = document.createElement("span");
    more.className = "github-heatmap-legend-label";
    more.textContent = "More";
    legendEl.appendChild(more);
  }

  function renderHeatmap(days) {
    heatmapEl.innerHTML = "";

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
        dot.style.backgroundColor = greenScale[level];
        dot.setAttribute(
          "aria-label",
          formatNumber(day.count) + " contributions on " + formatDate(day.date)
        );
        dot.title = formatNumber(day.count) + " contributions on " + formatDate(day.date);
      }

      heatmapEl.appendChild(dot);
    });
  }

  function render(payload) {
    var todayUtc = toUtcDateOnly(new Date());
    var items = normalizeContributions(payload, todayUtc);
    var byDate = mapContributionsByDate(items);
    var days = buildHeatmapDays(byDate, todayUtc);

    renderSummary(payload, items, byDate, todayUtc);
    renderHeatmap(days);
    renderLegend();
    visualsEl.hidden = false;
    setStatus("Updated from live GitHub contribution data.", false);
  }

  var cachedPayload = readCache();
  if (cachedPayload) {
    try {
      render(cachedPayload);
      setStatus("Updated from cached GitHub contribution data.", false);
      return;
    } catch (error) {
      // Cache shape may be invalid; fallback to live fetch.
    }
  }

  fetchJsonWithTimeout(apiUrl, 12000)
    .then(function (payload) {
      var safePayload = payload || {};
      writeCache(safePayload);
      render(safePayload);
    })
    .catch(function () {
      if (visualsEl) {
        visualsEl.hidden = true;
      }
      setStatus("Could not load GitHub contribution data right now.", true);
    });
})();
