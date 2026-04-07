export const siteUrl = "https://kabirnayeem99.github.io";
export const basePath = "/";

export const supportedLocales = ["en", "bn", "ar", "ur"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

export const rtlLocales: ReadonlySet<SupportedLocale> = new Set(["ar", "ur"]);

export function isRtlLocale(locale: SupportedLocale): boolean {
  return rtlLocales.has(locale);
}
