/* Zoomed shots of the mini calendar's liquid. usage: node scripts/stage3a/liquid-shot.mjs <route> <name> */
import { launch, login, OUT } from './lib.mjs';
const route = process.argv[2] ?? '/planner-lab';
const name = process.argv[3] ?? 'liquid';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
const page = await ctx.newPage();
await login(page);
await page.goto(process.env.BASE + route);
await page.waitForSelector('#mini-days', { timeout: 30000 });
await page.waitForTimeout(2500);
const box = await page.locator('#mini-days').boundingBox();
for (let i = 0; i < 3; i++) {
  await page.screenshot({ path: `${OUT}/${name}-${i}.png`, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 300) } });
  await page.waitForTimeout(700);
}
console.log(await page.evaluate(() => [...document.querySelectorAll('.liquid-water')].slice(0, 12).map((w) => `${w.dataset.layers}:${w.dataset.fill}`).join(' ')));
await browser.close();
