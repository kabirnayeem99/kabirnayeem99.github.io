// @ts-check

/**
 * Lazy-loads the Goodreads widget script after first paint and when the main
 * thread is idle, so it doesn't block primary interactivity.
 */
document.addEventListener("DOMContentLoaded", function () {
  var scriptSource = document.body
    ? document.body.getAttribute("data-goodreads-script-src")
    : null;
  if (typeof scriptSource !== "string" || scriptSource.length === 0) {
    return;
  }
  /** @type {string} */
  var goodreadsScriptSrc = scriptSource;

  if (document.querySelector('script[data-goodreads-widget="true"]')) {
    return;
  }

  /**
   * @returns {void}
   */
  function injectScript() {
    if (document.querySelector('script[data-goodreads-widget="true"]')) {
      return;
    }

    var script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = goodreadsScriptSrc;
    script.type = "text/javascript";
    script.dataset.goodreadsWidget = "true";
    document.body.appendChild(script);
  }

  /**
   * @returns {void}
   */
  function scheduleOnIdle() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(injectScript, { timeout: 3000 });
      return;
    }

    setTimeout(injectScript, 250);
  }

  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(scheduleOnIdle);
  });
});
