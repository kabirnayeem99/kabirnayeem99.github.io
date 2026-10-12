// Hand-drawn chart pieces shared by the stats widgets: a watercolour meter bar for
// legend rows and the pencil decoration (rings, centre hole, label) for pie charts.

const SVG_NS = "http://www.w3.org/2000/svg";

/** A wash-filled bar whose length is `share` (0..1) of the row; `index` staggers the draw-in. */
export function createMeter(color: string, share: number, index: number): HTMLSpanElement {
  const meter = document.createElement("span");
  meter.className = "chart-meter";
  meter.setAttribute("aria-hidden", "true");

  const fill = document.createElement("span");
  fill.className = "chart-meter-fill";
  fill.style.setProperty("--c", color);
  fill.style.setProperty("--share", `${(Math.min(1, Math.max(0, share)) * 100).toFixed(2)}%`);
  fill.style.setProperty("--i", String(index));

  meter.appendChild(fill);
  return meter;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Turns a 200×200 pie into a pencilled donut: punches a paper-coloured hole, rings it
 * twice in pencil (slightly off, like a hand-drawn circle) and writes the leading
 * item in the middle.
 */
export function decorateDonut(svg: SVGSVGElement, title: string, value: string): void {
  svg.appendChild(svgEl("circle", { class: "chart-donut-hole", cx: "100", cy: "100", r: "50" }));
  svg.appendChild(svgEl("circle", { class: "chart-donut-ring", cx: "100", cy: "100", r: "90" }));
  svg.appendChild(
    svgEl("ellipse", { class: "chart-donut-ring chart-donut-ring--echo", cx: "100.8", cy: "99.4", rx: "91.5", ry: "90.4" }),
  );
  svg.appendChild(svgEl("circle", { class: "chart-donut-ring chart-donut-ring--inner", cx: "100", cy: "100", r: "50" }));

  const titleText = svgEl("text", { class: "chart-donut-title", x: "100", y: "96", "text-anchor": "middle" });
  titleText.textContent = title;
  const valueText = svgEl("text", { class: "chart-donut-value", x: "100", y: "125", "text-anchor": "middle" });
  valueText.textContent = value;
  svg.appendChild(titleText);
  svg.appendChild(valueText);
}
