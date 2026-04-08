document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const language = document.documentElement.lang || "en";

  const localeByLanguage = {
    bn: "bn-BD",
    ar: "ar-SA",
    ur: "ur-PK",
  } as const;

  const hasLocale = (key: string): key is keyof typeof localeByLanguage => (
    Object.prototype.hasOwnProperty.call(localeByLanguage, key)
  );

  const locale = hasLocale(language) ? localeByLanguage[language] : "en-US";

  const yearElement = document.getElementById("year");
  if (yearElement instanceof HTMLElement) {
    yearElement.textContent = today.toLocaleDateString(locale, { year: "numeric" });
  }
});
