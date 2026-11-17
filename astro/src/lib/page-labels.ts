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

