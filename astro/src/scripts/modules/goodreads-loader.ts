document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>(".goodreads-widget");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const scriptSource = document.body?.getAttribute("data-goodreads-script-src") ?? null;
  if (typeof scriptSource !== "string" || scriptSource.length === 0) {
    return;
  }

  const widgetId = widget.id || "default";
  const cacheKey = `goodreads-widget-cache:v4:${widgetId}:${encodeURIComponent(scriptSource)}`;

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

  const isIndexPage = document.body?.getAttribute("data-page-id") === "index";
  const statsBooksHref = widget.dataset.statsBooksHref ?? null;
  const INDEX_BOOK_LIMIT = 16;

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

  // --- Diffing helpers -----------------------------------------------------
  // Every layer (server-rendered snapshot, cached copy, live Goodreads response)
  // renders the same ".gr_grid_container > .gr_grid_book_container" shape. Instead
  // of blindly overwriting the widget's innerHTML on every layer (which restarts
  // image decoding and causes a visible flash even when nothing changed), we diff
  // book order by href and only touch the DOM when it actually differs.

  const BOOK_SELECTOR = ".gr_grid_book_container";

  const getGridContainer = (root: ParentNode): HTMLElement | null =>
    root.querySelector<HTMLElement>(".gr_grid_container") ??
    (root instanceof HTMLElement && root.classList.contains("gr_grid_container") ? root : null);

  const bookKeyFor = (el: Element): string | null => {
    const href = el.querySelector("a[href]")?.getAttribute("href");
    return typeof href === "string" && href.length > 0 ? href : null;
  };

  const readBookOrder = (root: ParentNode): string[] => {
    const keys: string[] = [];
    root.querySelectorAll(BOOK_SELECTOR).forEach((el) => {
      const key = bookKeyFor(el);
      if (key !== null) keys.push(key);
    });
    return keys;
  };

  const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  const prefersReducedMotion = (): boolean =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const keyedBooks = (root: ParentNode): Map<string, HTMLElement> => {
    const map = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>(BOOK_SELECTOR).forEach((el) => {
      const key = bookKeyFor(el);
      if (key !== null && !map.has(key)) map.set(key, el);
    });
    return map;
  };

  // Reconciles `targetGrid`'s book order to match `sourceGrid`. Existing DOM nodes are
  // moved (never recreated), so already-decoded images never re-flash. Books that are
  // genuinely new are cloned in and fade/slide into place at their new position (almost
  // always the front, since the feed is sorted latest-read-first); everything already on
  // screen glides to its new slot via a FLIP transform instead of jumping there instantly.
  const reconcileBookOrder = (
    targetGrid: HTMLElement,
    sourceGrid: HTMLElement,
    { animate }: { animate: boolean },
  ): boolean => {
    const currentOrder = readBookOrder(targetGrid);
    const nextOrder = readBookOrder(sourceGrid);
    if (sameOrder(currentOrder, nextOrder)) {
      return false;
    }

    const existingByKey = keyedBooks(targetGrid);
    const sourceByKey = keyedBooks(sourceGrid);

    const firstRects = animate
      ? new Map(Array.from(existingByKey.values(), (el) => [el, el.getBoundingClientRect()] as const))
      : null;

    const finalNodes: HTMLElement[] = [];
    const enteringNodes: HTMLElement[] = [];
    nextOrder.forEach((key) => {
      const existing = existingByKey.get(key);
      if (existing) {
        finalNodes.push(existing);
        return;
      }
      const fresh = sourceByKey.get(key);
      if (!fresh) return;
      const clone = fresh.cloneNode(true) as HTMLElement;
      finalNodes.push(clone);
      enteringNodes.push(clone);
    });

    const fragment = document.createDocumentFragment();
    finalNodes.forEach((node) => fragment.appendChild(node));
    Array.from(sourceGrid.children).forEach((child) => {
      if (child instanceof HTMLElement && !child.classList.contains("gr_grid_book_container")) {
        fragment.appendChild(child.cloneNode(true));
      }
    });
    targetGrid.replaceChildren(fragment);

    if (!animate || firstRects === null || prefersReducedMotion()) {
      return true;
    }

    finalNodes.forEach((node) => {
      const first = firstRects.get(node);
      if (!first) return;
      const last = node.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx === 0 && dy === 0) return;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    // Flush the inverted transforms above before clearing them, so the browser has
    // something to transition *from* (classic FLIP: force layout between the two).
    void targetGrid.offsetHeight;

    finalNodes.forEach((node) => {
      if (!firstRects.has(node)) return;
      node.style.transition = "";
      node.style.transform = "";
    });

    enteringNodes.forEach((node) => {
      node.classList.add("is-book-entering");
      node.addEventListener("animationend", () => node.classList.remove("is-book-entering"), { once: true });
    });

    return true;
  };

  // --- Layer 1: server-rendered snapshot is already visible. -----------------
  // --- Layer 2: local cache is an instant, unanimated sync-up. --------------
  const cached = readCache();
  const hasMatchingCache = cached !== null && cached.scriptSource === scriptSource;

  if (hasMatchingCache && cached !== null) {
    const parsed = document.createElement("div");
    parsed.innerHTML = cached.html;
    const sourceGrid = getGridContainer(parsed);
    const targetGrid = getGridContainer(widget);
    const changed =
      sourceGrid && targetGrid ? reconcileBookOrder(targetGrid, sourceGrid, { animate: false }) : false;

    // The server-rendered shelf already ships pre-trimmed with its placeholder tile in
    // place, so only rebuild it when the cache actually reordered something - otherwise
    // this would strip and re-append an identical placeholder for no visible reason.
    if (changed) {
      applyIndexBookLimit();
    }
  }

  // --- Layer 3: live Goodreads widget script. --------------------------------
  // Goodreads' script looks up `document.getElementById(widgetId)` and assigns
  // `innerHTML` to whatever it finds. We redirect that single lookup to a detached
  // element so the script's response can be diffed and animated in on our terms,
  // instead of Goodreads blowing away the visible widget the instant it loads.
  const hasInjectedWidgetScript = (): boolean => (
    document.querySelector('script[data-goodreads-widget="true"]') !== null
  );

  if (hasInjectedWidgetScript()) {
    return;
  }

  const applyLiveResponse = (detached: HTMLElement): void => {
    const sourceGrid = getGridContainer(detached);
    const targetGrid = getGridContainer(widget);
    const changed =
      sourceGrid && targetGrid ? reconcileBookOrder(targetGrid, sourceGrid, { animate: true }) : false;

    // Refresh the cache regardless (Goodreads may have swapped a cover edition even
    // when order didn't change), but only touch the placeholder tile when something
    // actually moved - otherwise this is a silent no-op the visitor never sees.
    writeCache();
    if (changed) {
      applyIndexBookLimit();
    }
  };

  const injectScript = (): void => {
    if (hasInjectedWidgetScript()) {
      return;
    }

    const detachedTarget = document.createElement("div");
    const originalGetElementById = document.getElementById.bind(document);
    let restored = false;
    const restoreGetElementById = (): void => {
      if (restored) return;
      restored = true;
      document.getElementById = originalGetElementById;
    };

    document.getElementById = ((id: string): HTMLElement | null => (
      id === widgetId ? detachedTarget : originalGetElementById(id)
    )) as typeof document.getElementById;

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = scriptSource;
    script.type = "text/javascript";
    script.dataset.goodreadsWidget = "true";
    script.addEventListener("load", () => {
      restoreGetElementById();
      applyLiveResponse(detachedTarget);
    });
    script.addEventListener("error", () => {
      restoreGetElementById();
      applyIndexBookLimit();
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
