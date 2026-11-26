// Accessibility: axe over every page in routes.json at desktop and phone width, light and
// dark, with the network blocked and reduced motion (run `npm run build` first). Every
// violation fails unless the allow-list below names it.
//
// axe cannot judge colour contrast over textured or layered backgrounds and reports those as
// "incomplete"; they are counted in the log, not failed.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser } from "playwright";
import { openContext, PAGES, serveDist, THEMES, VIEWPORTS, visit, type Site } from "./harness.ts";

interface Allowance {
  /** The axe rule id. */
  readonly rule: string;
  /** The exact selector axe reports. Never a whole page or a whole rule. */
  readonly target: string;
  /** The pages it applies to. */
  readonly pages: readonly string[];
  /** Why it cannot be fixed without changing the design or a feature. */
  readonly reason: string;
}

// Empty: nothing currently needs a design change. Add an entry only for such a case.
const ALLOWED: readonly Allowance[] = [];

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

void describe("axe finds no violations", { concurrency: true }, () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      void test(`${viewport.name}, ${theme}`, { timeout: 180_000 }, async (t) => {
        assert.ok(browser && site, "the browser and the server started");
        const context = await openContext(browser, site.origin, viewport, theme);
        const page = await context.newPage();
        const problems: string[] = [];
        let unjudged = 0;

        for (const path of PAGES) {
          await visit(page, site.origin, path, theme);
          const results = await new AxeBuilder({ page }).analyze();
          assert.ok(results.passes.length > 0, `${path}: axe checked nothing`);
          unjudged += results.incomplete.reduce((sum, result) => sum + result.nodes.length, 0);
          for (const violation of results.violations) {
            for (const node of violation.nodes) {
              const target = node.target.join(" ");
              const allowed = ALLOWED.some(
                (entry) => entry.rule === violation.id && entry.target === target && entry.pages.includes(path),
              );
              if (!allowed) {
                problems.push(`${path}: ${violation.id} (${violation.impact ?? "unrated"}) at ${target}: ${violation.help}`);
              }
            }
          }
        }

        await context.close();
        t.diagnostic(`${PAGES.length} pages; ${unjudged} elements axe could not judge (manual review)`);
        assert.deepEqual(problems, [], problems.join("\n"));
      });
    }
  }
});
