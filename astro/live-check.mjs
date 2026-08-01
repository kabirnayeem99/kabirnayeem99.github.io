import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
await page.goto('https://kabirnayeem99.github.io/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
const count = await page.locator('.gr_grid_book_container').count();
console.log('rendered book tiles:', count);
await browser.close();
