// Page motion: things fade in as they scroll into view, margin flowers appear, and a thin
// ribbon tracks reading progress. The bootstrap in <head> adds html.motion before first paint
// (only with no reduced-motion preference); this module sets __notebookMotion so that
// fallback does not un-hide the page.

declare global {
  interface Window {
    __notebookMotion?: boolean;
  }
}

// First-screen content (masthead, intro, the opening section's text) animates in from CSS
// alone and is never hidden, so it paints with the page.
const REVEAL_SELECTOR = [
  ".section-head",
  ".sprig",
  "main > section:not(:first-of-type) > p",
  ".entry",
  ".highlight",
  ".journal-prints",
  ".article-item",
  ".sticker-group",
  ".gr_grid_book_container",
  ".gr_grid_book_placeholder",
  ".section-actions",
  ".stats-card",
  ".github-repo-card",
  ".pf",
  ".pinned",
].join(",");


const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

function setupReveals(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      // Stagger whatever arrives together, in document order.
      const arriving = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      arriving.forEach((el, index) => {
        el.style.setProperty("--reveal-delay", `${Math.min(index, 4) * 35}ms`);
        el.classList.add("is-inked");
        observer.unobserve(el);
      });
    },
    // Any pixel counts: a ratio threshold can never be met by a card many screens tall.
    // Touch flings outrun the observer, so there content starts inking just below the fold.
    { rootMargin: finePointer.matches ? "0px 0px -6% 0px" : "0px 0px 25% 0px", threshold: 0 },
  );
  const observeWithin = (scope: ParentNode): void => {
    for (const target of scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
      if (!target.classList.contains("is-inked")) {
        observer.observe(target);
      }
    }
  };
  observeWithin(document);

  // Widgets (Goodreads, GitHub) render their cards after load.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        if (node.matches(REVEAL_SELECTOR) && !node.classList.contains("is-inked")) {
          observer.observe(node);
        }
        observeWithin(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function setupRibbon(): void {
  const ribbon = document.createElement("div");
  ribbon.className = "reading-ribbon";
  ribbon.setAttribute("aria-hidden", "true");
  document.body.append(ribbon);

  // Where supported, CSS drives the ribbon from a scroll timeline on the compositor thread.
  if (CSS.supports("animation-timeline: scroll()")) {
    return;
  }

  let frame = 0;
  const update = (): void => {
    frame = 0;
    const scrollable = root.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    ribbon.style.setProperty("--progress", progress.toFixed(4));
  };
  const schedule = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
}

function boot(): void {
  window.__notebookMotion = true;
  if (reducedMotion.matches) {
    root.classList.remove("motion");
    return;
  }
  root.classList.add("motion");
  setupReveals();
  setupRibbon();
}

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    root.classList.remove("motion");
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export {};
