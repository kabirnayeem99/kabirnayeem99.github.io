(function () {
  "use strict";

  var widget = document.querySelector("[data-wakatime-widget]");
  if (!widget) {
    return;
  }

  var languagesUrl = widget.getAttribute("data-wakatime-languages-url");
  var summaryUrl = widget.getAttribute("data-wakatime-summary-url");
  var statusEl = widget.querySelector('[data-role="status"]');
  var visualsEl = widget.querySelector('[data-role="visuals"]');
  var barsEl = widget.querySelector('[data-role="language-bars"]');
  var summaryEl = widget.querySelector('[data-role="summary-cards"]');
  var cacheTtlMs = 10 * 60 * 1000;
  var cacheKey =
    "person-portfolio:wakatime:v1:" +
    encodeURIComponent(languagesUrl || "") +
    ":" +
    encodeURIComponent(summaryUrl || "");
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

  function normalizeLanguageName(name) {
    return String(name || "").trim().toLowerCase();
  }

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

  function setStatus(message, isError) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function formatPercent(value) {
    if (value < 1) {
      return value.toFixed(2) + "%";
    }
    return value.toFixed(1) + "%";
  }

  function formatDate(isoDate) {
    if (!isoDate) {
      return "n/a";
    }
    return isoDate.slice(0, 10);
  }

  function toSafeNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

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

  function totalTrackedSeconds(payload) {
    var data = payload && payload.data ? payload.data : {};
    var grandTotal = data.grand_total || {};
    return toSafeNumber(
      grandTotal.total_seconds_including_other_language || grandTotal.total_seconds
    );
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

  function fetchJsonp(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var callbackName =
        "wakatimeJsonp_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      var script = document.createElement("script");
      var separator = url.indexOf("?") >= 0 ? "&" : "?";
      var timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timeoutId);
        if (window[callbackName]) {
          delete window[callbackName];
        }
        script.remove();
      }

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("JSONP request failed"));
      };

      script.src = url + separator + "callback=" + callbackName;
      document.head.appendChild(script);
    });
  }

  function fetchWakatime(url) {
    return fetchJsonWithTimeout(url, 10000).catch(function () {
      return fetchJsonp(url, 12000);
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

  function normalizeLanguages(payload) {
    var raw = payload && Array.isArray(payload.data) ? payload.data : [];

    return raw
      .map(function (item) {
        return {
          name: String(item.name || "Unknown"),
          percent: toSafeNumber(item.percent),
          color: typeof item.color === "string" && item.color ? item.color : "#6b7280",
        };
      })
      .filter(function (item) {
        return item.percent > 0 && !shouldExcludeLanguage(item.name);
      })
      .sort(function (a, b) {
        return b.percent - a.percent;
      });
  }

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

  function renderLanguageCharts(languages, summaryPayload) {
    barsEl.innerHTML = "";
    var trackedSeconds = totalTrackedSeconds(summaryPayload);

    var topLanguages = languages.slice(0, 10);

    topLanguages.forEach(function (item) {
      barsEl.appendChild(createLanguageRow(item, trackedSeconds));
    });
  }

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

  function renderSummary(payload) {
    var data = payload && payload.data ? payload.data : {};
    var total = data.grand_total || {};
    var best = data.best_day || {};
    var range = data.range || {};

    summaryEl.innerHTML = "";
    summaryEl.appendChild(
      summaryItem(
        "Total coded",
        total.human_readable_total_including_other_language || total.human_readable_total || "n/a"
      )
    );
    summaryEl.appendChild(
      summaryItem(
        "Daily average",
        total.human_readable_daily_average_including_other_language ||
          total.human_readable_daily_average ||
          "n/a"
      )
    );
    summaryEl.appendChild(summaryItem("Best day", (best.text || "n/a") + (best.date ? " · " + formatDate(best.date) : "")));
    summaryEl.appendChild(
      summaryItem(
        "Tracking range",
        (range.start ? formatDate(range.start) : "n/a") +
          (range.end ? " to " + formatDate(range.end) : "")
      )
    );
  }

  function renderFromPayloads(languagePayload, summaryPayload, statusMessage) {
    var languages = normalizeLanguages(languagePayload);

    if (!languages.length) {
      throw new Error("No language data available");
    }

    renderLanguageCharts(languages, summaryPayload);
    renderSummary(summaryPayload);
    visualsEl.hidden = false;
    setStatus(statusMessage, false);
  }

  var cachedPayload = readCache();
  if (
    cachedPayload &&
    cachedPayload.languagePayload &&
    cachedPayload.summaryPayload
  ) {
    try {
      renderFromPayloads(
        cachedPayload.languagePayload,
        cachedPayload.summaryPayload,
        "Updated from cached WakaTime data."
      );
      return;
    } catch (error) {
      // Cache parse or shape mismatch; fallback to live fetch.
    }
  }

  Promise.all([fetchWakatime(languagesUrl), fetchWakatime(summaryUrl)])
    .then(function (results) {
      var languagePayload = results[0];
      var summaryPayload = results[1];
      writeCache({
        languagePayload: languagePayload,
        summaryPayload: summaryPayload,
      });
      renderFromPayloads(languagePayload, summaryPayload, "Updated from WakaTime shared data.");
    })
    .catch(function () {
      setStatus("Could not load live WakaTime charts right now.", true);
      if (visualsEl) {
        visualsEl.hidden = true;
      }
    });
})();
