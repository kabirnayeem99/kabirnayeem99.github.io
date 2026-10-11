// Pressed-cosmos cursor. Position follows the pointer directly (the ochre centre is
// the hotspot); spin carries momentum from pointer speed and decays like a drifting
// petal; petals open over links and close on press via a damped spring.
// Mirrors the edumax cursor model: fine pointers only, never with reduced motion or
// forced colours, and it steps aside for native controls and keyboard users.

const media = window.matchMedia(
  "(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference) and (forced-colors:none)",
);

const PETAL = "M0 -9C-11 -21 -12 -42 -6 -54L-2 -50L0 -55L3 -50L7 -53C12 -40 10 -21 0 -9Z";
const NATIVE_SELECTOR =
  "input,textarea,select,[contenteditable]:not([contenteditable='false']),iframe,video,dialog[open]";
const INTERACTIVE_SELECTOR = "a,button,summary,[role='button'],label";
const PLAIN_SELECTOR = "[data-cursor-plain]";

const OPEN_REST = 1;
const OPEN_HOVER = 1.28;
const OPEN_PRESSED = 0.62;
const MAX_SPIN = 1080; // deg/s

function buildCursor(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "cosmos-cursor";
  el.setAttribute("aria-hidden", "true");
  const petals = Array.from({ length: 8 }, (_, i) => {
    const pigment = i % 2 === 0 ? "--p-ox" : "--p-wine";
    return (
      `<g transform="rotate(${i * 45})">` +
      `<path class="cosmos-cursor-petal" d="${PETAL}" fill="var(${pigment})" opacity="${(0.86 + (i % 3) * 0.05).toFixed(2)}"/>` +
      `<path class="cosmos-cursor-petal" d="M0 -14L-2 -44M0 -14L3 -42" stroke="var(--p-wine)" stroke-width="1.4" opacity=".55" fill="none"/>` +
      `</g>`
    );
  }).join("");
  el.innerHTML =
    `<svg viewBox="-60 -60 120 120">${petals}` +
    `<circle r="12" fill="var(--p-ochre)"/>` +
    `<circle r="12" fill="none" stroke="var(--p-umber)" stroke-width="2" opacity=".55"/>` +
    `<g fill="var(--p-umber)" opacity=".75"><circle cx="-4" cy="-3" r="1.8"/><circle cx="4" cy="1" r="1.6"/>` +
    `<circle cx="0" cy="5" r="1.5"/><circle cx="-5" cy="4" r="1.4"/><circle cx="5" cy="-5" r="1.4"/></g></svg>`;
  return el;
}

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  if (!(body instanceof HTMLElement)) {
    return;
  }

  const cursor = buildCursor();
  body.append(cursor);
  const petals = Array.from(cursor.querySelectorAll<SVGPathElement>(".cosmos-cursor-petal"));

  let x = 0;
  let y = 0;
  let lastMoveAt = 0;
  let angle = 0;
  let spin = 0;
  let open = OPEN_REST;
  let targetOpen = OPEN_REST;
  let openVelocity = 0;
  let flutterPhase = 0;
  let frame = 0;
  let lastFrameAt = 0;
  let positioned = false;
  let hovered = false;
  let pressed = false;

  const hide = (): void => {
    body.classList.remove("cosmos-active");
    cursor.classList.remove("is-visible");
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrameAt = 0;
    positioned = false;
    hovered = false;
    pressed = false;
  };

  const draw = (time: number): void => {
    // Bounded substeps keep the spring stable after a slow or suspended frame.
    const dt = Math.min((time - (lastFrameAt || time - 16)) / 1000, 0.032);
    lastFrameAt = time;

    spin *= Math.exp(-dt * 2.4);
    angle = (angle + spin * dt) % 360;
    for (let elapsed = 0; elapsed < dt; ) {
      const step = Math.min(1 / 240, dt - elapsed);
      elapsed += step;
      openVelocity += ((targetOpen - open) * 520 - openVelocity * 20) * step;
      open += openVelocity * step;
    }

    // While spinning, the flower tips edge-on as if falling through air.
    const speed = Math.min(Math.abs(spin) / 900, 1);
    flutterPhase += dt * (4 + speed * 6);
    const flutter = 1 - speed * 0.28 * (0.5 + 0.5 * Math.sin(flutterPhase));

    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle.toFixed(2)}deg) scaleX(${flutter.toFixed(3)})`;
    const petalTransform = `scale(${(0.9 + open * 0.1).toFixed(3)} ${open.toFixed(3)})`;
    for (const petal of petals) {
      petal.setAttribute("transform", petalTransform);
    }

    const busy = Math.abs(spin) > 2 || Math.abs(targetOpen - open) > 0.002 || Math.abs(openVelocity) > 0.01;
    if (busy) {
      frame = requestAnimationFrame(draw);
    } else {
      frame = 0;
      lastFrameAt = 0;
    }
  };

  const schedule = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(draw);
    }
  };

  const syncTarget = (): void => {
    targetOpen = pressed ? OPEN_PRESSED : hovered ? OPEN_HOVER : OPEN_REST;
  };

  const move = (clientX: number, clientY: number, pointerType: string, target: EventTarget | null): void => {
    const element = target instanceof Element ? target : null;
    if (!media.matches || pointerType !== "mouse" || element?.closest(NATIVE_SELECTOR)) {
      hide();
      return;
    }

    const now = performance.now();
    if (positioned) {
      const dx = clientX - x;
      const dy = clientY - y;
      const velocity = Math.hypot(dx, dy) / Math.max(now - lastMoveAt, 8);
      // Speed feeds spin; horizontal direction picks clockwise vs counter-clockwise.
      const direction = Math.abs(dx) > 0.5 ? Math.sign(dx) : Math.sign(spin) || 1;
      spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, spin + direction * velocity * 140));
    } else {
      spin = 0;
      open = OPEN_REST;
      openVelocity = 0;
    }
    lastMoveAt = now;
    x = clientX;
    y = clientY;
    positioned = true;

    hovered = Boolean(element?.closest(INTERACTIVE_SELECTOR)) && !element?.closest(PLAIN_SELECTOR);
    syncTarget();
    cursor.classList.add("is-visible");
    body.classList.add("cosmos-active");
    schedule();
  };

  document.addEventListener(
    "pointermove",
    (event) => move(event.clientX, event.clientY, event.pointerType, event.target),
    { passive: true },
  );

  // Refresh hover state when scrolling brings a new element under a still mouse.
  document.addEventListener(
    "scroll",
    () => {
      if (positioned) {
        move(x, y, "mouse", document.elementFromPoint(x, y));
      }
    },
    { passive: true, capture: true },
  );

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && positioned) {
      pressed = true;
      syncTarget();
      schedule();
    }
  });
  document.addEventListener("pointerup", () => {
    pressed = false;
    syncTarget();
    if (positioned) {
      schedule();
    }
  });

  document.documentElement.addEventListener("pointerleave", hide);
  window.addEventListener("blur", hide);
  document.addEventListener("contextmenu", hide);
  document.addEventListener("pointercancel", hide);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hide();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      hide();
    }
  });
  media.addEventListener("change", hide);
});

export {};
