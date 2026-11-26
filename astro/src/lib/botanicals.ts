// The pressed watercolour cosmos beside the sidebar avatar, rendered once per page as an
// inline SVG sprite at build time (static markup, no client-side drawing).

const r1 = (value: number): string => (Math.round(value * 10) / 10).toString();

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

function buildSprite(): string {
  const flower =
    cosmosPetals() +
      `<circle r="10" fill="var(--p-ochre)" opacity=".95"/>` +
      `<circle r="10" fill="none" stroke="var(--p-umber)" stroke-width="1.2" opacity=".6"/>` +
      `<g fill="var(--p-umber)" opacity=".7"><circle cx="-3" cy="-2" r="1.2"/><circle cx="3" cy="1" r="1.1"/><circle cx="0" cy="4" r="1"/><circle cx="-4" cy="3" r="1"/><circle cx="4" cy="-4" r="1"/></g>`;

  // Watercolour: wobbly edges plus pigment granulation.
  const filter =
    `<filter id="bot-wc" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4" result="warp"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="wobbly"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="grain"/>` +
    `<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" result="grainA"/>` +
    `<feComposite in="wobbly" in2="grainA" operator="arithmetic" k1="-0.35" k2="1" k3="0" k4="0"/>` +
    `</filter>`;

  const symbol = `<symbol id="bot-cosmos-head" viewBox="-60 -60 120 120"><g filter="url(#bot-wc)">${flower}</g></symbol>`;

  return `<svg class="botanical-sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>${filter}${symbol}</defs></svg>`;
}

export const BOTANICAL_SPRITE = buildSprite();
