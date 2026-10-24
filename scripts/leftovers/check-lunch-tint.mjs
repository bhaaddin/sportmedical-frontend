/*
 * Leftovers check (2026-10-24): the per-weekday lunch button in the planner's lunch pop-out and the clinic planner tint on Barvy.
 * Read-only: opens the pop-out and the page, takes screenshots, never presses a save.
 *   BASE=http://localhost:3105 node scripts/leftovers/check-lunch-tint.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from '../pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = resolve(root, 'design', 'leftovers');
mkdirSync(OUT, { recursive: true });
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
let failed = 0;
const say = (ok, what) => { if (!ok) failed++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`); };

for (const vp of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  await page.goto(`${BASE}/planovani`);
  const hit = page.locator('[data-testid^="lunch-hit-"]').first();
  const found = await hit.waitFor({ timeout: 30000 }).then(() => true, () => false);
  say(found, `${vp.width}: a lunch band is clickable`);
  if (found) {
    await hit.click();
    const pop = page.getByTestId('lunch-popover');
    await pop.waitFor({ timeout: 10000 });
    /* MUI grows the pop-out in (scale + opacity): measure once it has settled */
    await page.waitForFunction(() => { const p = document.querySelector('.MuiPopover-paper'); return p && getComputedStyle(p).opacity === '1' && !/matrix\((?!1, 0, 0, 1)/.test(getComputedStyle(p).transform); }, null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const weekly = page.getByTestId('lunch-move-weekly');
    const has = await weekly.count();
    say(has === 1, `${vp.width}: the weekly button is offered (${has ? await weekly.textContent() : 'none'})`);
    if (has) {
      const box = await weekly.boundingBox();
      say(box !== null && box.height >= 44, `${vp.width}: weekly button 44 px (${box?.height})`);
    }
    await page.screenshot({ path: join(OUT, `lunch-weekly-${vp.width}.jpg`), type: 'jpeg', quality: 70 });
    await page.keyboard.press('Escape');
  }
  await page.goto(`${BASE}/nastaveni/barvy-sluzeb`);
  const scope = page.getByTestId('tint-scope');
  const shown = await scope.waitFor({ timeout: 30000 }).then(() => true, () => false);
  say(shown, `${vp.width}: Barvy says where the tint applies: ${shown ? await scope.textContent() : '-'}`);
  await page.screenshot({ path: join(OUT, `tint-${vp.width}.jpg`), type: 'jpeg', quality: 70 });
  say(errors.length === 0, `${vp.width}: no page errors ${errors.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
