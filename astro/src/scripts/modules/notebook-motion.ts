// Notebook motion: things get pressed onto the page as they scroll into view, margin
// flowers grow in, a ribbon bookmark tracks reading progress, a few petals ride the air,
// cards tilt under a fine pointer and a press scatters petals. The bootstrap in <head> adds html.motion before first paint
// (only with no reduced-motion preference); this module sets __notebookMotion so that
// fallback does not un-hide the page.

declare global {
  interface Window {
    __notebookMotion?: boolean;
  }
}

import { onFirstInteraction } from "./first-interaction";

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
  ".file-card",
  ".gr_grid_book_container",
  ".gr_grid_book_placeholder",
  ".section-actions",
  ".stats-card",
  ".github-repo-card",
  ".pf",
  ".pinned",
].join(",");

const TILT_SELECTOR = ".highlight, .article-item > a, .github-repo-card, .shelf-more-card";
const BURST_SKIP_SELECTOR = "input,textarea,select,[contenteditable],iframe,video";
const PETAL_PATH = "M0 -9C-11 -21 -12 -42 -6 -54L-2 -50L0 -55L3 -50L7 -53C12 -40 10 -21 0 -9Z";
const PIGMENTS = ["--p-ox", "--p-wine", "--p-rose", "--p-ochre", "--p-blush"] as const;
const MAX_TILT_DEG = 5;

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

function petalSvg(pigment: string): string {
  return `<svg viewBox="-20 -60 40 60" aria-hidden="true"><path d="${PETAL_PATH}" fill="var(${pigment})"/></svg>`;
}

function setupReveals(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      // Stagger whatever arrives together, in document order.
      const arriving = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      arriving.forEach((el, index) => {
        el.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 50}ms`);
        el.classList.add("is-inked");
        observer.unobserve(el);
      });
    },
    // Any pixel counts: a ratio threshold can never be met by a card many screens tall.
    { rootMargin: "0px 0px -6% 0px", threshold: 0 },
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

// A handful of petals on the air, behind the cursor and above the paper.
function setupDriftingPetals(): void {
  const count = window.innerWidth < 760 ? 3 : 5;
  const layer = document.createElement("div");
  layer.className = "petal-drift";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i += 1) {
    const petal = document.createElement("span");
    petal.className = "petal-drift-petal";
    petal.innerHTML = petalSvg(PIGMENTS[i % PIGMENTS.length] ?? "--p-rose");
    petal.style.setProperty("--x", `${(Math.random() * 100).toFixed(1)}vw`);
    petal.style.setProperty("--sway", `${(Math.random() * 18 + 6).toFixed(1)}vw`);
    petal.style.setProperty("--size", `${(Math.random() * 10 + 12).toFixed(0)}px`);
    petal.style.setProperty("--fall", `${(Math.random() * 14 + 16).toFixed(1)}s`);
    petal.style.setProperty("--delay", `${(-Math.random() * 30).toFixed(1)}s`);
    petal.style.setProperty("--spin", `${Math.random() > 0.5 ? 1 : -1}`);
    layer.append(petal);
  }
  document.body.append(layer);
}

function setupTilt(): void {
  let frame = 0;
  let pending: { card: HTMLElement; x: number; y: number } | null = null;

  const apply = (): void => {
    frame = 0;
    if (!pending) {
      return;
    }
    const { card, x, y } = pending;
    pending = null;
    const rect = card.getBoundingClientRect();
    const px = (x - rect.left) / rect.width - 0.5;
    const py = (y - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-x", `${(-py * MAX_TILT_DEG).toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${(px * MAX_TILT_DEG).toFixed(2)}deg`);
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      if (!finePointer.matches || event.pointerType !== "mouse") {
        return;
      }
      const card = (event.target as Element | null)?.closest<HTMLElement>(TILT_SELECTOR);
      if (!card) {
        return;
      }
      pending = { card, x: event.clientX, y: event.clientY };
      if (frame === 0) {
        frame = requestAnimationFrame(apply);
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerout",
    (event) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(TILT_SELECTOR);
      const next = event.relatedTarget as Node | null;
      if (card && !(next && card.contains(next))) {
        if (pending?.card === card) {
          pending = null;
        }
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
      }
    },
    { passive: true },
  );
}

function burstAt(x: number, y: number): void {
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const petal = document.createElement("span");
    petal.className = "petal-burst";
    petal.setAttribute("aria-hidden", "true");
    petal.innerHTML = petalSvg(PIGMENTS[i % PIGMENTS.length] ?? "--p-ox");
    petal.style.left = `${x}px`;
    petal.style.top = `${y}px`;
    document.body.append(petal);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 46 + Math.random() * 54;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const spin = (Math.random() - 0.5) * 540;
    const animation = petal.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 0.95, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 70}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 750 + Math.random() * 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    animation.onfinish = () => petal.remove();
  }
}

function setupBurst(): void {
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.target as Element | null)?.closest(BURST_SKIP_SELECTOR)) {
      return;
    }
    burstAt(event.clientX, event.clientY);
  });
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
  onFirstInteraction(setupDriftingPetals);
  setupTilt();
  setupBurst();
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
