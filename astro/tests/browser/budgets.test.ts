// Size budgets for the built pages (run `npm run build` first): bytes of HTML, CSS, JS, images
// and everything together (uncompressed, with every lazy image fetched), and DOM elements.
// The log prints the current table. Raise a limit only on purpose.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { openContext, PAGES, serveDist, VIEWPORTS, visit, type Site } from "./harness.ts";

const METRICS = ["html", "css", "js", "images", "total", "nodes"] as const;
type Metric = (typeof METRICS)[number];
/** Kilobytes (1 kB = 1000 bytes), except `nodes`, a count of elements. */
type Figures = Readonly<Record<Metric, number>>;

// Every page loads the one stylesheet; `total` also counts fonts and icons.
const CSS = 61;

// Limits sit about 15% above the largest page of each kind in November 2026. Pages whose data
// outside jobs refresh get more room: about 25% for the stats pages' scripts and elements (the
// script bundles the figures), and 35% where every Goodreads book is shown, which only grows.
const BUDGETS = {
  home: { html: 82, css: CSS, js: 62, images: 600, total: 1350, nodes: 550 },
  work: { html: 48, css: CSS, js: 9, images: 145, total: 720, nodes: 370 },
  project: { html: 84, css: CSS, js: 9, images: 660, total: 1270, nodes: 700 },
  blog: { html: 36, css: CSS, js: 8, images: 125, total: 630, nodes: 290 },
  statsEnglish: { html: 33, css: CSS, js: 93, images: 125, total: 570, nodes: 1175 },
  statsLocalised: { html: 305, css: CSS, js: 93, images: 5700, total: 6800, nodes: 3300 },
  // Every year of the shelf is open, with every cover.
  reading: { html: 325, css: CSS, js: 22, images: 6500, total: 7550, nodes: 2750 },
} as const satisfies Readonly<Record<string, Figures>>;

function budgetFor(path: string): Figures {
  const name = path.replace(/^(?:bn|ar|ur)\//, "").replace(/\.html$/, "");
  switch (name) {
    case "index":
    case "bn":
    case "ar":
    case "ur":
      return BUDGETS.home;
    case "work":
      return BUDGETS.work;
    case "project":
      return BUDGETS.project;
    case "blog":
      return BUDGETS.blog;
    case "stats":
      return path === "stats.html" ? BUDGETS.statsEnglish : BUDGETS.statsLocalised;
    case "reading":
      return BUDGETS.reading;
    default:
      return assert.fail(`${path} has no size budget: add one`);
  }
}

let site: Site | undefined;
let browser: Browser | undefined;

before(async () => {
  site = await serveDist();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await site?.close();
});

/** Loads a page from nothing and weighs everything it asks the site for. */
async function measure(path: string): Promise<Figures> {
  assert.ok(browser && site, "the browser and the server started");
  const [desktop] = VIEWPORTS;
  assert.ok(desktop, "there is a desktop viewport");
  const context = await openContext(browser, site.origin, desktop, "light");
  const page = await context.newPage();
  const bytes = { html: 0, css: 0, js: 0, images: 0, total: 0 };
  const bodies: Promise<void>[] = [];
  const failures: string[] = [];
  const { origin } = site;
  page.on("response", (response) => {
    if (!response.url().startsWith(origin)) return;
    if (!response.ok()) failures.push(`${response.status()} ${response.url()}`);
    const type = response.request().resourceType();
    bodies.push(
      response.body().then((body) => {
        bytes.total += body.length;
        if (type === "document") bytes.html += body.length;
        if (type === "stylesheet") bytes.css += body.length;
        if (type === "script") bytes.js += body.length;
        if (type === "image") bytes.images += body.length;
      }),
    );
  });

  await visit(page, site.origin, path, "light");
  const closedYears = await page.locator("details.shelf-year:not([open]):not([hidden])").count();
  assert.equal(closedYears, 0, `${path}: ${closedYears} shelf years are closed, so their covers go unweighed`);
  const nodes = await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map(async (image) => {
        image.loading = "eager";
        try {
          await image.decode();
        } catch {
          // Blocked outside images cannot decode; the site's own failures are caught by status.
        }
      }),
    );
    return document.getElementsByTagName("*").length;
  });
  await page.waitForLoadState("networkidle");
  await Promise.all(bodies);
  await context.close();
  assert.deepEqual(failures, [], failures.join("\n"));
  assert.ok(bytes.html > 0 && bytes.css > 0, `${path}: nothing was weighed`);

  const kB = (value: number): number => Math.round(value / 100) / 10;
  return {
    html: kB(bytes.html),
    css: kB(bytes.css),
    js: kB(bytes.js),
    images: kB(bytes.images),
    total: kB(bytes.total),
    nodes,
  };
}

void describe("pages stay within their budgets", () => {
  void test("every route", { timeout: 180_000 }, async (t) => {
    const over: string[] = [];
    t.diagnostic(`page | ${METRICS.map((metric) => `${metric} now/limit`).join(" | ")}`);
    for (const path of PAGES) {
      const budget = budgetFor(path);
      const figures = await measure(path);
      t.diagnostic(`${path} | ${METRICS.map((metric) => `${figures[metric]}/${budget[metric]}`).join(" | ")}`);
      for (const metric of METRICS) {
        if (figures[metric] > budget[metric]) {
          over.push(`${path}: ${metric} is ${figures[metric]}, limit ${budget[metric]}`);
        }
      }
    }
    assert.deepEqual(over, [], over.join("\n"));
  });
});
