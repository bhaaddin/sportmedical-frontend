/*
 * Writes on the DEV database and puts it back: moves the weekly lunch of the first lunch band's weekday to 12:30 through the pop-out,
 * checks the band moved (all open calendars), then moves it back to the time it had.  BASE=http://localhost:3106 node ...
 */
import { readFileSync } from 'node:fs';
import { findChrome, loadPlaywright } from '../pw-env.mjs';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' })).newPage();
page.on('response', (r) => { if (r.request().method() !== 'GET' || /periods|working-hours|lunch/.test(r.url()) || r.status() >= 400) console.log('net', r.request().method(), r.status(), r.url().replace(/.*\/api/, '/api')); });
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await page.goto(`${BASE}/login`);
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASS);
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
await page.goto(`${BASE}/planovani`);
const first = page.locator('[data-testid^="lunch-hit-"][data-lunch="weekly"]').first();
await first.waitFor({ timeout: 30000 });
const day = (await first.getAttribute('data-testid')).replace('lunch-hit-', '');
const label0 = await first.getAttribute('aria-label');
const original = /(\d\d:\d\d)–/.exec(label0)[1];
async function moveWeekly(to) {
  await page.getByTestId(`lunch-hit-${day}`).click();
  await page.getByTestId('lunch-popover').waitFor();
  await page.waitForTimeout(400);
  await page.getByTestId('lunch-start').fill(to);
  const btn = page.getByTestId('lunch-move-weekly');
  console.log('weekly button disabled:', await btn.isDisabled(), 'start value:', await page.getByTestId('lunch-start').inputValue());
  await btn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'design/leftovers/after-weekly-click.jpg', type: 'jpeg', quality: 70 });
  console.log('popover still open:', await page.getByTestId('lunch-popover').count());
  const err = page.getByTestId('lunch-error');
  if (await err.count()) console.log('pop-out error:', await err.textContent());
  const notice = await page.getByTestId('board-notice').textContent({ timeout: 20000 });
  await page.waitForTimeout(1500);
  return notice;
}
let failed = 0;
const n1 = await moveWeekly('12:30');
const label1 = await page.getByTestId(`lunch-hit-${day}`).getAttribute('aria-label');
console.log(`moved: "${n1}" band now "${label1}"`);
if (!/12:30/.test(label1 ?? '')) failed++;
const n2 = await moveWeekly(original);
const label2 = await page.getByTestId(`lunch-hit-${day}`).getAttribute('aria-label');
console.log(`back: "${n2}" band now "${label2}"`);
if (label2 !== label0) failed++;
await browser.close();
console.log(failed ? 'FAILED' : 'PASSED (weekly lunch moved and restored)');
process.exit(failed ? 1 : 0);
