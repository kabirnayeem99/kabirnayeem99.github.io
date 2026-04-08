import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { listSiteContentFilePaths } from "./content-loader-shared";
import type { Lang } from "./site-types";

export interface BuildTimestamp {
  readonly iso: string;
  readonly display: string;
}

const ASTRO_ROOT = process.cwd();
const DHAKA_TIME_ZONE = "Asia/Dhaka";
const DHAKA_UTC_OFFSET = "+06:00";

const LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "en-US",
  bn: "bn-BD",
  ar: "ar",
  ur: "ur-PK",
};

const BUILT_AND_DEPLOYED_LABEL_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "built and deployed at",
  bn: "বিল্ড ও ডিপ্লয় করা হয়েছে",
  ar: "تم البناء والنشر في",
  ur: "بلڈ اور ڈپلائے کیا گیا",
};

interface DayPeriodLabels {
  readonly morning: string;
  readonly evening: string;
}

const DAY_PERIOD_LABELS_BY_LANG: Readonly<Record<Lang, DayPeriodLabels>> = {
  en: { morning: "Morning", evening: "Evening" },
  bn: { morning: "সকাল", evening: "সন্ধ্যা" },
  ar: { morning: "صباحًا", evening: "مساءً" },
  ur: { morning: "صبح", evening: "شام" },
};

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

function formatIsoDhaka(date: Date): string {
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

function formatDisplay(date: Date, lang: Lang): string {
  const locale = LOCALE_BY_LANG[lang];
  const parts = extractDhakaDateParts(date);
  const dateLabel = BUILT_AND_DEPLOYED_LABEL_BY_LANG[lang];
  const dayPeriodLabels = DAY_PERIOD_LABELS_BY_LANG[lang];

  const day = formatLocalizedNumber(parts.day, locale, 1);
  const month = formatLocalizedMonth(date, locale);
  const year = formatLocalizedNumber(parts.year, locale, 1);
  const hour24 = parts.hour24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const amPm = hour24 >= 12 ? "PM" : "AM";
  const hour = formatLocalizedNumber(hour12, locale, 2);
  const minute = formatLocalizedNumber(parts.minute, locale, 2);
  const second = formatLocalizedNumber(parts.second, locale, 2);
  const dayPeriod = hour24 >= 12 ? dayPeriodLabels.evening : dayPeriodLabels.morning;

  return `${dateLabel} ${day} ${month} ${year} ${hour}:${minute}:${second} ${amPm} (${dayPeriod})`;
}

function findLatestTimestampMillis(): number {
  const candidates: string[] = [
    ...listSiteContentFilePaths(),
    resolve(ASTRO_ROOT, "public/assets/css/styles.source.css"),
  ];

  const assetJsDir = resolve(ASTRO_ROOT, "public/assets/js");
  for (const name of readdirSync(assetJsDir)) {
    if (name.endsWith(".js")) {
      candidates.push(resolve(assetJsDir, name));
    }
  }

  const sourceRoot = resolve(ASTRO_ROOT, "src");
  const stack: string[] = [sourceRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }

    const stats = statSync(current);
    if (stats.isDirectory()) {
      for (const name of readdirSync(current)) {
        stack.push(resolve(current, name));
      }
      continue;
    }

    if (current.endsWith(".ts") || current.endsWith(".astro")) {
      candidates.push(current);
    }
  }

  let latest = 0;
  for (const path of candidates) {
    const mtime = statSync(path).mtimeMs;
    if (mtime > latest) {
      latest = mtime;
    }
  }

  return latest;
}

export function computeLegacyBuildTimestamp(lang: Lang = "en"): BuildTimestamp {
  const latest = findLatestTimestampMillis();
  const date = new Date(latest === 0 ? Date.now() : latest);
  return {
    iso: formatIsoDhaka(date),
    display: formatDisplay(date, lang),
  };
}
