/*
 * R17 leftover / R4 in a real browser: "Přidat do objednávky klubu" in the MAIN calendar names a worker.busy clash and lets an owner /
 * administrator go over it with a reason. The dev API is an older build that never answers worker.busy, so the club order update is
 * answered in the browser (route): the first PUT with a 409 worker.busy, the second (carrying overrideReason) with the order as it
 * was. NOTHING is written to the database. Usage: node r17-check.mjs [phone|tablet|desktop]
 */
import { launch, newPage, login, api, shot } from './lib.mjs';

const sizes = process.argv[2] ? [process.argv[2]] : ['desktop', 'tablet', 'phone'];
const browser = await launch();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };

for (const size of sizes) {
  const page = await newPage(browser, size);
  await login(page);
  const clubs = (await api(page, 'GET', '/api/clubs')).json;
  const orders = (await api(page, 'GET', '/api/v1/club-orders')).json;
  const live = orders.find((o) => (o.status === 'Confirmed' || o.status === 'Requested') && clubs.find((c) => c.id === o.clubId)?.isActive !== false);
  if (!live) { console.log('no live club order in the dev data - nothing to check'); process.exit(2); }
  const club = clubs.find((c) => c.id === live.clubId);

  const puts = [];
  await page.route(`**/api/v1/club-orders/${live.id}*`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const url = new URL(route.request().url());
    puts.push({ reason: url.searchParams.get('overrideReason'), body: route.request().postData() });
    if (!url.searchParams.get('overrideReason')) {
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'worker.busy', message: 'Pracovník je zaneprázdněn.', details: { conflictKind: 'appointment', calendarName: 'Diagnostika', activityName: 'Spiroergometrie', startUtc: '2026-11-05T08:00:00Z', endUtc: '2026-11-05T08:45:00Z', overridable: true, conflictCount: 1 }, traceId: 't' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) });
  });

  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('.sm-planner', { timeout: 90000 });
  await page.waitForTimeout(2500);

  // mark a free range far ahead on the board (next week, Tuesday late morning)
  if (size === 'phone') { await page.getByRole('button', { name: 'Týden', exact: true }).first().click().catch(() => {}); }
  for (let i = 0; i < 3; i++) { await page.click('[data-command=nextWeek]'); await page.waitForTimeout(900); }
  await page.waitForTimeout(1200);
  const board = await page.locator('#day-board').boundingBox();
  const x = board.x + board.width * (size === 'phone' ? 0.5 : 0.5 / 7);
  const y = size === 'phone' ? board.y + 120 : board.y + board.height * 0.55;
  if (size === 'phone') { const cdp = await page.context().newCDPSession(page); const t = (type, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] }); await t('touchStart', y); await page.waitForTimeout(650); await t('touchMove', y + 10); await t('touchMove', y + 30); await t('touchEnd', y + 30); } else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 25, { steps: 5 }); await page.mouse.up(); }
  await page.waitForTimeout(600);
  const item = page.getByRole('menuitem', { name: /Přidat do objednávky klubu/ });
  if (!(await item.count())) { await shot(page, `r17-menu-${size}`); console.log(`${size}: menu items:`, await page.$$eval('[role=menuitem], .board-selection, [data-testid*=selection] button', (e) => e.map((x) => (x.getAttribute('class') || '') + ':' + x.textContent))); if (size === 'phone') console.log('SKIPPED phone: the long-press mark could not be driven with synthetic touch; the full-screen dialog is the tablet run'); else ok(false, `${size}: the mark offers "Přidat do objednávky klubu"`); await page.context().close(); continue; }
  await item.click();
  await page.waitForSelector('[data-testid=add-to-club-order-dialog]');
  await page.getByRole('combobox', { name: 'Klub' }).click();
  await page.getByRole('option', { name: club.name }).click();
  await page.locator('[data-testid=add-to-club-order-row]').first().click();
  await page.click('[data-testid=add-to-club-confirm]');
  await page.waitForSelector('[data-testid=worker-busy-message]', { timeout: 15000 });
  ok(/Spiroergometrie v kalendáři Diagnostika/.test(await page.textContent('[data-testid=worker-busy-message]')), `${size}: the clash is named`);
  ok(puts.length === 1 && puts[0].reason === null, `${size}: the first save carries no reason`);
  const dialogOnScreen = await page.evaluate(() => { const d = document.querySelector('[data-testid=add-to-club-order-dialog] .MuiDialog-paper'); const r = d.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth; });
  ok(dialogOnScreen, `${size}: dialog inside the viewport`);
  const override = page.getByRole('button', { name: 'Přesto potvrdit (správce)' });
  ok(await override.isDisabled(), `${size}: the override needs a reason`);
  await page.getByLabel('Důvod výjimky').fill('ZZ test dohodnuto');
  ok(((await override.boundingBox())?.height ?? 0) >= 43.5, `${size}: the override button is a real target (${Math.round((await override.boundingBox())?.height ?? 0)} px)`);
  await shot(page, `r17-busy-${size}`);
  await override.click();
  await page.waitForSelector('[data-testid=add-to-club-order-dialog]', { state: 'detached', timeout: 15000 });
  ok(puts.length === 2 && puts[1].reason === 'ZZ test dohodnuto', `${size}: the retry carries overrideReason as a query parameter, not in the body (${puts[1]?.reason})`);
  ok(!/ZZ test dohodnuto/.test(puts[1]?.body ?? ''), `${size}: the reason is not in the request body`);
  console.log(size, 'console errors:', page.errors.filter((e) => !/403|font|409/i.test(e)).slice(0, 3));
  await page.context().close();
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
