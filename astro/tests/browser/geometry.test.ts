// Alignment checks that need no baselines, so they hold on every platform (run `npm run build`
// first): things that are meant to line up do, on every route, at desktop and phone width.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { openContext, PAGES, serveDist, VIEWPORTS, visit, type Site, type Viewport } from "./harness.ts";

/** What is wrong on the page now showing. */
async function misalignments(page: Page, viewport: Viewport["name"]): Promise<string[]> {
  return page.evaluate((view) => {
    const TOLERANCE = 1.5;
    const problems: string[] = [];
    const rtl = document.documentElement.dir === "rtl";
    /** The edge a line of text starts from. */
    const start = (box: DOMRect): number => (rtl ? box.right : box.left);
    const middle = (box: DOMRect): number => box.top + box.height / 2;
    const shown = (selector: string, root: ParentNode = document): Element[] =>
      [...root.querySelectorAll(selector)].filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
    const boxes = (selector: string, root?: ParentNode): DOMRect[] =>
      shown(selector, root).map((element) => element.getBoundingClientRect());

    const same = (what: string, values: readonly number[], tolerance = TOLERANCE): void => {
      if (values.length < 2) return;
      const spread = Math.max(...values) - Math.min(...values);
      if (spread > tolerance) {
        problems.push(`${what} differ by ${spread.toFixed(1)}px (${values.map((v) => Math.round(v)).join(", ")})`);
      }
    };

    /** Each item's icon sits level with the middle of its label. */
    const iconsLevel = (what: string, item: string, label: string): void => {
      for (const element of shown(item)) {
        const [icon] = boxes("svg", element);
        const [text] = boxes(label, element);
        if (icon !== undefined && text !== undefined) {
          same(`${what} "${element.textContent.trim()}": icon and label middles`, [middle(icon), middle(text)], 3);
        }
      }
    };

    if (view === "desktop") {
      const links = shown(".sidebar-links a");
      const navLinks = shown(".page-nav-link");
      if (links.length === 0 || navLinks.length === 0) problems.push("the sidebar links or page list are missing");
      same("contact link icons: start edges", boxes(".sidebar-links a svg").map(start));
      same("contact link labels: start edges", boxes(".sidebar-links a span").map(start));
      same("page list icons: start edges", boxes(".page-nav-link svg").map(start));
      same("page list labels: start edges", boxes(".page-nav-label").map(start));
      same("page list and contact icons: start edges", [
        ...boxes(".page-nav-link svg").slice(0, 1).map(start),
        ...boxes(".sidebar-links a svg").slice(0, 1).map(start),
      ]);
      same("contact link rows: heights", links.map((link) => link.getBoundingClientRect().height));
      const tops = links.map((link) => link.getBoundingClientRect().top);
      same("contact link rows: spacing", tops.slice(1).map((top, index) => top - (tops[index] ?? top)));
      iconsLevel("contact link", ".sidebar-links a", "span");
      iconsLevel("page list", ".page-nav-link", ".page-nav-label");

      const [sidebar] = boxes(".site-sidebar");
      const [main] = boxes("main");
      if (sidebar !== undefined && main !== undefined) {
        const gap = rtl ? sidebar.left - main.right : main.left - sidebar.right;
        if (gap < 0) problems.push(`the sidebar overlaps the content by ${(-gap).toFixed(1)}px`);
      }
    } else {
      const footer = boxes(".footer-contacts a");
      if (footer.length === 0) problems.push("the footer contact links are missing");
      same("footer contact links: middles", footer.map(middle));
      same("page list links: middles", boxes(".page-nav-link").map(middle));
    }

    same(
      "section headings: start edges",
      boxes("main .section-title").map(start),
    );
    const [content] = boxes("main");
    const [colophon] = boxes(".site-colophon");
    if (content !== undefined && colophon !== undefined) {
      same("content and footer: start edges", [start(content), start(colophon)]);
    }

    // Grids: items sharing a row line up at the top, and all have one width.
    const grids = [
      [".gr_grid_container", ":scope > div", "a img, .shelf-more-card"],
      [".github-repos-grid", ":scope > *", ""],
      [".leetcode-summary", ":scope > :not(:first-child)", ""],
    ] as const;
    for (const [grid, item, art] of grids) {
      for (const [number, container] of shown(grid).entries()) {
        const items = shown(item, container);
        const what = `${grid} #${number + 1}`;
        same(`${what}: item widths`, items.map((element) => element.getBoundingClientRect().width));
        if (art === "") continue;
        const rows = new Map<number, number[]>();
        for (const element of items) {
          const row = Math.round(element.getBoundingClientRect().top);
          const [picture] = boxes(art, element);
          if (picture !== undefined) rows.set(row, [...(rows.get(row) ?? []), picture.top]);
        }
        for (const tops of rows.values()) same(`${what}: cover tops in a row`, tops);
      }
    }
    return problems;
  }, viewport);
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

void describe("parts line up", { concurrency: true }, () => {
  for (const viewport of VIEWPORTS) {
    void test(viewport.name, { timeout: 120_000 }, async () => {
      assert.ok(browser && site, "the browser and the server started");
      const context = await openContext(browser, site.origin, viewport, "light");
      const page = await context.newPage();
      const problems: string[] = [];
      for (const path of PAGES) {
        await visit(page, site.origin, path, "light");
        problems.push(...(await misalignments(page, viewport.name)).map((problem) => `${path}: ${problem}`));
      }
      await context.close();
      assert.deepEqual(problems, [], problems.join("\n"));
    });
  }
});
