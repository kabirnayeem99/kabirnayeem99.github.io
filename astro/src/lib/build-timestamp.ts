import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  listSiteContentFilePaths,
  loadSiteContentRoot,
  readLocaleInfo,
  type SiteLocaleBuildTimestamp,
} from "./content-loader-shared";
import { formatBuildTimestamp, formatIsoDhaka } from "./dhaka-time";
import { DEFAULT_LANG, mapLangs, type Lang } from "./locale-config";

export interface BuildTimestamp {
  readonly iso: string;
  readonly display: string;
}

const ASTRO_ROOT = process.cwd();
let latestTimestampMillisCache: number | undefined;
let buildTimestampTextByLangCache: Readonly<Record<Lang, SiteLocaleBuildTimestamp>> | undefined;

function readBuildTimestampText(lang: Lang): SiteLocaleBuildTimestamp {
  if (buildTimestampTextByLangCache !== undefined) {
    return buildTimestampTextByLangCache[lang];
  }

  const { locales } = loadSiteContentRoot().site;
  const textByLang = mapLangs(
    (locale) => readLocaleInfo(locales[locale], `root.site.locales.${locale}`).buildTimestamp,
  );

  buildTimestampTextByLangCache = textByLang;
  return buildTimestampTextByLangCache[lang];
}

function findLatestTimestampMillis(): number {
  if (latestTimestampMillisCache !== undefined) {
    return latestTimestampMillisCache;
  }

  const candidates: string[] = [...listSiteContentFilePaths()];

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
      current.endsWith(".css") ||
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
    display: formatBuildTimestamp(date, lang, readBuildTimestampText(lang)),
  };
}
