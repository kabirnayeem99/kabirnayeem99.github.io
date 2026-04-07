export type Lang = "en" | "bn" | "ar" | "ur";

export const SKIP_TO_MAIN_LABEL_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "Skip to main content",
  bn: "মূল অংশে যান",
  ar: "تَخَطَّ إلى المُحتَوَى الرَّئيسِي",
  ur: "مرکزی مواد پر جائیں",
};

export const CLOSE_PAGE_LABEL_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "Close page",
  bn: "পাতা বন্ধ করুন",
  ar: "إغلاق الصفحة",
  ur: "صفحہ بند کریں",
};

export const LAST_UPDATED_LABEL_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "Last updated",
  bn: "সর্বশেষ আপডেট",
  ar: "آخر تحديث",
  ur: "آخری اپڈیٹ",
};

export const BACK_TO_TOP_LABEL_BY_LANG: Readonly<Record<Lang, string>> = {
  en: "Back to top",
  bn: "উপরে ফিরে যান",
  ar: "العَودَةُ إلى الأَعلى",
  ur: "اوپر واپس جائیں",
};

export const SKIP_TO_MAIN_LABEL = SKIP_TO_MAIN_LABEL_BY_LANG.en;
export const CLOSE_PAGE_LABEL = CLOSE_PAGE_LABEL_BY_LANG.en;
export const LAST_UPDATED_LABEL = LAST_UPDATED_LABEL_BY_LANG.en;
export const BACK_TO_TOP_LABEL = BACK_TO_TOP_LABEL_BY_LANG.en;

export const THEME_BOOTSTRAP_SCRIPT =
  "(function(){" +
  "var storageKey='person-portfolio-theme';" +
  "var theme='light';" +
  "try{" +
  "var stored=window.localStorage.getItem(storageKey);" +
  "if(stored==='light'||stored==='dark'){theme=stored;}" +
  "}catch(_error){}" +
  "document.documentElement.setAttribute('data-theme',theme);" +
  "})();";
