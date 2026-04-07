import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const astroRoot = process.cwd();
const legacyRoot = resolve(astroRoot, "..");
const publicRoot = resolve(astroRoot, "public");

await mkdir(publicRoot, { recursive: true });

const astroGeneratedFiles = [
  resolve(publicRoot, "robots.txt"),
  resolve(publicRoot, "sitemap.xml"),
];
for (const filePath of astroGeneratedFiles) {
  await rm(filePath, { force: true });
}

const copyJobs = [
  { from: resolve(legacyRoot, "assets"), to: resolve(publicRoot, "assets") },
  { from: resolve(legacyRoot, "site.webmanifest"), to: resolve(publicRoot, "site.webmanifest") },
  { from: resolve(legacyRoot, "service-worker.js"), to: resolve(publicRoot, "service-worker.js") },
  {
    from: resolve(legacyRoot, "google48e80b1ac3e5aec2.html"),
    to: resolve(publicRoot, "google48e80b1ac3e5aec2.html"),
  },
];

for (const job of copyJobs) {
  await cp(job.from, job.to, { recursive: true, force: true });
}
