import { launch, login, settle, BASE, spa } from './lib.mjs';
import fs from 'fs';
const label = process.argv[2] || 'before';
const { browser, page, log } = await launch();
const CLUB = '942e2676-d730-4a13-8016-17f95abd26e2';
const results = [];
const notes = [];
let t0;
async function scen(name, fn, waitSel) {
  log.scen = name; const from = log.length; const start = Date.now();
  let tv = null;
  try {
    await fn();
    if (waitSel) { try { await page.waitForSelector(waitSel, { timeout: 12000 }); tv = Date.now() - start; } catch { notes.push(`${name}: selector ${waitSel} not seen`); } }
    await settle(page, 1500, 20000);
  } catch (e) { notes.push(`${name}: ERROR ${String(e).split('\n')[0]}`); }
  const reqs = log.slice(from).map(r => ({ ...r }));
  const beforeVisible = tv == null ? null : reqs.filter(r => r.start - (start - 0) <= 0 || true).length;
  results.push({ name, tv, quiet: Date.now() - start, reqs });
}
const click = async (loc, t = 4000) => { await loc.first().click({ timeout: t }); };
const goto = async (p) => { await page.goto(BASE + p); };

log.scen = 'login';
const s0 = log.length; const st = Date.now();
await login(page); await page.waitForURL('**/prehled', { timeout: 20000 }); await settle(page, 1500, 20000);
results.push({ name: '01 sign-in -> /prehled (cold)', tv: Date.now() - st, quiet: Date.now() - st, reqs: log.slice(s0).map(r => ({ ...r })) });

// 02 planner
await scen('02 /planovani cold load', () => goto('/planovani'), '[data-testid="mini-day-2026-10-26"]');
await scen('03 planner: next week', () => click(page.getByRole('button', { name: 'Následující týden' })));
await scen('04 planner: previous week (back, should be cached)', () => click(page.getByRole('button', { name: 'Předchozí týden' })));
await scen('05 planner: Den', () => click(page.getByRole('button', { name: 'Den', exact: true })));
await scen('06 planner: Měsíc', () => click(page.getByRole('button', { name: 'Měsíc', exact: true })));
await scen('07 planner: Týden again', () => click(page.getByRole('button', { name: 'Týden', exact: true })));
await scen('08 planner: change service filter', async () => { const s = page.locator('select').first(); const n = await s.count(); if (n) { await s.selectOption({ index: 1 }); } else notes.push('08 no select'); });
const vis = (v) => page.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); }, v);
await scen('09 planner: tab hidden 1 s, then visible (focus)', async () => { await vis('hidden'); await page.waitForTimeout(1000); await vis('visible'); });
await scen('09b planner: tab hidden 35 s, then visible (focus)', async () => { await vis('hidden'); await page.waitForTimeout(35000); await vis('visible'); });
// 10 clubs
await scen('10 /clubs cold load', () => goto('/clubs'), 'text=Kluby a týmy');
await scen('11 clubs -> FK Slaný (SPA nav)', async () => { await click(page.getByText('FK Slaný', { exact: false })); }, '[data-testid="mini-day-2026-10-26"]');
await scen('12 club: click a club window (popover)', async () => { await click(page.getByText('FK Slaný')); });
await scen('13 club: close popover, click it again (cache)', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(600); await click(page.getByText('FK Slaný')); });
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await scen('14 club cold load /clubs/{id}', () => goto('/clubs/' + CLUB), '[data-testid="mini-day-2026-10-26"]');
await scen('15 club: back to /clubs (Zpět na kluby)', () => click(page.getByTestId('club-back-button')));
await scen('16 /clubs/objednavky cold load', () => goto('/clubs/objednavky'), 'text=Čeká na formulář');
await scen('17 orders: open an order', async () => { await click(page.locator('[data-testid=order-row], [data-testid=order-card]')); });
await scen('17b orders: open another order', async () => { await page.locator('[data-testid=order-row], [data-testid=order-card]').nth(1).click({ timeout: 4000 }); });
await scen('18 /patients cold load', () => goto('/patients'), 'text=Petr Dvořák');
await scen('19 patients -> a patient', () => click(page.getByText('Petr Dvořák')), 'text=Petr');
for (const p of ['/nastaveni/cenik', '/nastaveni/sluzby', '/calendars']) await scen(`20 settings ${p} (cold load)`, () => goto(p));
await scen('21 settings /activities (SPA nav from /calendars)', () => spa(page, '/activities'));
await scen('22 SPA nav /prehled', () => spa(page, '/prehled'));
await scen('23 SPA nav /planovani (remount, cache warm)', () => spa(page, '/planovani'), '[data-testid="mini-day-2026-10-26"]');
await scen('24 history back', () => page.goBack());
await scen('25 history back', () => page.goBack());
await scen('26 history forward', () => page.goForward());
await scen('27a SPA -> /clubs (fresh)', () => spa(page, '/clubs'), 'text=Kluby a týmy');
await scen('27b SPA -> /clubs/{FK Slaný} (hover-less)', () => spa(page, '/clubs/' + CLUB), '[data-testid="mini-day-2026-10-26"]');
await scen('27c SPA -> /clubs again (<30 s)', () => spa(page, '/clubs'), 'text=Kluby a týmy');
await scen('27d SPA -> /clubs/{FK Slaný} again (<30 s)', () => spa(page, '/clubs/' + CLUB), '[data-testid="mini-day-2026-10-26"]');
await scen('27e SPA -> /planovani (<30 s of 23)', () => spa(page, '/planovani'), '[data-testid="mini-day-2026-10-26"]');
await scen('27f SPA -> /prehled -> /planovani (<30 s)', async () => { await spa(page, '/prehled'); await page.waitForTimeout(800); await spa(page, '/planovani'); }, '[data-testid="mini-day-2026-10-26"]');
fs.writeFileSync(`result-${label}.json`, JSON.stringify({ results, notes }, null, 1));
console.log(notes.join('\n'));
await browser.close();
