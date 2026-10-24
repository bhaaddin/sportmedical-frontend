/* R16b in a real browser: a club day is ONE framed block with the činnosti inside it (week, month, mini calendar, phone).
 * The dev API is an older build (no `activityIds` on time blocks), so the blocks answer is completed in the browser (route) with the
 * stage-2 fields the contract promises; everything else is the real dev data. */
import { launch, newPage, login, api, shot, SIZES } from './lib.mjs';
import { readdirSync } from 'node:fs';

const sizes = process.argv[2] ? [process.argv[2]] : ['phone', 'tablet', 'desktop'];
const browser = await launch();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
for (const size of sizes) {
  const page = await newPage(browser, size);
  await login(page);
  const acts = (await api(page, 'GET', '/api/activities')).json.data.activities.filter((a) => a.isActive).slice(0, 2);
  await page.route('**/api/calendars/*/blocks*', async (route) => {
    const res = await route.fetch();
    let json = await res.json();
    const list = json.data ?? json;
    list.forEach((b, i) => {
      if (b.kind !== 'club') return;
      const early = new Date(b.startUtc).getUTCHours() < 9;
      b.activityIds = early ? [acts[0].id] : [acts[1].id, acts[0].id];
      b.orderCode = 'KO-ZZ0001'; b.orderStatus = 'Confirmed'; b.clubOrderId = 'ord-zz'; b.playersMissing = true; b.windowEmpty = false; b.holdExpired = false; b.seats = 22; b.registered = 7;
    });
    await route.fulfill({ response: res, json });
  });
  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('.sm-planner', { timeout: 90000 });
  await page.waitForTimeout(2500);
  const phone = size === 'phone';
  if (!phone) {
    await page.click('[data-command=nextWeek]'); await page.waitForTimeout(2500);
    const wins = await page.$$('[data-testid=board-windows] .board-window.is-club');
    ok(wins.length > 0, `${size}: club windows on the week board (${wins.length})`);
    const subs = await page.$$('[data-testid=club-frame-sub]');
    ok(subs.length >= wins.length, `${size}: činnost sub-blocks inside the frames (${subs.length})`);
    const labels = await page.$$eval('.board-window.is-club .win-label', (e) => e.length);
    ok(labels === wins.length, `${size}: club name once per block (${labels}/${wins.length})`);
    const border = await page.$eval('.board-window.is-club', (e) => getComputedStyle(e).borderTopStyle + ' ' + getComputedStyle(e).borderTopWidth);
    ok(border.startsWith('solid'), `${size}: continuous frame (${border})`);
    ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), `${size}: document does not scroll`);
    await shot(page, `r16b-week-${size}`);
    // click opens the order popover, booking onto it is refused
    const first = page.locator('.board-window.is-club').first();
    await first.click();
    await page.waitForTimeout(800);
    ok(await page.locator('[role=dialog], [data-testid=club-popover], .MuiPopover-root').count() > 0, `${size}: click on the block opens the club popover/order`);
    await page.keyboard.press('Escape');
    // month
    await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(2000);
    const tiles = await page.$$('[data-testid^=tile-club-acts], .tile-club-acts');
    ok(tiles.length > 0, `${size}: month tile shows činnost segments (${tiles.length})`);
    await shot(page, `r16b-month-${size}`);
    // mini calendar
    const mini = await page.$$('.mini-clubs i[data-framed]');
    console.log(`${size}: mini frames ${mini.length}`);
  } else {
    await page.click('[data-command=nextWeek]'); await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Den', exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Pos*26. 10./ }).first().click().catch(() => {}); await page.waitForTimeout(1500);
    const entries = await page.$$('[data-testid=phone-club-acts]');
    ok(entries.length > 0, 'phone: the day agenda names the činnosti inside the club block (' + entries.length + ')');
    ok(await page.$$eval('.phone-entry-main strong', (e) => e.filter((x) => /Slaný/.test(x.textContent)).length) === 1, 'phone: club name once in the day list');
    ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), 'phone: document does not scroll');
    await shot(page, 'r16b-phone-day');
    await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(1500);
    await page.click('[data-command=nextMonth], [aria-label="Následující měsíc"]').catch(() => {});
    await page.waitForTimeout(800);
    const ma = await page.$$('[data-testid^=phone-month-club-acts-]');
    ok(ma.length > 0, 'phone: month row shows the činnosti (' + ma.length + ')');
    await shot(page, 'r16b-phone-month');
  }
  console.log(size, 'console errors:', page.errors.filter((e) => !/403|font/i.test(e)).slice(0, 3));
  await page.context().close();
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
