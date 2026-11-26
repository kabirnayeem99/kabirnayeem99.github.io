// Smoke test over the built site (run `npm run build` first). Serves dist/ locally, blocks
// every outside request (live widgets must not decide the result), and opens each route at
// desktop and phone width. Fails on: a non-200 page, an empty <title>, an uncaught page
// error or a same-origin console error, content cut off at the screen edge, and same-origin
// links or images that do not resolve.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { routesSchema } from "../src/lib/content-schema.ts";

const DIST = new URL("../dist/", import.meta.url).pathname;
const ROUTES = routesSchema.parse(
  JSON.parse(readFileSync(new URL("../src/data/site-content/routes.json", import.meta.url), "utf8")),
);
const PAGES = [...new Set(Object.values(ROUTES).flatMap((byLang) => Object.values(byLang)))].sort();
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];
const TYPES: Readonly<Partial<Record<string, string>>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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

let server: Server | undefined;
let browser: Browser | undefined;
let origin = "";

before(async () => {
  assert.ok(existsSync(join(DIST, "index.html")), "dist/ is missing: run `npm run build` first");
  server = createServer((req, res) => {
    const file = resolveFile(req.url ?? "/");
    if (file === null) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  const listening = server;
  listening.listen(0, "127.0.0.1");
  await once(listening, "listening");
  const address = server.address();
  assert.ok(address !== null && typeof address === "object", "the server has a port");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
  if (server !== undefined) await once(server, "close");
});

const linkTargets = new Set<string>();

for (const viewport of VIEWPORTS) {
  test(`every page renders cleanly (${viewport.name})`, async () => {
    assert.ok(browser, "the browser started");
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    await context.route((url) => url.origin !== origin, async (route) => route.abort());
    const page = await context.newPage();
    const problems: string[] = [];
    let current = "";
    page.on("pageerror", (error) => problems.push(`${current}: uncaught ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const source = message.location().url;
      // Outside requests are blocked on purpose; only the site's own failures count.
      if (source !== "" && !source.startsWith(origin)) return;
      if (/net::ERR_FAILED|Failed to fetch|ERR_BLOCKED/i.test(message.text())) return;
      problems.push(`${current}: console ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      // Leaving a page cancels its lazy images still in flight: not a broken request.
      if (request.failure()?.errorText === "net::ERR_ABORTED") return;
      if (request.url().startsWith(origin)) problems.push(`${current}: failed ${request.url()}`);
    });

    for (const path of PAGES) {
      current = `${path} @${viewport.name}`;
      const response = await page.goto(`${origin}/${path}`, { waitUntil: "load" });
      assert.equal(response?.status(), 200, `${current}: HTTP ${response?.status()}`);

      const report = await page.evaluate(() => ({
        title: document.title.trim(),
        // The page clips sideways overflow (overflow-x: clip), so look for content that gets cut
        // off instead: anything in the content or sidebar poking past the screen edge.
        // Decorations (aria-hidden, the pressed flowers) may hang off the edge on purpose.
        cutOff: [...document.querySelectorAll("main *, .site-sidebar *")]
          .filter((el) => !el.closest("[aria-hidden='true'], .pf, svg"))
          // Content inside its own scroller or clipping box (a wide chart, a framed shot) is
          // handled by that box, which is checked itself.
          .filter((el) => {
            for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
              if (getComputedStyle(box).overflowX !== "visible") return false;
            }
            return true;
          })
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && (box.right > window.innerWidth + 2 || box.left < -2);
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className !== "" ? "." + el.className.trim().split(/\s+/).join(".") : ""}`),
        links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((a) => a.href),
        images: [...document.images].map((img) => (img.currentSrc === "" ? img.src : img.currentSrc)).filter((src) => src !== ""),
      }));
      if (report.title.length === 0) problems.push(`${current}: empty <title>`);
      if (report.cutOff.length > 0) problems.push(`${current}: cut off at the screen edge: ${report.cutOff.join(", ")}`);
      for (const href of [...report.links, ...report.images]) {
        const url = new URL(href);
        if (url.origin === origin) linkTargets.add(url.pathname);
      }
    }
    await context.close();
    assert.deepEqual(problems, [], problems.join("\n"));
  });
}

test("same-origin links and images resolve", () => {
  assert.ok(linkTargets.size > 0, "no links collected (page tests did not run?)");
  const missing = [...linkTargets].filter((path) => resolveFile(path) === null).sort();
  assert.deepEqual(missing, [], `missing targets:\n${missing.join("\n")}`);
});
