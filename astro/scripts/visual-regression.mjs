import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { parityRoutes, parityViewports } from "./parity-routes.mjs";

const astroRoot = process.cwd();
const projectRoot = resolve(astroRoot, "..");

const legacyPort = 4310;
const astroPort = 4320;
const legacyOrigin = `http://127.0.0.1:${legacyPort}`;
const astroOrigin = `http://127.0.0.1:${astroPort}`;

const artifactsRoot = resolve(astroRoot, ".artifacts/visual");
const legacyDir = resolve(artifactsRoot, "legacy");
const astroDir = resolve(artifactsRoot, "astro");
const diffDir = resolve(artifactsRoot, "diff");

const maxDiffRatio = 0.001;

function slugRoute(route) {
  return route.replace(/^\//, "").replace(/\//g, "__");
}

function startProcess(command, args, cwd, label) {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  return child;
}

async function runCommand(command, args, cwd, label) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = startProcess(command, args, cwd, label);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${label} exited with code ${code ?? -1}`));
    });
    child.on("error", (error) => rejectPromise(error));
  });
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore and retry while server starts.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child, label) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  await Promise.race([
    new Promise((resolvePromise) => child.on("exit", () => resolvePromise())),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000)),
  ]);

  if (child.exitCode === null) {
    process.stderr.write(`[${label}] did not stop after SIGTERM, sending SIGKILL\n`);
    child.kill("SIGKILL");
  }
}

function comparePng(legacyBytes, astroBytes) {
  const legacyPng = PNG.sync.read(legacyBytes);
  const astroPng = PNG.sync.read(astroBytes);

  if (legacyPng.width !== astroPng.width || legacyPng.height !== astroPng.height) {
    throw new Error(
      `Screenshot dimensions differ (${legacyPng.width}x${legacyPng.height} vs ${astroPng.width}x${astroPng.height})`,
    );
  }

  const diffPng = new PNG({ width: legacyPng.width, height: legacyPng.height });
  const diffPixels = pixelmatch(
    legacyPng.data,
    astroPng.data,
    diffPng.data,
    legacyPng.width,
    legacyPng.height,
    { threshold: 0.1 },
  );

  const totalPixels = legacyPng.width * legacyPng.height;
  return {
    diffPixels,
    totalPixels,
    diffRatio: totalPixels === 0 ? 0 : diffPixels / totalPixels,
    diffPng,
  };
}

await runCommand("npm", ["run", "build"], astroRoot, "astro-build");

const legacyServer = startProcess(
  "python3",
  ["-m", "http.server", String(legacyPort), "--bind", "127.0.0.1"],
  projectRoot,
  "legacy-server",
);

const astroServer = startProcess(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(astroPort)],
  astroRoot,
  "astro-preview",
);

try {
  await Promise.all([waitForHttp(`${legacyOrigin}/index.html`), waitForHttp(`${astroOrigin}/index.html`)]);

  await Promise.all([
    mkdir(legacyDir, { recursive: true }),
    mkdir(astroDir, { recursive: true }),
    mkdir(diffDir, { recursive: true }),
  ]);

  const browser = await chromium.launch({ headless: true });

  const results = [];
  const allowedOrigins = new Set([legacyOrigin, astroOrigin]);

  for (const viewport of parityViewports) {
    for (const route of parityRoutes) {
      const slug = `${viewport.name}__${slugRoute(route)}`;
      const legacyPath = resolve(legacyDir, `${slug}.png`);
      const astroPath = resolve(astroDir, `${slug}.png`);
      const diffPath = resolve(diffDir, `${slug}.png`);

      for (const target of [
        { origin: legacyOrigin, outputPath: legacyPath },
        { origin: astroOrigin, outputPath: astroPath },
      ]) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });

        const page = await context.newPage();
        await page.route("**/*", async (routeRequest) => {
          const requestUrl = routeRequest.request().url();
          if (requestUrl.startsWith("data:") || requestUrl.startsWith("about:")) {
            await routeRequest.continue();
            return;
          }

          const origin = new URL(requestUrl).origin;
          if (allowedOrigins.has(origin)) {
            await routeRequest.continue();
            return;
          }

          await routeRequest.abort();
        });

        await page.goto(`${target.origin}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        await page.screenshot({ path: target.outputPath, fullPage: false });
        await context.close();
      }

      const [legacyPngBytes, astroPngBytes] = await Promise.all([
        readFile(legacyPath),
        readFile(astroPath),
      ]);

      const comparison = comparePng(legacyPngBytes, astroPngBytes);
      await writeFile(diffPath, PNG.sync.write(comparison.diffPng));

      results.push({
        route,
        viewport: viewport.name,
        diffPixels: comparison.diffPixels,
        totalPixels: comparison.totalPixels,
        diffRatio: comparison.diffRatio,
      });

      if (comparison.diffRatio > maxDiffRatio) {
        throw new Error(
          `Visual mismatch beyond threshold for ${route} (${viewport.name}): ratio=${comparison.diffRatio.toFixed(6)}`,
        );
      }
    }
  }

  await browser.close();

  await writeFile(resolve(artifactsRoot, "summary.json"), JSON.stringify(results, null, 2), "utf-8");
  console.log(`Visual parity passed for ${results.length} snapshots. Summary: ${resolve(artifactsRoot, "summary.json")}`);
} finally {
  await Promise.all([stopProcess(legacyServer, "legacy-server"), stopProcess(astroServer, "astro-preview")]);
}
