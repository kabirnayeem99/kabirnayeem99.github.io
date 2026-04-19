document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>(".goodreads-widget");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const statusEl = document.querySelector<HTMLElement>("[data-goodreads-status]");

  const hasRenderedBooks = (): boolean => (
    widget.querySelectorAll(".gr_grid_book_container img").length > 0
  );

  const setStatus = (message: string, isError: boolean): void => {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = message.length === 0;
  };

  const markLoaded = (): void => {
    widget.classList.remove("is-empty", "is-error");
    widget.classList.add("is-loaded");
    setStatus("", false);
  };

  const markUnavailable = (): void => {
    widget.classList.remove("is-loaded");
    widget.classList.add("is-empty", "is-error");
    setStatus("Could not load Goodreads books right now.", true);
  };

  const buildFallbackSources = (source: string): string[] => {
    const candidates: string[] = [];

    try {
      const parsed = new URL(source);

      if (parsed.host === "i.gr-assets.com") {
        const amazonProxy = new URL(parsed.toString());
        amazonProxy.host = "images-na.ssl-images-amazon.com";
        candidates.push(amazonProxy.toString());

        let legacyPath = parsed.pathname;
        const compressedPrefix = "/images/S/compressed.photo.goodreads.com";
        if (legacyPath.startsWith(compressedPrefix)) {
          legacyPath = legacyPath.slice(compressedPrefix.length);
        }

        legacyPath = legacyPath.replace(/\._S[XY]\d+_\./, ".");
        if (legacyPath.startsWith("/books/")) {
          candidates.push(`https://images.gr-assets.com${legacyPath}`);
        }
      }
    } catch {
      return [];
    }

    return candidates.filter((candidate) => candidate !== source);
  };

  const ensureAltText = (image: HTMLImageElement): void => {
    const existingAlt = image.getAttribute("alt");
    if (typeof existingAlt === "string" && existingAlt.trim().length > 0) {
      return;
    }

    const link = image.closest("a");
    const linkTitle = link?.getAttribute("title")?.trim();
    const fallbackAlt =
      typeof linkTitle === "string" && linkTitle.length > 0
        ? `Book cover for ${linkTitle}`
        : "Goodreads book cover";
    image.setAttribute("alt", fallbackAlt);
  };

  const installFallbackMetadata = (image: HTMLImageElement): void => {
    if (image.dataset.goodreadsFallbackReady === "true") {
      return;
    }

    const source = image.getAttribute("src");
    if (typeof source !== "string" || source.length === 0) {
      return;
    }

    image.dataset.goodreadsFallbackReady = "true";
    image.dataset.goodreadsFallbackPrimary = source;
    image.dataset.goodreadsFallbackQueue = JSON.stringify(buildFallbackSources(source));
    image.dataset.goodreadsFallbackIndex = "0";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    ensureAltText(image);
  };

  const applyNextFallback = (image: HTMLImageElement): boolean => {
    const queueJson = image.dataset.goodreadsFallbackQueue;
    if (typeof queueJson !== "string" || queueJson.length === 0) {
      return false;
    }

    let decodedQueue: unknown;
    try {
      decodedQueue = JSON.parse(queueJson);
    } catch {
      return false;
    }

    if (!Array.isArray(decodedQueue)) {
      return false;
    }

    const queue = decodedQueue.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
    if (queue.length === 0) {
      return false;
    }

    const index = Number(image.dataset.goodreadsFallbackIndex || "0");
    if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
      return false;
    }

    const nextSource = queue[index];
    if (typeof nextSource !== "string" || nextSource.length === 0) {
      return false;
    }
    image.dataset.goodreadsFallbackIndex = String(index + 1);

    if (image.getAttribute("src") !== nextSource) {
      image.setAttribute("src", nextSource);
    }

    return true;
  };

  const handleImageError = (event: Event): void => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }

    if (applyNextFallback(event.target)) {
      return;
    }

    if (!hasRenderedBooks()) {
      markUnavailable();
    }
  };

  const enhanceImages = (root: ParentNode): void => {
    const images = root.querySelectorAll("img");
    images.forEach((image) => {
      installFallbackMetadata(image);

      if (image.dataset.goodreadsErrorHandlerBound !== "true") {
        image.dataset.goodreadsErrorHandlerBound = "true";
        image.addEventListener("error", handleImageError);
      }

      if (image.complete && image.naturalWidth === 0) {
        applyNextFallback(image);
      }
    });

    if (hasRenderedBooks()) {
      markLoaded();
    }
  };

  enhanceImages(widget);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) {
          installFallbackMetadata(node);
          if (node.dataset.goodreadsErrorHandlerBound !== "true") {
            node.dataset.goodreadsErrorHandlerBound = "true";
            node.addEventListener("error", handleImageError);
          }
          if (node.complete && node.naturalWidth === 0) {
            applyNextFallback(node);
          }
          return;
        }

        if (node instanceof HTMLElement) {
          enhanceImages(node);
        }
      });
    });
  });

  observer.observe(widget, { childList: true, subtree: true });

  window.setTimeout(() => {
    if (!hasRenderedBooks()) {
      markUnavailable();
    }
  }, 6000);
});
