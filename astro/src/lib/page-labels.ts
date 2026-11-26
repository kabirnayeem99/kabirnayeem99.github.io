// Runs in <head> before the first paint, so the right theme is there from the start.
// A stored toggle choice wins; without one the page follows the OS, live changes included.
// The two theme-color values are --bg of each theme in styles.source.css.
export const THEME_BOOTSTRAP_SCRIPT =
  "(function(){" +
  "var key='person-portfolio-theme';" +
  "var root=document.documentElement;" +
  "var media=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;" +
  // The choice made on this page, for browsers where storage is unavailable.
  "var picked=null;" +
  "function stored(){" +
  "try{var s=window.localStorage.getItem(key);if(s==='light'||s==='dark'){return s;}}catch(_error){}" +
  "return null;" +
  "}" +
  // Sets the theme, and tells the page's scripts when it differs from the one showing.
  "function apply(theme,source){" +
  "var previous=root.getAttribute('data-theme');" +
  "root.setAttribute('data-theme',theme);" +
  "var metas=document.querySelectorAll('meta[name=\\'theme-color\\']');" +
  "for(var i=0;i<metas.length;i++){metas[i].setAttribute('content',theme==='dark'?'#12100d':'#faf8f3');}" +
  "if(previous&&previous!==theme){" +
  "document.dispatchEvent(new CustomEvent('site-theme-change',{detail:{theme:theme,source:source}}));" +
  "}" +
  "}" +
  "function sync(){apply(stored()||picked||(media&&media.matches?'dark':'light'),'system');}" +
  "function choose(theme){" +
  "picked=theme;" +
  "try{window.localStorage.setItem(key,theme);}catch(_error){}" +
  "apply(theme,'toggle');" +
  "}" +
  "window.personPortfolioTheme={sync:sync,choose:choose};" +
  "sync();" +
  "if(media&&media.addEventListener){media.addEventListener('change',sync);}" +
  "})();";
