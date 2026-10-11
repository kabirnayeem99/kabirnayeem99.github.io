// Paper caught in a light air current. Elements marked [data-paper-flutter] are hinged
// at their top edge (where the tape holds them): a wind signal — a few incommensurate
// sines plus occasional gusts — drives under-damped springs for how far the sheet lifts
// off the page (shadow), a hair of sway, and the curl of the free bottom corner. Writes --lift (0..1) and --peel
// for CSS; pauses off-screen and on hidden tabs; never runs with reduced motion.

interface PaperState {
  readonly el: HTMLElement;
  readonly seed: number;
  lift: number;
  liftVelocity: number;
  sway: number;
  swayVelocity: number;
  curl: number;
  curlVelocity: number;
  visible: boolean;
}

const MAX_CURL_PX = 30;
const MAX_SWAY_DEG = 0.5;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function windAt(t: number, seed: number, gust: number): number {
  // Smooth, never-repeating breeze in 0..1.
  const breeze =
    0.42 +
    0.24 * Math.sin(t * 0.63 + seed) +
    0.14 * Math.sin(t * 1.71 + seed * 2.3) +
    0.08 * Math.sin(t * 3.9 + seed * 0.7);
  return Math.min(1, Math.max(0, breeze + gust));
}

document.addEventListener("DOMContentLoaded", () => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-paper-flutter]"));
  if (elements.length === 0) {
    return;
  }

  const papers: PaperState[] = elements.map((el, index) => ({
    el,
    seed: 1.7 + index * 2.9,
    lift: 0,
    liftVelocity: 0,
    sway: 0,
    swayVelocity: 0,
    curl: 0,
    curlVelocity: 0,
    visible: true,
  }));

  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let gust = 0;
  let gustTarget = 0;
  let nextGustAt = 3 + Math.random() * 4;

  const reset = (): void => {
    for (const paper of papers) {
      paper.el.style.removeProperty("transform");
      paper.el.style.removeProperty("--lift");
      paper.el.parentElement?.style.removeProperty("--lift");
      paper.el.style.removeProperty("--peel");
    }
  };

  const step = (time: number): void => {
    const dt = Math.min((time - (lastTime || time - 16)) / 1000, 0.05);
    lastTime = time;
    elapsed += dt;

    // Occasional gusts: ramp up quickly, die away slowly.
    if (elapsed > nextGustAt) {
      gustTarget = 0.35 + Math.random() * 0.4;
      nextGustAt = elapsed + 4 + Math.random() * 6;
    }
    gust += (gustTarget - gust) * Math.min(1, dt * 3.2);
    gustTarget *= Math.exp(-dt * 0.9);

    let anyVisible = false;
    for (const paper of papers) {
      if (!paper.visible) {
        continue;
      }
      anyVisible = true;
      const wind = windAt(elapsed, paper.seed, gust);

      // Fixed substeps keep the springs stable.
      for (let done = 0; done < dt; ) {
        const h = Math.min(1 / 120, dt - done);
        done += h;
        // Small random buffeting, stronger when the wind is up.
        const buffet = (Math.random() - 0.5) * wind * 26;
        paper.liftVelocity += ((wind * 0.85 - paper.lift) * 34 - paper.liftVelocity * 4.2 + buffet) * h;
        paper.lift += paper.liftVelocity * h;
        paper.curlVelocity += ((wind - paper.curl) * 46 - paper.curlVelocity * 5.5 + buffet * 0.8) * h;
        paper.curl += paper.curlVelocity * h;
        const swayTarget = Math.sin(elapsed * 0.9 + paper.seed) * wind;
        paper.swayVelocity += ((swayTarget - paper.sway) * 18 - paper.swayVelocity * 3.4) * h;
        paper.sway += paper.swayVelocity * h;
      }

      const lift = Math.min(1, Math.max(0, paper.lift));
      const curl = Math.min(1, Math.max(0, paper.curl));
      // A taped print stays flat on the page: no 3D tilt, just a hair of sway at the tape.
      paper.el.style.transform = `rotate(${(paper.sway * MAX_SWAY_DEG).toFixed(2)}deg)`;
      paper.el.style.setProperty("--lift", lift.toFixed(3));
      // The shadow lives on the wrapper so it follows the curled outline.
      paper.el.parentElement?.style.setProperty("--lift", lift.toFixed(3));
      paper.el.style.setProperty("--peel", `${(curl * MAX_CURL_PX).toFixed(1)}px`);
    }

    frame = anyVisible && !document.hidden ? requestAnimationFrame(step) : 0;
    if (frame === 0) {
      lastTime = 0;
    }
  };

  const start = (): void => {
    if (frame === 0 && !reducedMotion.matches && !document.hidden) {
      frame = requestAnimationFrame(step);
    }
  };

  const stop = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const paper = papers.find((candidate) => candidate.el === entry.target);
      if (paper) {
        paper.visible = entry.isIntersecting;
      }
    }
    if (papers.some((paper) => paper.visible)) {
      start();
    }
  });
  for (const paper of papers) {
    observer.observe(paper.el);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      stop();
      reset();
    } else {
      start();
    }
  });

  start();
});

export {};
