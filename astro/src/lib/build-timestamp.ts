import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  asRecord,
  listSiteContentFilePaths,
  loadSiteContentRoot,
  readLocaleInfo,
  type SiteLocaleBuildTimestamp,
} from "./content-loader-shared";
import { DEFAULT_LANG, INTL_LOCALE_BY_LANG, LANGS, type Lang } from "./locale-config";

export interface BuildTimestamp {
  readonly iso: string;
  readonly display: string;
}

const ASTRO_ROOT = process.cwd();
const DHAKA_TIME_ZONE = "Asia/Dhaka";
const DHAKA_UTC_OFFSET = "+06:00";
let latestTimestampMillisCache: number | undefined;
let buildTimestampTextByLangCache: Readonly<Record<Lang, SiteLocaleBuildTimestamp>> | undefined;

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
  const locale = INTL_LOCALE_BY_LANG[lang];
  const parts = extractDhakaDateParts(date);
  const buildTimestampText = readBuildTimestampText(lang);

  const day = formatLocalizedNumber(parts.day, locale, 1);
  const month = formatLocalizedMonth(date, locale);
  const year = formatLocalizedNumber(parts.year, locale, 1);
  const hour24 = parts.hour24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const amPm = hour24 >= 12 ? "PM" : "AM";
  const hour = formatLocalizedNumber(hour12, locale, 2);
  const minute = formatLocalizedNumber(parts.minute, locale, 2);
  const second = formatLocalizedNumber(parts.second, locale, 2);
  const dayPeriod = hour24 >= 12 ? buildTimestampText.dayPeriod.evening : buildTimestampText.dayPeriod.morning;

  return `${buildTimestampText.prefix} ${day} ${month} ${year} ${hour}:${minute}:${second} ${amPm} (${dayPeriod})`;
}

function readBuildTimestampText(lang: Lang): SiteLocaleBuildTimestamp {
  if (buildTimestampTextByLangCache !== undefined) {
    return buildTimestampTextByLangCache[lang];
  }

  const root = loadSiteContentRoot();
  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const textByLang = {} as Record<Lang, SiteLocaleBuildTimestamp>;

  for (const locale of LANGS) {
    const localeRaw = asRecord(siteLocales[locale], `root.site.locales.${locale}`);
    textByLang[locale] = readLocaleInfo(localeRaw, `root.site.locales.${locale}`).buildTimestamp;
  }

  buildTimestampTextByLangCache = textByLang;
  return buildTimestampTextByLangCache[lang];
}

function findLatestTimestampMillis(): number {
  if (latestTimestampMillisCache !== undefined) {
    return latestTimestampMillisCache;
  }

  const candidates: string[] = [
    ...listSiteContentFilePaths(),
    resolve(ASTRO_ROOT, "public/assets/css/styles.source.css"),
  ];

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

    if (
      current.endsWith(".ts") ||
      current.endsWith(".astro") ||
      current.endsWith(".js") ||
      current.endsWith(".mjs")
    ) {
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

  latestTimestampMillisCache = latest;
  return latestTimestampMillisCache;
}

export function computeLegacyBuildTimestamp(lang: Lang = DEFAULT_LANG): BuildTimestamp {
  const latest = findLatestTimestampMillis();
  const date = new Date(latest === 0 ? Date.now() : latest);
  return {
    iso: formatIsoDhaka(date),
    display: formatDisplay(date, lang),
  };
}
