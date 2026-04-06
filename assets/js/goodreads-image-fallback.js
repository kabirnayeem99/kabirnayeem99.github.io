// @ts-check
/**
 * Adds resilient Goodreads cover fallbacks for mobile browsers that block
 * the default image host.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @type {HTMLElement | null} */
  var widget = document.querySelector(".goodreads-widget");
  if (!(widget instanceof HTMLElement)) {
    return;
  }
  /** @type {HTMLElement | null} */
  var statusEl = document.querySelector("[data-goodreads-status]");

  /**
   * @returns {boolean}
   */
  function hasRenderedBooks() {
    return widget.querySelectorAll(".gr_grid_book_container img").length > 0;
  }

  /**
   * @param {string} message
   * @param {boolean} isError
   * @returns {void}
   */
  function setStatus(message, isError) {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", Boolean(isError));
    statusEl.hidden = message.length === 0;
  }

  /**
   * @returns {void}
   */
  function markLoaded() {
    widget.classList.remove("is-empty", "is-error");
    widget.classList.add("is-loaded");
    setStatus("", false);
  }

  /**
   * @returns {void}
   */
  function markUnavailable() {
    widget.classList.remove("is-loaded");
    widget.classList.add("is-empty", "is-error");
    setStatus("Could not load Goodreads books right now.", true);
  }

  /**
   * @param {string} source
   * @returns {string[]}
   */
  function buildFallbackSources(source) {
    var candidates = [];

    try {
      var parsed = new URL(source);

      if (parsed.host === "i.gr-assets.com") {
        var amazonProxy = new URL(parsed.toString());
        amazonProxy.host = "images-na.ssl-images-amazon.com";
        candidates.push(amazonProxy.toString());

        var legacyPath = parsed.pathname;
        var compressedPrefix = "/images/S/compressed.photo.goodreads.com";
        if (legacyPath.indexOf(compressedPrefix) === 0) {
          legacyPath = legacyPath.slice(compressedPrefix.length);
        }

        legacyPath = legacyPath.replace(/\._S[XY]\d+_\./, ".");
        if (legacyPath.indexOf("/books/") === 0) {
          candidates.push("https://images.gr-assets.com" + legacyPath);
        }
      }
    } catch (_error) {
      return [];
    }

    return candidates.filter(function (candidate) {
      return candidate !== source;
    });
  }

  /**
   * @param {HTMLImageElement} image
   * @returns {void}
   */
  function installFallbackMetadata(image) {
    if (image.dataset.goodreadsFallbackReady === "true") {
      return;
    }

    var source = image.getAttribute("src");
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
  }

  /**
   * @param {HTMLImageElement} image
   * @returns {boolean}
   */
  function applyNextFallback(image) {
    var queueJson = image.dataset.goodreadsFallbackQueue;
    if (typeof queueJson !== "string" || queueJson.length === 0) {
      return false;
    }

    /** @type {unknown} */
    var decodedQueue;
    try {
      decodedQueue = JSON.parse(queueJson);
    } catch (_error) {
      return false;
    }

    if (!Array.isArray(decodedQueue)) {
      return false;
    }

    var queue = decodedQueue.filter(function (entry) {
      return typeof entry === "string" && entry.length > 0;
    });
    if (queue.length === 0) {
      return false;
    }

    var index = Number(image.dataset.goodreadsFallbackIndex || "0");
    if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
      return false;
    }

    var nextSource = queue[index];
    image.dataset.goodreadsFallbackIndex = String(index + 1);

    if (image.getAttribute("src") !== nextSource) {
      image.setAttribute("src", nextSource);
    }
    return true;
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  function handleImageError(event) {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }

    if (applyNextFallback(event.target)) {
      return;
    }
    if (!hasRenderedBooks()) {
      markUnavailable();
    }
  }

  /**
   * @param {ParentNode} root
   * @returns {void}
   */
  function enhanceImages(root) {
    /** @type {NodeListOf<HTMLImageElement>} */
    var images = root.querySelectorAll("img");
    images.forEach(function (image) {
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
  }

  enhanceImages(widget);

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
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

  window.setTimeout(function () {
    if (!hasRenderedBooks()) {
      markUnavailable();
    }
  }, 6000);
});
