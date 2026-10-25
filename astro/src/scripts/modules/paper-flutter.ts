// Paper caught in a light air current. Elements marked [data-paper-flutter] are hinged
// at their top edge (where the tape holds them): a wind signal — a few incommensurate
// sines plus occasional gusts — drives under-damped springs for how far the sheet lifts
// off the page (shadow), a hair of sway, and the curl of the free bottom corner. The
// simulation runs in a worker; this side only writes --lift and --curl (0..1) for CSS.
// Pauses off-screen and on hidden tabs; never runs with reduced motion.

import type { FlutterCommand } from "./paper-flutter-protocol";

interface PaperView {
  readonly el: HTMLElement;
  visible: boolean;
  transform: string;
  lift: string;
  curl: string;
}

const MAX_SWAY_DEG = 0.5;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.addEventListener("DOMContentLoaded", () => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-paper-flutter]"));
  if (elements.length === 0 || typeof Worker !== "function") {
    return;
  }

  const papers: PaperView[] = elements.map((el) => ({ el, visible: true, transform: "", lift: "", curl: "" }));
  const worker = new Worker(new URL("./paper-flutter.worker.ts", import.meta.url), { type: "module" });
  const send = (command: FlutterCommand): void => worker.postMessage(command);

  const reset = (): void => {
    for (const paper of papers) {
      paper.el.style.removeProperty("transform");
      paper.el.parentElement?.style.removeProperty("--lift");
      paper.el.style.removeProperty("--curl");
      paper.transform = "";
      paper.lift = "";
      paper.curl = "";
    }
  };

  // Writes land before the next frame; unchanged values are skipped so a calm sheet
  // costs no style recalculation or repaint.
  worker.addEventListener("message", (event: MessageEvent<Float32Array>) => {
    if (reducedMotion.matches) {
      return;
    }
    const values = event.data;
    papers.forEach((paper, index) => {
      const sway = values[index * 3];
      const lift = values[index * 3 + 1];
      const curl = values[index * 3 + 2];
      if (sway === undefined || lift === undefined || curl === undefined || Number.isNaN(sway)) {
        return;
      }
      // A taped print stays flat on the page: no 3D tilt, just a hair of sway at the tape.
      const transform = `rotate(${(sway * MAX_SWAY_DEG).toFixed(2)}deg)`;
      if (transform !== paper.transform) {
        paper.transform = transform;
        paper.el.style.transform = transform;
      }
      const liftValue = lift.toFixed(3);
      if (liftValue !== paper.lift) {
        paper.lift = liftValue;
        // The shadow lives on the wrapper so it follows the curled outline.
        paper.el.parentElement?.style.setProperty("--lift", liftValue);
      }
      const curlValue = curl.toFixed(3);
      if (curlValue !== paper.curl) {
        paper.curl = curlValue;
        paper.el.style.setProperty("--curl", curlValue);
      }
    });
  });

  send({ type: "init", count: papers.length });

  const syncRunning = (): void => {
    send({ type: "run", running: !reducedMotion.matches && !document.hidden });
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const paper = papers.find((candidate) => candidate.el === entry.target);
      if (paper) {
        paper.visible = entry.isIntersecting;
      }
    }
    send({ type: "visibility", visible: papers.map((paper) => paper.visible) });
  });
  for (const paper of papers) {
    observer.observe(paper.el);
  }

  document.addEventListener("visibilitychange", syncRunning);

  reducedMotion.addEventListener("change", () => {
    syncRunning();
    if (reducedMotion.matches) {
      reset();
    }
  });

  syncRunning();
});

export {};
