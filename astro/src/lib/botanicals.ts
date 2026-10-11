// Pressed watercolour botanicals, rendered once per page as an inline SVG sprite.
// Everything is generated at build time with a seeded PRNG, so output is stable
// between builds and pages ship static markup (no client-side drawing).

export type BotanicalName =
  | "cosmos"
  | "cosmos-head"
  | "cosmos-nod"
  | "poppy"
  | "shapla"
  | "sage"
  | "euc"
  | "buds"
  | "fern"
  | "dandelion"
  | "wheat"
  | "sprig";

type Point = readonly [number, number];
type Cubic = readonly [Point, Point, Point, Point];

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const r1 = (value: number): string => (Math.round(value * 10) / 10).toString();

function pointOnCubic(curve: Cubic, t: number): Point {
  const u = 1 - t;
  const axis = (k: 0 | 1): number =>
    u * u * u * curve[0][k] +
    3 * u * u * t * curve[1][k] +
    3 * u * t * t * curve[2][k] +
    t * t * t * curve[3][k];
  return [axis(0), axis(1)];
}

function stem(d: string, width = 1.8): string {
  return `<path d="${d}" fill="none" stroke="var(--p-stem)" stroke-width="${width}" stroke-linecap="round"/>`;
}

function leaf(
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  fill: string,
  opacity: number,
  rib = true,
): string {
  const d =
    `M0 0C${r1(width * 0.7)} ${r1(-length * 0.25)} ${r1(width * 0.55)} ${r1(-length * 0.75)} 0 ${r1(-length)}` +
    `C${r1(-width * 0.55)} ${r1(-length * 0.75)} ${r1(-width * 0.7)} ${r1(-length * 0.25)} 0 0Z`;
  const ribPath = rib
    ? `<path d="M0 0L0 ${r1(-length * 0.92)}" stroke="var(--p-sage-d)" stroke-width=".7" opacity=".55"/>`
    : "";
  return `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})"><path d="${d}" fill="${fill}" opacity="${r1(opacity)}"/>${ribPath}</g>`;
}

function roundLeaf(x: number, y: number, radius: number, angle: number, fill: string, opacity: number): string {
  const d =
    `M0 0C${r1(radius)} ${r1(-radius * 0.2)} ${r1(radius * 1.1)} ${r1(-radius * 1.5)} 0 ${r1(-radius * 1.9)}` +
    `C${r1(-radius * 1.1)} ${r1(-radius * 1.5)} ${r1(-radius)} ${r1(-radius * 0.2)} 0 0Z`;
  return `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})"><path d="${d}" fill="${fill}" opacity="${r1(opacity)}"/></g>`;
}

const COSMOS_PETAL = "M0 -8C-11 -20 -12 -42 -6 -54L-2 -50L0 -55L3 -50L7 -53C12 -40 10 -20 0 -8Z";

function cosmosPetals(): string {
  return Array.from({ length: 8 }, (_, i) => {
    const pigment = i % 2 === 0 ? "--p-ox" : "--p-wine";
    const opacity = 0.78 + (i % 3) * 0.06;
    return (
      `<g transform="rotate(${i * 45 + (i % 2) * 4})"><path d="${COSMOS_PETAL}" fill="var(${pigment})" opacity="${r1(opacity)}"/>` +
      `<path d="M0 -12L-2 -46M0 -12L3 -44" stroke="var(--p-wine)" stroke-width=".6" opacity=".5"/></g>`
    );
  }).join("");
}

