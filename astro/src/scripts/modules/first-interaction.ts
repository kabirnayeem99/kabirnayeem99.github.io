// Runs work the first time the reader engages with the page (scroll, pointer, key), so
// optional extras and third-party requests stay off the critical loading path.

const EVENTS = ["scroll", "pointerdown", "pointermove", "keydown", "touchstart", "wheel"] as const;

export function onFirstInteraction(callback: () => void): void {
  let done = false;
  const run = (): void => {
    if (done) {
      return;
    }
    done = true;
    for (const type of EVENTS) {
      window.removeEventListener(type, run, true);
    }
    callback();
  };
  for (const type of EVENTS) {
    window.addEventListener(type, run, { capture: true, passive: true });
  }
}
