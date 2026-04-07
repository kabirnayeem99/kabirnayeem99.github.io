import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse, serialize } from "parse5";

import { parityRoutes } from "./parity-routes.mjs";

const astroRoot = process.cwd();
const projectRoot = resolve(astroRoot, "..");
const distRoot = resolve(astroRoot, "dist");
const artifactsRoot = resolve(astroRoot, ".artifacts/parity-html");

function normalizeHtml(source) {
  const serialized = serialize(parse(source));
  return serialized
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/>\s*([^<]*?)\s*</g, (_match, text) => `>${text.trim()}<`)
    .trim();
}

function slugRoute(route) {
  return route.replace(/^\//, "").replace(/\//g, "__");
}

await mkdir(artifactsRoot, { recursive: true });

let exactMatches = 0;
let normalizedMatches = 0;
let mismatches = 0;

for (const route of parityRoutes) {
  const relativePath = route.replace(/^\//, "");
  const legacyPath = resolve(projectRoot, relativePath);
  const astroPath = resolve(distRoot, relativePath);

  const [legacyHtml, astroHtml] = await Promise.all([
    readFile(legacyPath, "utf-8"),
    readFile(astroPath, "utf-8"),
  ]);

  if (legacyHtml === astroHtml) {
    exactMatches += 1;
    continue;
  }

  if (normalizeHtml(legacyHtml) === normalizeHtml(astroHtml)) {
    normalizedMatches += 1;
    continue;
  }

  mismatches += 1;
  const slug = slugRoute(route);
  await Promise.all([
    writeFile(resolve(artifactsRoot, `${slug}.legacy.html`), legacyHtml, "utf-8"),
    writeFile(resolve(artifactsRoot, `${slug}.astro.html`), astroHtml, "utf-8"),
  ]);

  console.error(`HTML mismatch: ${route}`);
}

console.log(`HTML parity summary: ${exactMatches} exact, ${normalizedMatches} normalized, ${mismatches} mismatched`);

if (mismatches > 0) {
  console.error(`Detailed HTML mismatches written to ${artifactsRoot}`);
  process.exit(1);
}
