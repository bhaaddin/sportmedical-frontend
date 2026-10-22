/* Screenshots of the main calendar (/planovani) at the four widths. usage: node scripts/stage3a/shots.mjs <prefix> */
import { launch, newPage, login, OUT } from './lib.mjs';
const prefix = process.argv[2] ?? 'before';
const sizes = { 390: [390, 844], 820: [820, 1180], 1440: [1440, 900], 1920: [1920, 1080] };
const browser = await launch();
for (const [w, [width, height]] of Object.entries(sizes)) {
  const page = await newPage(browser, { width, height, isMobile: width < 768, hasTouch: width < 1280 });
  await login(page);
  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('[data-testid="mini-days"], #mini-days', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${prefix}-${w}.png` });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  console.log(w, JSON.stringify(m), page.errors.slice(0, 3));
  await page.context().close();
}
await browser.close();
