// The "built and deployed at" stamp, in Dhaka time.
import type { SiteLocaleBuildTimestamp } from "./content-loader-shared.ts";
import { INTL_LOCALE_BY_LANG, type Lang } from "./locale-config.ts";

const DHAKA_TIME_ZONE = "Asia/Dhaka";
const DHAKA_UTC_OFFSET = "+06:00";
const NOON = 12;
const EVENING_STARTS = 17;

interface DhakaDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour24: number;
  readonly minute: number;
  readonly second: number;
}

const DHAKA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: DHAKA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function extractDhakaDateParts(date: Date): DhakaDateParts {
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hour24: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;

  for (const part of DHAKA_DATE_TIME_FORMATTER.formatToParts(date)) {
    if (part.type === "year") {
      year = Number.parseInt(part.value, 10);
      continue;
    }
    if (part.type === "month") {
      month = Number.parseInt(part.value, 10);
      continue;
    }
    if (part.type === "day") {
      day = Number.parseInt(part.value, 10);
      continue;
    }
    if (part.type === "hour") {
      hour24 = Number.parseInt(part.value, 10);
      continue;
    }
    if (part.type === "minute") {
      minute = Number.parseInt(part.value, 10);
      continue;
    }
    if (part.type === "second") {
      second = Number.parseInt(part.value, 10);
    }
  }

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour24 === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error("Failed to extract Asia/Dhaka timestamp parts");
  }

  return { year, month, day, hour24, minute, second };
}

export function formatIsoDhaka(date: Date): string {
  const parts = extractDhakaDateParts(date);
  return (
    `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` +
    `T${pad2(parts.hour24)}:${pad2(parts.minute)}:${pad2(parts.second)}${DHAKA_UTC_OFFSET}`
  );
}

function formatLocalizedNumber(value: number, locale: string, minimumDigits: number): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: minimumDigits,
  }).format(value);
}

function formatLocalizedMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: DHAKA_TIME_ZONE,
    month: "long",
  }).format(date);
}

export function formatBuildTimestamp(date: Date, lang: Lang, buildTimestampText: SiteLocaleBuildTimestamp): string {
  const locale = INTL_LOCALE_BY_LANG[lang];
  const parts = extractDhakaDateParts(date);

  const day = formatLocalizedNumber(parts.day, locale, 1);
  const month = formatLocalizedMonth(date, locale);
  const year = formatLocalizedNumber(parts.year, locale, 1);
  const hour24 = parts.hour24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hour = formatLocalizedNumber(hour12, locale, 2);
  const minute = formatLocalizedNumber(parts.minute, locale, 2);
  const second = formatLocalizedNumber(parts.second, locale, 2);
  const period = hour24 < NOON ? "morning" : hour24 < EVENING_STARTS ? "afternoon" : "evening";
  const dayPeriod = buildTimestampText.dayPeriod[period];
  // Urdu has no short AM/PM marker apart from these words, so it shows the word once.
  const marker =
    lang === "ur" ? "" : ` ${hour24 < NOON ? (lang === "ar" ? "ص" : "AM") : lang === "ar" ? "م" : "PM"}`;

  return `${buildTimestampText.prefix} ${day} ${month} ${year} ${hour}:${minute}:${second}${marker} (${dayPeriod})`;
}
