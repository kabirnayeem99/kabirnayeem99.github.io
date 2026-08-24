// Doodles get a random icon/colour/tilt each page load (so repeat visits don't
// see the same drawing in the same spot), then drift with the page on scroll
// (parallax), rather than waking up once when they enter the viewport.
interface DoodleIcon {
  readonly file: string;
  readonly color: string;
}

const ICONS: readonly DoodleIcon[] = [
  { file: "adjustable-spanner.svg", color: "var(--mark-red)" },
  { file: "adjustable-spanner.svg", color: "var(--mark-blue)" },
  { file: "bars-up.svg", color: "var(--mark-green)" },
  { file: "bars-up.svg", color: "var(--mark-yellow)" },
  { file: "hand-drawn-clouds.svg", color: "var(--mark-blue)" },
  { file: "lantern.svg", color: "var(--mark-yellow)" },
  { file: "lantern.svg", color: "var(--mark-red)" },
  { file: "speech-bubble.svg", color: "var(--mark-red)" },
  { file: "speech-bubble.svg", color: "var(--mark-green)" },
  { file: "eraser.svg", color: "var(--mark-red)" },
  { file: "book-open.svg", color: "var(--mark-blue)" },
  { file: "book-stack.svg", color: "var(--mark-green)" },
  { file: "game-machine.svg", color: "var(--mark-yellow)" },
  { file: "feather.svg", color: "var(--mark-green)" },
  { file: "reading-person.svg", color: "var(--mark-blue)" },
  { file: "telescope.svg", color: "var(--mark-red)" },
  { file: "computer-monitor.svg", color: "var(--mark-yellow)" },
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

document.addEventListener("DOMContentLoaded", () => {
  const doodles = document.querySelectorAll<HTMLElement>(".margin-doodle");
  if (doodles.length === 0) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shuffledIcons = [...ICONS].sort(() => Math.random() - 0.5);
  for (const [index, doodle] of doodles.entries()) {
    const icon = shuffledIcons[index % shuffledIcons.length] ?? pickRandom(ICONS);
    const maskUrl = `url("/assets/icons/doodles/${icon.file}")`;
    doodle.style.setProperty("mask-image", maskUrl);
    doodle.style.setProperty("-webkit-mask-image", maskUrl);
    doodle.style.setProperty("background", icon.color);
    doodle.style.setProperty("transform", `rotate(${(Math.random() * 24 - 12).toFixed(1)}deg)`);
    doodle.style.setProperty("--doodle-depth", `${Math.round(90 + Math.random() * 140)}px`);
  }

  const supportsViewTimeline =
    typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline", "view()");

  if (reducedMotion || supportsViewTimeline) {
    return;
  }

  // Fallback parallax for browsers without native view-timeline support:
  // mirror the CSS `cover 0% cover 100%` range with a scroll listener, so
  // each doodle drifts while it's crossing the viewport (not while any part
  // of the whole document has scrolled, which barely moves on a tall page).
  let ticking = false;
  function updateParallax(): void {
    const viewportHeight = window.innerHeight;
    for (const doodle of doodles) {
      const rect = doodle.getBoundingClientRect();
      const total = viewportHeight + rect.height;
      const progress = total > 0 ? Math.min(1, Math.max(0, (viewportHeight - rect.top) / total)) : 0.5;
      const depth = Number.parseFloat(doodle.style.getPropertyValue("--doodle-depth")) || 120;
      const signedProgress = (progress - 0.5) * 2;
      doodle.style.translate = `0 ${(signedProgress * depth).toFixed(1)}px`;
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    },
    { passive: true },
  );
  updateParallax();
});
