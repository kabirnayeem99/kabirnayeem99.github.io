import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const astroRoot = process.cwd();
const projectRoot = resolve(astroRoot, "..");
const distRoot = resolve(astroRoot, "dist");
const artifactsRoot = resolve(astroRoot, ".artifacts/parity-static");

const parityFiles = ["robots.txt", "sitemap.xml"];

await mkdir(artifactsRoot, { recursive: true });

let mismatches = 0;

for (const filePath of parityFiles) {
  const legacyPath = resolve(projectRoot, filePath);
  const astroPath = resolve(distRoot, filePath);

  const [legacySource, astroSource] = await Promise.all([
    readFile(legacyPath, "utf-8"),
    readFile(astroPath, "utf-8"),
  ]);

  if (legacySource === astroSource) {
    continue;
  }

  mismatches += 1;
  const slug = filePath.replaceAll("/", "__");
  await Promise.all([
    writeFile(resolve(artifactsRoot, `${slug}.legacy`), legacySource, "utf-8"),
    writeFile(resolve(artifactsRoot, `${slug}.astro`), astroSource, "utf-8"),
  ]);
  console.error(`Static file mismatch: ${filePath}`);
}

console.log(`Static parity summary: ${parityFiles.length - mismatches} matched, ${mismatches} mismatched`);

if (mismatches > 0) {
  console.error(`Detailed static mismatches written to ${artifactsRoot}`);
  process.exit(1);
}
