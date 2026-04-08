export const LANGS = ["en", "bn", "ar", "ur"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

export const RTL_LANGS: ReadonlySet<Lang> = new Set(["ar", "ur"]);

export const PAGE_IDS = ["index", "work", "project", "blog", "stats"] as const;
export type PageId = (typeof PAGE_IDS)[number];

export const INTL_LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "en-US",
  bn: "bn-BD",
  ar: "ar",
  ur: "ur-PK",
};

export const OG_LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "en_US",
  bn: "bn_BD",
  ar: "ar_SA",
  ur: "ur_PK",
};

export function isLang(value: string): value is Lang {
  return LANGS.some((lang) => lang === value);
}