function generated(): Record<"sage" | "euc" | "buds" | "fern" | "dandelion" | "wheat" | "sprig", string> {
  const random = createRandom(3);

  const sageCurve: Cubic = [[70, 298], [60, 200], [84, 110], [72, 8]];
  let sage = stem("M70 298C60 200 84 110 72 8");
  for (let i = 1; i <= 8; i += 1) {
    const [x, y] = pointOnCubic(sageCurve, i / 9);
    const side = i % 2 === 1 ? 1 : -1;
    const fill = i % 3 === 0 ? "var(--p-sage-d)" : "var(--p-sage)";
    sage += leaf(x, y, 46 - i * 2.5, 18, side * (52 - i * 2), fill, 0.65 + random() * 0.25);
  }
  sage += leaf(72, 10, 30, 12, 4, "var(--p-sage)", 0.8);

  const eucCurve: Cubic = [[66, 298], [80, 210], [52, 120], [74, 14]];
  let euc = stem("M66 298C80 210 52 120 74 14", 1.6);
  for (let i = 1; i <= 9; i += 1) {
    const [x, y] = pointOnCubic(eucCurve, i / 10);
    const side = i % 2 === 1 ? 1 : -1;
    euc += stem(`M${r1(x)} ${r1(y)}l${side * 8} -4`, 1);
    const fill = i % 2 === 1 ? "var(--p-rose)" : "var(--p-blush)";
    euc += roundLeaf(x + side * 8, y - 4, 15 - i * 0.6, side * (70 + random() * 20), fill, 0.7 + random() * 0.2);
  }

  let buds = stem("M62 298C56 220 66 150 60 60", 1.5);
  const branches: readonly (readonly [number, number, number])[] = [
    [60, 230, -40], [60, 190, 36], [61, 150, -34], [60, 120, 30], [60, 90, -26], [60, 62, 8],
  ];
  for (const [x, y, angle] of branches) {
    const radians = ((angle - 90) * Math.PI) / 180;
    const length = 40 + random() * 20;
    const ex = x + Math.cos(radians) * length;
    const ey = y + Math.sin(radians) * length;
    buds += stem(`M${x} ${y}Q${r1((x + ex) / 2 + angle / 6)} ${r1((y + ey) / 2)} ${r1(ex)} ${r1(ey)}`, 1);
    buds += `<ellipse cx="${r1(ex)}" cy="${r1(ey - 5)}" rx="3.6" ry="6.5" transform="rotate(${r1(angle / 2)} ${r1(ex)} ${r1(ey)})" fill="var(--p-taupe)" opacity=".85"/>`;
  }

  let fern = `<path d="M86 218C84 160 90 90 96 10" fill="none" stroke="var(--p-fern)" stroke-width="1.8"/>`;
  for (let i = 0; i < 9; i += 1) {
    const y = 196 - i * 20;
    const x = 86 + i * 1.1;
    const pinna = 62 - i * 6;
    for (const side of [-1, 1]) {
      fern += `<g transform="translate(${r1(x)} ${y}) rotate(${side * (62 - i * 2)})"><path d="M0 0L0 ${-pinna}" stroke="var(--p-fern)" stroke-width="1"/>`;
      for (let j = 1; j < 6; j += 1) {
        const ly = (-pinna * j) / 6;
        const lw = (pinna / 7) * (1 - j / 7);
        fern += `<ellipse cx="${r1(lw * 0.7)}" cy="${r1(ly)}" rx="${r1(lw)}" ry="${r1(lw * 0.55)}" transform="rotate(-35 ${r1(lw * 0.7)} ${r1(ly)})" fill="var(--p-fern)" opacity=".7"/>`;
        fern += `<ellipse cx="${r1(-lw * 0.7)}" cy="${r1(ly)}" rx="${r1(lw)}" ry="${r1(lw * 0.55)}" transform="rotate(35 ${r1(-lw * 0.7)} ${r1(ly)})" fill="var(--p-fern)" opacity=".65"/>`;
      }
      fern += "</g>";
    }
  }

  let dandelion = stem("M40 278C30 210 48 140 40 64", 1.3);
  for (let i = 0; i < 16; i += 1) {
    const angle = ((-170 + (i * 160) / 15) * Math.PI) / 180;
    const length = 26 + random() * 6;
    const ex = 40 + Math.cos(angle) * length;
    const ey = 56 + Math.sin(angle) * length;
    dandelion +=
      `<path d="M40 60L${r1(ex)} ${r1(ey)}" stroke="var(--p-taupe)" stroke-width=".7"/>` +
      `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="1.6" fill="var(--p-taupe)"/>` +
      `<path d="M${r1(ex)} ${r1(ey)}l-3 -4M${r1(ex)} ${r1(ey)}l3 -4" stroke="var(--p-taupe)" stroke-width=".5" opacity=".7"/>`;
  }

  let wheat = `<path d="M25 288C18 220 32 150 25 40" fill="none" stroke="var(--p-wheat)" stroke-width="1.4"/>`;
  for (let i = 0; i < 18; i += 1) {
    const y = 130 - i * 5.5;
    const side = i % 2 === 1 ? 1 : -1;
    const cx = 25 + side * 4;
    wheat +=
      `<ellipse cx="${cx}" cy="${r1(y)}" rx="2.6" ry="7" transform="rotate(${side * 28} ${cx} ${r1(y)})" fill="var(--p-wheat)" opacity=".8"/>` +
      `<path d="M${25 + side * 5} ${r1(y - 6)}l${side * 5} -9" stroke="var(--p-wheat)" stroke-width=".6"/>`;
  }

  let sprig = stem("M4 26C70 18 140 30 210 22S290 18 304 22", 1.4);
  for (let i = 0; i < 11; i += 1) {
    const x = 22 + i * 25;
    const y = 24 + Math.sin(i) * 2;
    const side = i % 2 === 1 ? 1 : -1;
    const fill = i % 3 === 0 ? "var(--p-sage-d)" : "var(--p-sage)";
    sprig += leaf(x, y, 18 - i * 0.6, 8, side * 62 + 90, fill, 0.7, false);
  }
  sprig += `<use href="#bot-cosmos-head" x="288" y="8" width="30" height="30"/>`;

  return { sage, euc, buds, fern, dandelion, wheat, sprig };
}

