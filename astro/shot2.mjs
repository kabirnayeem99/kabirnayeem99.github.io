import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto('http://localhost:4327/stats.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
const result = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img[src*="goodreads/"]'));
  return { count: imgs.length, broken: imgs.filter(img => !img.complete || img.naturalWidth === 0).length };
});
console.log(JSON.stringify(result));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'webp-top.png', clip: { x: 0, y: 800, width: 1280, height: 600 } });
await browser.close();
