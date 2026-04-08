document.addEventListener("DOMContentLoaded", () => {
  const scriptSource = document.body?.getAttribute("data-goodreads-script-src") ?? null;
  if (typeof scriptSource !== "string" || scriptSource.length === 0) {
    return;
  }

  const hasInjectedWidgetScript = (): boolean => (
    document.querySelector('script[data-goodreads-widget="true"]') !== null
  );

  if (hasInjectedWidgetScript()) {
    return;
  }

  const injectScript = (): void => {
    if (hasInjectedWidgetScript()) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = scriptSource;
    script.type = "text/javascript";
    script.dataset.goodreadsWidget = "true";
    document.body?.appendChild(script);
  };

  const scheduleOnIdle = (): void => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(injectScript, { timeout: 3000 });
      return;
    }

    window.setTimeout(injectScript, 250);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(scheduleOnIdle);
  });
});