const symbol = (name: BotanicalName, viewBox: string, body: string, filtered = true): string =>
  `<symbol id="bot-${name}" viewBox="${viewBox}">${filtered ? `<g filter="url(#bot-wc)">${body}</g>` : body}</symbol>`;

function buildSprite(): string {
  const g = generated();
  const symbols = [
    symbol(
      "cosmos-head",
      "-60 -60 120 120",
      cosmosPetals() +
        `<circle r="10" fill="var(--p-ochre)" opacity=".95"/>` +
        `<circle r="10" fill="none" stroke="var(--p-umber)" stroke-width="1.2" opacity=".6"/>` +
        `<g fill="var(--p-umber)" opacity=".7"><circle cx="-3" cy="-2" r="1.2"/><circle cx="3" cy="1" r="1.1"/><circle cx="0" cy="4" r="1"/><circle cx="-4" cy="3" r="1"/><circle cx="4" cy="-4" r="1"/></g>`,
    ),
    symbol(
      "cosmos",
      "0 0 120 320",
      `<path d="M60 60C52 120 70 170 58 230S50 290 56 318" fill="none" stroke="var(--p-stem)" stroke-width="2" stroke-linecap="round" filter="url(#bot-wc)"/>` +
        `<use href="#bot-cosmos-head" x="0" y="0" width="120" height="120"/>`,
      false,
    ),
    symbol(
      "cosmos-nod",
      "0 0 120 300",
      `<path d="M58 298C66 230 52 160 60 100S84 30 70 26" fill="none" stroke="var(--p-stem)" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M70 26c-18 2-34 12-38 30 10 16 34 18 46 6 6-12 2-28-8-36z" fill="var(--p-wine)" opacity=".85"/>` +
        `<path d="M74 30c10 6 14 20 6 30-12 8-26 6-32-2 14-2 22-12 26-28z" fill="var(--p-ox)" opacity=".85"/>` +
        `<path d="M44 62c8-6 14-12 18-20M54 66c4-8 8-16 10-26" stroke="var(--p-wine)" stroke-width=".8" fill="none" opacity=".6"/>` +
        `<circle cx="58" cy="56" r="5" fill="var(--p-ochre)" opacity=".9"/>`,
    ),
    symbol(
      "poppy",
      "0 0 70 300",
      `<path d="M36 298C28 230 44 160 34 100 30 80 34 66 36 56" fill="none" stroke="var(--p-stem)" stroke-width="2" stroke-linecap="round"/>` +
        `<ellipse cx="36" cy="36" rx="20" ry="22" fill="var(--p-pod)" opacity=".9"/>` +
        `<path d="M22 26c4 14 4 26 2 34M36 16v40M50 26c-4 14-4 26-2 34" stroke="var(--p-sage-d)" stroke-width=".8" fill="none" opacity=".55"/>` +
        `<path d="M22 16l5 -6 4 5 5 -7 5 7 4 -5 5 6c-8 4-20 4-28 0z" fill="var(--p-sage-d)" opacity=".8"/>`,
    ),
    symbol(
      "shapla",
      "0 0 200 270",
      `<path d="M20 228c4-16 40-24 80-22 44 2 80 10 80 24s-38 22-80 22c-46 0-84-8-80-24z" fill="var(--p-sage)" opacity=".75"/>` +
        `<path d="M100 230 L58 212" stroke="var(--bg)" stroke-width="3"/>` +
        `<path d="M100 230l-60 4M100 230l-40 14M100 230l20 18M100 230l62 2M100 230l50-14M100 230l8-22" stroke="var(--p-sage-d)" stroke-width=".8" opacity=".6"/>` +
        `<path d="M100 126c-3 30 4 62-2 100" fill="none" stroke="var(--p-stem)" stroke-width="2.2"/>` +
        `<g fill="var(--p-rose)" opacity=".75"><path d="M100 128c-26-14-50-34-62-62 26 8 48 30 62 62z"/><path d="M100 128c26-14 50-34 62-62-26 8-48 30-62 62z"/></g>` +
        `<g fill="var(--p-blush)" opacity=".85"><path d="M100 128c-18-22-30-50-30-82 18 22 28 50 30 82z"/><path d="M100 128c18-22 30-50 30-82-18 22-28 50-30 82z"/></g>` +
        `<path d="M100 130c-10-28-10-62 0-94 10 32 10 66 0 94z" fill="var(--p-rose)" opacity=".8"/>` +
        `<path d="M100 122V54M80 116c-8-14-12-30-12-44M120 116c8-14 12-30 12-44" stroke="var(--p-ox)" stroke-width=".7" opacity=".45" fill="none"/>` +
        `<path d="M100 132c-22 2-44-2-58-12 20-2 42 2 58 12zM100 132c22 2 44-2 58-12-20-2-42 2-58 12z" fill="var(--p-sage-d)" opacity=".8"/>` +
        `<circle cx="100" cy="112" r="6" fill="var(--p-ochre)" opacity=".9"/>`,
    ),
    symbol("sage", "0 0 140 300", g.sage),
    symbol("euc", "0 0 140 300", g.euc),
    symbol("buds", "0 0 120 300", g.buds),
    symbol("fern", "0 0 170 220", g.fern),
    symbol("dandelion", "0 0 80 280", g.dandelion),
    symbol("wheat", "0 0 50 290", g.wheat),
    symbol("sprig", "0 0 320 44", g.sprig),
  ];

  // Watercolour: wobbly edges plus pigment granulation.
  const filter =
    `<filter id="bot-wc" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4" result="warp"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="wobbly"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="grain"/>` +
    `<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" result="grainA"/>` +
    `<feComposite in="wobbly" in2="grainA" operator="arithmetic" k1="-0.35" k2="1" k3="0" k4="0"/>` +
    `</filter>`;

  return `<svg class="botanical-sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>${filter}${symbols.join("")}</defs></svg>`;
}

export const BOTANICAL_SPRITE = buildSprite();
