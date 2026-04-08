import { DEFAULT_LANG, LANGS, RTL_LANGS, type Lang } from "../lib/locale-config";

export const siteUrl = "https://kabirnayeem99.github.io";
export const basePath = "/";

export const supportedLocales = LANGS;
export type SupportedLocale = Lang;

export const defaultLocale: SupportedLocale = DEFAULT_LANG;

export const rtlLocales: ReadonlySet<SupportedLocale> = RTL_LANGS;

export function isRtlLocale(locale: SupportedLocale): boolean {
  return rtlLocales.has(locale);
}
