/* Legend clipping over the next 3 months at phone widths. usage: BASE=... node scripts/stage3a/legend-months.mjs */
import { launch, login } from './lib.mjs';
const browser = await launch();
for (const [w, h] of [[320, 640], [360, 780], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(process.env.BASE + '/planovani');
  await page.waitForSelector('#mini-days', { state: 'attached', timeout: 30000 });
  await page.locator('button:has-text("Kalendář a termíny")').first().click();
  await page.waitForTimeout(600);
  for (let m = 0; m < 4; m++) {
    const r = await page.evaluate(() => {
      const leg = document.querySelector('.spectrum-legend'); const mc = document.querySelector('.mini-calendar').getBoundingClientRect();
      const sp = [...leg.querySelectorAll('span')].map((s) => { const b = s.getBoundingClientRect(); return `${s.textContent.trim().slice(0, 9)}:${Math.round(b.left)}-${Math.round(b.right)}`; });
      return { month: document.querySelector('#month-title').textContent, mcRight: Math.round(mc.right), clipped: [...leg.querySelectorAll('span')].some((s) => s.getBoundingClientRect().right > mc.right), sp: sp.join(' ') };
    });
    console.log(w, JSON.stringify(r));
    await page.locator('[data-command="nextMonth"]').click();
    await page.waitForTimeout(300);
  }
  await ctx.close();
}
await browser.close();
