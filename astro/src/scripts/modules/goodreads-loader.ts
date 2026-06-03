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
  const cacheKey = `goodreads-widget-cache:v3:${widgetId}:${encodeURIComponent(scriptSource)}`;

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

  const isIndexPage = document.body?.getAttribute("data-page-id") === "index";
  const statsBooksHref = widget.dataset.statsBooksHref ?? null;
  const INDEX_BOOK_LIMIT = 11;

  const applyIndexBookLimit = (): void => {
    if (!isIndexPage || typeof statsBooksHref !== "string" || statsBooksHref.length === 0) {
      return;
    }

    // Strip <br> clears and any Goodreads branding links/paragraphs injected by their script.
    widget.querySelectorAll(".gr_grid_book_placeholder, br").forEach((el) => el.remove());
    widget.querySelectorAll<HTMLElement>("a, p").forEach((el) => {
      if (!el.closest(".gr_grid_book_container")) el.remove();
    });

    // Find the book container div (gr_grid_container), fall back to widget root.
    const container = widget.querySelector<HTMLElement>(".gr_grid_container") ?? widget;

    // Trim books beyond the limit.
    container.querySelectorAll<HTMLElement>(".gr_grid_book_container").forEach((el, i) => {
      if (i >= INDEX_BOOK_LIMIT) el.remove();
    });

    // Append the show-more placeholder as the next float in the grid.
    const placeholder = document.createElement("div");
    placeholder.className = "gr_grid_book_placeholder";
    const link = document.createElement("a");
    link.href = statsBooksHref;
    link.textContent = "Browse all my reads";
    placeholder.appendChild(link);

    // Match exact rendered size of the book covers (Goodreads script may set its own dimensions).
    const firstBook = container.querySelector<HTMLElement>(".gr_grid_book_container");
    if (firstBook instanceof HTMLElement) {
      const h = firstBook.offsetHeight;
      const w = firstBook.offsetWidth;
      if (h > 0) placeholder.style.height = `${h}px`;
      if (w > 0) placeholder.style.width = `${w}px`;
    }

    container.appendChild(placeholder);
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

    applyIndexBookLimit();
  };

  const now = Date.now();
  const cached = readCache();
  const isFreshCache =
    cached !== null &&
    cached.scriptSource === scriptSource &&
    now - cached.fetchedAt < cacheTtlMs;

  if (isFreshCache && cached !== null) {
    widget.innerHTML = cached.html;
    applyIndexBookLimit();
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
      // Goodreads script populates #gr_grid_widget_*; cache then apply UI limit.
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
