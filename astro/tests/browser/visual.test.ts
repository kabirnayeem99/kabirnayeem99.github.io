// Visual regression: a full-page picture of every route at desktop and phone width, compared
// with the committed baseline for this platform (run `npm run build` first). Live and dated
// data is replaced by stand-ins (fixtures.ts), so a data refresh changes nothing.
//
// Update after an intended change:  npm run test:visual:update
// Differences are written to .artifacts/visual-diff/, which each run clears.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { chromium, type Browser } from "playwright";
import { PNG } from "pngjs";
import { stabilise, useFixtures } from "./fixtures.ts";
import { openContext, PAGES, serveDist, VIEWPORTS, visit, type Site, type Theme, type Viewport } from "./harness.ts";

const BASELINES = fileURLToPath(new URL(`./baselines/${process.platform}/`, import.meta.url));
const OUTPUT = fileURLToPath(new URL("../../.artifacts/visual-diff/", import.meta.url));
const UPDATE = process.env["UPDATE_BASELINES"] === "1";

/** Pixels that may differ (anti-aliasing noise); a clipped or moved part is far more. */
const MAX_DIFFERENT_PIXELS = 20;

// Light covers every route. Dark shares the layout and differs in colour, so a sample is
// enough: each kind of page in English, plus one right-to-left page.
const DARK_PAGES = new Set([
  "index.html",
  "work.html",
  "project.html",
  "blog.html",
  "stats.html",
  "reading.html",
  "ar.html",
]);

interface Shot {
  readonly path: string;
  readonly theme: Theme;
}

const SHOTS: readonly Shot[] = [
  ...PAGES.map((path): Shot => ({ path, theme: "light" })),
  ...PAGES.filter((path) => DARK_PAGES.has(path)).map((path): Shot => ({ path, theme: "dark" })),
];

const fileName = (shot: Shot, viewport: Viewport): string =>
  `${shot.path.replace(/\.html$/, "").replaceAll("/", "-")}--${viewport.name}--${shot.theme}.png`;

/**
 * What is stored and compared: the picture at half size with the two lowest colour bits
 * dropped, which keeps the baselines under half as big and still shows a one-pixel shift.
 */
function shrink(bytes: Buffer): Buffer {
  const full = PNG.sync.read(bytes);
  const small = new PNG({ width: Math.floor(full.width / 2), height: Math.floor(full.height / 2) });
  for (let y = 0; y < small.height; y += 1) {
    for (let x = 0; x < small.width; x += 1) {
      const corner = (y * 2 * full.width + x * 2) * 4;
      const corners = [corner, corner + 4, corner + full.width * 4, corner + full.width * 4 + 4];
      for (let channel = 0; channel < 4; channel += 1) {
        const sum = corners.reduce((total, offset) => total + (full.data[offset + channel] ?? 0), 0);
        small.data[(y * small.width + x) * 4 + channel] = channel === 3 ? 255 : Math.floor(sum / 4) & 0xfc;
      }
    }
  }
  return PNG.sync.write(small, { colorType: 2, deflateLevel: 9 });
}

/** Compares with the baseline; returns what is wrong, or null. */
function compare(name: string, actualBytes: Buffer): string | null {
  const baselinePath = join(BASELINES, name);
  if (!existsSync(baselinePath)) {
    return `${name}: no baseline (run npm run test:visual:update)`;
  }
  const expected = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(actualBytes);
  const save = (suffix: string, bytes: Buffer): void => {
    mkdirSync(OUTPUT, { recursive: true });
    writeFileSync(join(OUTPUT, name.replace(/\.png$/, `.${suffix}.png`)), bytes);
  };
  if (expected.width !== actual.width || expected.height !== actual.height) {
    save("actual", actualBytes);
    return `${name}: size is ${actual.width}x${actual.height}, baseline ${expected.width}x${expected.height}`;
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const different = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
    threshold: 0.1,
  });
  if (different <= MAX_DIFFERENT_PIXELS) {
    return null;
  }
  save("actual", actualBytes);
  save("diff", PNG.sync.write(diff));
  return `${name}: ${different} pixels differ`;
}

// Linux has no committed baselines yet. Anywhere else a missing picture is a failure.
const missingPlatform = !UPDATE && process.platform === "linux" && !existsSync(BASELINES);
if (missingPlatform) {
  console.warn(
    [
      "",
      "!!! VISUAL REGRESSION SKIPPED !!!",
      `There are no baselines for "${process.platform}" (tests/browser/baselines/${process.platform}/).`,
      "Nothing was compared. Build the site, then create them in the matching Playwright image:",
      "  docker run --rm --platform linux/amd64 -v \"$PWD\":/work -w /work -e UPDATE_BASELINES=1 \\",
      "    mcr.microsoft.com/playwright:v<version of playwright in package-lock.json>-noble \\",
      "    node --test tests/browser/visual.test.ts",
      "",
    ].join("\n"),
  );
}

let site: Site | undefined;
let browser: Browser | undefined;

before(async () => {
  if (missingPlatform) return;
  // A full update starts clean, so baselines of removed pages do not linger.
  if (UPDATE) rmSync(BASELINES, { recursive: true, force: true });
  rmSync(OUTPUT, { recursive: true, force: true });
  site = await serveDist();
  browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
});

after(async () => {
  await browser?.close();
  await site?.close();
});

void describe("pages look as in the baselines", { concurrency: true, skip: missingPlatform }, () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of ["light", "dark"] as const) {
      void test(`${viewport.name}, ${theme}`, { timeout: 180_000 }, async (t) => {
        assert.ok(browser && site, "the browser and the server started");
        const context = await openContext(browser, site.origin, viewport, theme);
        await useFixtures(context, site.origin);
        const problems: string[] = [];
        const shots = SHOTS.filter((shot) => shot.theme === theme);

        for (const [index, shot] of shots.entries()) {
          const page = await context.newPage();
          await visit(page, site.origin, shot.path, theme);
          await stabilise(page);
          const bytes = shrink(await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" }));
          await page.close();

          const name = fileName(shot, viewport);
          if (UPDATE) {
            mkdirSync(BASELINES, { recursive: true });
            writeFileSync(join(BASELINES, name), bytes);
          } else {
            const problem = compare(name, bytes);
            if (problem !== null) problems.push(problem);
          }
          t.diagnostic(`${index + 1}/${shots.length} ${name}`);
        }

        await context.close();
        assert.deepEqual(problems, [], `${problems.join("\n")}\nSee ${OUTPUT}`);
      });
    }
  }
});
