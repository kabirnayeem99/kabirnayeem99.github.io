document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>(".goodreads-widget");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const scriptSource = document.body?.getAttribute("data-goodreads-script-src") ?? null;
  if (typeof scriptSource !== "string" || scriptSource.length === 0) {
    return;
  }

  const cacheTtlMs = 24 * 60 * 60 * 1000;
  const widgetId = widget.id || "default";
  const cacheKey = `goodreads-widget-cache:v2:${widgetId}:${encodeURIComponent(scriptSource)}`;

  interface GoodreadsCacheEntry {
    readonly fetchedAt: number;
    readonly html: string;
    readonly scriptSource: string;
  }

  const hasRenderedBooks = (): boolean => widget.querySelectorAll(".gr_grid_book_container img").length > 0;

  const readCache = (): GoodreadsCacheEntry | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (typeof raw !== "string" || raw.length === 0) {
        return null;
      }

      const decoded = JSON.parse(raw) as unknown;
      if (decoded === null || typeof decoded !== "object") {
        return null;
      }

      const entry = decoded as Partial<GoodreadsCacheEntry>;
      if (
        typeof entry.fetchedAt !== "number" ||
        !Number.isFinite(entry.fetchedAt) ||
        typeof entry.html !== "string" ||
        entry.html.length === 0 ||
        typeof entry.scriptSource !== "string" ||
        entry.scriptSource.length === 0
      ) {
        return null;
      }

      return {
        fetchedAt: entry.fetchedAt,
        html: entry.html,
        scriptSource: entry.scriptSource,
      };
    } catch {
      return null;
    }
  };

  const writeCache = (): void => {
    if (!hasRenderedBooks()) {
      return;
    }

    try {
      const entry: GoodreadsCacheEntry = {
        fetchedAt: Date.now(),
        html: widget.innerHTML,
        scriptSource,
      };
      window.localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {
      // Ignore localStorage failures and keep runtime behavior.
    }
  };

  const now = Date.now();
  const cached = readCache();
  const isFreshCache =
    cached !== null &&
    cached.scriptSource === scriptSource &&
    now - cached.fetchedAt < cacheTtlMs;

  if (isFreshCache && cached !== null) {
    widget.innerHTML = cached.html;
  }

  const hasInjectedWidgetScript = (): boolean => (
    document.querySelector('script[data-goodreads-widget="true"]') !== null
  );

  // Call Goodreads at most once per 24h for each widget/script variant.
  if (isFreshCache || hasInjectedWidgetScript()) {
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
    script.addEventListener("load", () => {
      // Goodreads script populates #gr_grid_widget_*; cache whichever HTML it renders.
      window.setTimeout(writeCache, 150);
    });
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
