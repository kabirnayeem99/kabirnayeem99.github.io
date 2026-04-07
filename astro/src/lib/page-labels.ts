export const SKIP_TO_MAIN_LABEL = "Skip to main content";
export const CLOSE_PAGE_LABEL = "Close page";
export const LAST_UPDATED_LABEL = "Last updated";
export const BACK_TO_TOP_LABEL = "Back to top";

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
