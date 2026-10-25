/// <reference lib="webworker" />
// Wind and spring simulation for paper-flutter, off the main thread. The page sends which
// papers are on screen and whether to run; this posts back one frame of [sway, lift, curl]
// per paper (NaN for papers it skipped) and the page only writes the styles.

import type { FlutterCommand } from "./paper-flutter-protocol";

interface PaperState {
  readonly seed: number;
  lift: number;
  liftVelocity: number;
  sway: number;
  swayVelocity: number;
  curl: number;
  curlVelocity: number;
  visible: boolean;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
const FRAME_MS = 1000 / 60;

// Dedicated workers have requestAnimationFrame in Chromium and Firefox; fall back to a timer.
const nextFrame: (callback: (time: number) => void) => number =
  typeof scope.requestAnimationFrame === "function"
    ? (callback) => scope.requestAnimationFrame(callback)
    : (callback) => setTimeout(() => callback(performance.now()), FRAME_MS) as unknown as number;
const cancelFrame: (handle: number) => void =
  typeof scope.cancelAnimationFrame === "function"
    ? (handle) => scope.cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle);

let papers: PaperState[] = [];
let running = false;
let frame = 0;
let lastTime = 0;
let elapsed = 0;
let gust = 0;
let gustTarget = 0;
let nextGustAt = 3 + Math.random() * 4;

function windAt(t: number, seed: number, gustLevel: number): number {
  // Smooth, never-repeating breeze in 0..1.
  const breeze =
    0.42 +
    0.24 * Math.sin(t * 0.63 + seed) +
    0.14 * Math.sin(t * 1.71 + seed * 2.3) +
    0.08 * Math.sin(t * 3.9 + seed * 0.7);
  return Math.min(1, Math.max(0, breeze + gustLevel));
}

function step(time: number): void {
  frame = 0;
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

  const out = new Float32Array(papers.length * 3).fill(Number.NaN);
  let anyVisible = false;
  papers.forEach((paper, index) => {
    if (!paper.visible) {
      return;
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

    out[index * 3] = paper.sway;
    out[index * 3 + 1] = Math.min(1, Math.max(0, paper.lift));
    out[index * 3 + 2] = Math.min(1, Math.max(0, paper.curl));
  });

  if (anyVisible) {
    scope.postMessage(out, [out.buffer]);
  }
  if (running && anyVisible) {
    frame = nextFrame(step);
  } else {
    lastTime = 0;
  }
}

function start(): void {
  if (frame === 0 && running && papers.some((paper) => paper.visible)) {
    frame = nextFrame(step);
  }
}

scope.addEventListener("message", (event: MessageEvent<FlutterCommand>) => {
  const command = event.data;
  switch (command.type) {
    case "init":
      papers = Array.from({ length: command.count }, (_, index) => ({
        seed: 1.7 + index * 2.9,
        lift: 0,
        liftVelocity: 0,
        sway: 0,
        swayVelocity: 0,
        curl: 0,
        curlVelocity: 0,
        visible: true,
      }));
      break;
    case "visibility":
      for (const [index, visible] of command.visible.entries()) {
        const paper = papers[index];
        if (paper) {
          paper.visible = visible;
        }
      }
      start();
      break;
    case "run":
      running = command.running;
      if (running) {
        start();
      } else {
        cancelFrame(frame);
        frame = 0;
        lastTime = 0;
      }
      break;
  }
});
