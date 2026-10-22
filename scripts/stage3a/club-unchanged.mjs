/* The club-mode planner (the lab's demo order) still has its agenda panel and its činnost select - the main calendar's R20 changes must not reach it. */
import { launch, login } from './lib.mjs';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
const page = await ctx.newPage();
await login(page);
await page.goto(process.env.BASE + '/planner-lab');
await page.waitForSelector('#mini-days', { timeout: 30000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => ({
  agenda: !!document.querySelector('#agenda-panel'),
  chips: document.querySelectorAll('#agenda-activity-chips .agenda-chip').length,
  filter: document.querySelector('#activity-filter')?.options.length ?? 0,
  strip: !!document.querySelector('[data-testid="calendar-strip"]'),
  bands: document.querySelectorAll('#mini-days .liquid-layer').length,
}));
console.log(JSON.stringify(r));
const ok = r.agenda && r.chips > 0 && r.filter > 1 && !r.strip;
console.log(ok ? 'PASS club-mode planner unchanged (agenda + činnost select, no Kalendáře strip); liquid bands there too' : 'FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
