// @ts-check
/**
 * Shared pure helpers for stats rendering scripts.
 *
 * This file uses a tiny UMD wrapper so browser pages can read
 * `window.personPortfolioStatsUtils` and Node tests can `require()` it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  /** @type {{ personPortfolioStatsUtils?: unknown }} */
  var globalRoot = /** @type {{ personPortfolioStatsUtils?: unknown }} */ (root);
  globalRoot.personPortfolioStatsUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * Safely converts unknown input to a finite number.
   *
   * @param {unknown} value
   * @returns {number}
   */
  function toSafeNumber(value) {
    var numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  /**
   * Formats a percent value for compact chart labels.
   *
   * @param {number} value
   * @returns {string}
   */
  function formatPercent(value) {
    if (value < 1) {
      return value.toFixed(2) + "%";
    }
    return value.toFixed(1) + "%";
  }

  /**
   * Formats a duration in seconds using short human-friendly units.
   *
   * @param {number} seconds
   * @returns {string}
   */
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

  /**
   * Normalizes a Date to UTC midnight.
   *
   * @param {Date} date
   * @returns {Date}
   */
  function toUtcDateOnly(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  /**
   * Parses a YYYY-MM-DD date string as UTC midnight.
   *
   * @param {unknown} value
   * @returns {Date | null}
   */
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

  /**
   * Adds a whole number of days in UTC.
   *
   * @param {Date} date
   * @param {number} days
   * @returns {Date}
   */
  function addUtcDays(date, days) {
    var millisPerDay = 86400000;
    return new Date(date.getTime() + days * millisPerDay);
  }

  /**
   * Converts a Date to YYYY-MM-DD.
   *
   * @param {Date} date
   * @returns {string}
   */
  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Formats a Date in US locale for contribution labels.
   *
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  /**
   * Formats numbers in US locale.
   *
   * @param {number} value
   * @returns {string}
   */
  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(toSafeNumber(value))));
  }

  return Object.freeze({
    toSafeNumber: toSafeNumber,
    formatPercent: formatPercent,
    formatDuration: formatDuration,
    toUtcDateOnly: toUtcDateOnly,
    parseDateOnly: parseDateOnly,
    addUtcDays: addUtcDays,
    dateKey: dateKey,
    formatDate: formatDate,
    formatNumber: formatNumber,
  });
});
