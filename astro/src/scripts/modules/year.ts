import { INTL_LOCALE_BY_LANG, isLang } from "../../lib/locale-config";

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const language = document.documentElement.lang || "en";
  const locale = isLang(language) ? INTL_LOCALE_BY_LANG[language] : INTL_LOCALE_BY_LANG.en;

  const yearElement = document.getElementById("year");
  if (yearElement instanceof HTMLElement) {
    yearElement.textContent = today.toLocaleDateString(locale, { year: "numeric" });
  }
});
