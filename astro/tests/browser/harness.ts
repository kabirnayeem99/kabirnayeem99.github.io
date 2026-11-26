// Shared by the browser checks: a local static server over dist/ (same resolution rules as
// the smoke test), the list of pages, and a browser context that cannot reach the network.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext, Page } from "playwright";
import { routesSchema } from "../../src/lib/content-schema.ts";

/** The built site; SITE_DIST points the checks at another build of it. */
const DIST = resolvePath(process.env["SITE_DIST"] ?? fileURLToPath(new URL("../../dist", import.meta.url))) + sep;

const ROUTES = routesSchema.parse(
  JSON.parse(readFileSync(new URL("../../src/data/site-content/routes.json", import.meta.url), "utf8")),
);

/** Every page named in routes.json, once. */
export const PAGES: readonly string[] = [
  ...new Set(Object.values(ROUTES).flatMap((byLang) => Object.values(byLang))),
].sort();

export interface Viewport {
  readonly name: "desktop" | "phone";
  readonly width: number;
  readonly height: number;
}

export const VIEWPORTS: readonly Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

export type Theme = "light" | "dark";
export const THEMES: readonly Theme[] = ["light", "dark"];

const TYPES: Readonly<Partial<Record<string, string>>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0] ?? "")).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(DIST, candidate);
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      return file;
    }
  }
  return null;
}

export interface Site {
  readonly origin: string;
  readonly close: () => Promise<void>;
}

/** Serves the built site on a free local port. */
export async function serveDist(): Promise<Site> {
  assert.ok(existsSync(join(DIST, "index.html")), "dist/ is missing: run `npm run build` first");
  const server = createServer((request, response) => {
    const file = resolveFile(request.url ?? "/");
    if (file === null) {
      response.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object", "the server has a port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}

/** A context for one viewport and theme: reduced motion, no service worker, nothing external. */
export async function openContext(
  browser: Browser,
  origin: string,
  viewport: Viewport,
  theme: Theme,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    locale: "en-US",
    timezoneId: "Asia/Dhaka",
  });
  await context.route(
    (url) => url.origin !== origin,
    async (route) => {
      await route.abort();
    },
  );
  return context;
}

/** Opens a page of the built site and waits until its fonts and the theme are in place. */
export async function visit(page: Page, origin: string, path: string, theme: Theme): Promise<void> {
  const response = await page.goto(`${origin}/${path}`, { waitUntil: "load" });
  assert.equal(response?.status(), 200, `${path}: HTTP ${String(response?.status())}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const shown = await page.locator("html").getAttribute("data-theme");
  assert.equal(shown, theme, `${path}: the page did not take the ${theme} theme`);
}
