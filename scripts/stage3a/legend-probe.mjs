/* Measures the mini-calendar legend (clipping) at several widths. usage: BASE=http://localhost:3000 node scripts/stage3a/legend-probe.mjs */
import { launch, login } from './lib.mjs';
const browser = await launch();
for (const [w, h] of [[320, 640], [360, 780], [390, 844], [820, 1180], [1100, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1280, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(process.env.BASE + '/planovani');
  await page.waitForSelector('#mini-days', { state: 'attached', timeout: 30000 });
  if (w < 1000) { await page.locator('button:has-text("Kalendář a termíny")').first().click(); await page.waitForTimeout(600); }
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const leg = document.querySelector('.spectrum-legend'); const mc = document.querySelector('.mini-calendar');
    const spans = [...leg.querySelectorAll('span')].map((s) => ({ t: s.textContent.trim().slice(0, 12), r: Math.round(s.getBoundingClientRect().right) }));
    const sb = document.querySelector('.sidebar').getBoundingClientRect();
    return { legRight: Math.round(leg.getBoundingClientRect().right), mcRight: Math.round(mc.getBoundingClientRect().right), sbRight: Math.round(sb.right), scrollW: leg.scrollWidth, clientW: leg.clientWidth, spans };
  });
  console.log(w, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
