export const LANGS = ["en", "bn", "ar", "ur"] as const;
export type Lang = (typeof LANGS)[number];

// Compile-time switch for the language switcher UI. Flip to `false` to hide
// the language-switcher icon/menu (routes for other languages still exist,
// they're just not surfaced in the header).
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- a switch: typed as the literal, the checks of it would count as dead code
export const LOCALIZATION_ENABLED: boolean = false;

// Languages offered in the switcher. Arabic pages still build and stay reachable by URL
// (and in hreflang/sitemap), but are not offered in the menu.
export const SWITCHER_LANGS: readonly Lang[] = ["en", "bn", "ur"];

export const DEFAULT_LANG: Lang = "en";

export const PAGE_IDS = ["index", "work", "project", "blog", "stats"] as const;
export type PageId = (typeof PAGE_IDS)[number];

// Every content page. "reading" is a stand-alone, English-only page: it is in the nav and the
// route table, but has no shared per-language loader, so it is not one of PAGE_IDS.
export const ALL_PAGE_IDS = [...PAGE_IDS, "reading"] as const;
export type AnyPageId = (typeof ALL_PAGE_IDS)[number];

/** One value for every language. */
export function mapLangs<T>(value: (lang: Lang) => T): Record<Lang, T> {
  return { en: value("en"), bn: value("bn"), ar: value("ar"), ur: value("ur") };
}

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

