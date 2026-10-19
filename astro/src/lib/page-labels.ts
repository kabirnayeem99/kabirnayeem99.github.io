export const THEME_BOOTSTRAP_SCRIPT =
  "(function(){" +
  "var storageKey='person-portfolio-theme';" +
  "var theme='light';" +
  "try{" +
  "var stored=window.localStorage.getItem(storageKey);" +
  "if(stored==='light'||stored==='dark'){theme=stored;}" +
  "}catch(_error){}" +
  "document.documentElement.setAttribute('data-theme',theme);" +
  // Hide reveal targets before first paint; un-hide everything if the motion module never boots.
  "try{" +
  "if(window.matchMedia('(prefers-reduced-motion: no-preference)').matches){" +
  "var root=document.documentElement;root.classList.add('motion');" +
  // A tilted page throws off the browser's jump to a #fragment, so skip the opening there.
  "if(window.location.hash){root.classList.add('motion-anchored');}" +
  "setTimeout(function(){if(!window.__notebookMotion){root.classList.remove('motion');}},3000);" +
  "}" +
  "}catch(_error){}" +
  "})();";

