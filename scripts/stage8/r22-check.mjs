/* R22 in a real browser: every state in which a club has been given time shows in the main calendar. Real dev data for confirmed (older API, no stage 2
 * fields) and Invited (offered days); the Requested order is a copy of the Invited one made in the browser (route), nothing is written. */
import { launch, newPage, login, shot } from './lib.mjs';
const sizes = process.argv[2] ? [process.argv[2]] : ['phone', 'tablet', 'desktop'];
const browser = await launch();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
for (const size of sizes) {
  const page = await newPage(browser, size);
  await login(page);
  await page.route('**/api/v1/club-orders', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch(); const json = await res.json(); const list = json.data ?? json;
    const inv = list.find((o) => o.status === 'Invited' && (o.offeredDates ?? []).length > 0);
    const req = { ...inv, id: 'zz-requested-order', status: 'Requested', offeredDates: [], requestedDates: ['2026-11-23', '2026-11-24'], requestedRanges: [], clubName: 'ZZ test Requested', clubColorHex: '#7C3AED' };
    const body = Array.isArray(json) ? [...list, req] : { ...json, data: [...list, req] };
    await route.fulfill({ response: res, json: body });
  });
  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(3000);
  const phone = size === 'phone';
  const noScroll = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth);
  if (!phone) {
    await page.click('[data-command=nextWeek]'); await page.waitForTimeout(2500);
    // (a) confirmed, 0 players, older API
    const hold = await page.$$eval('.board-window.is-club .win-hold', (e) => e.map((x) => x.textContent));
    ok(hold.length > 0 && hold.every((t) => /Čeká na hráče/.test(t)), `${size}: (a) confirmed order with no players says "Čeká na hráče" on the older API (${hold.length})`);
    await shot(page, `r22-a-${size}`);
    // (c) offered days 9.-13.11
    for (let i = 0; i < 2; i++) { await page.click('[data-command=nextWeek]'); await page.waitForTimeout(2200); }
    const off = await page.$$('.board-window.is-offered');
    ok(off.length >= 3, `${size}: (c) offered days drawn as holds (${off.length})`);
    ok((await page.$eval('.board-window.is-offered .win-label', (e) => e.textContent)).startsWith('Nabídnuto klubu'), `${size}: (c) label "Nabídnuto klubu ..."`);
    ok((await page.$eval('.board-window.is-offered .win-hold', (e) => e.textContent)) === 'Čeká na odpověď', `${size}: (c) "Čeká na odpověď"`);
    ok(await noScroll(), `${size}: document does not scroll`);
    await shot(page, `r22-c-${size}`);
    // offered: click on a free slot of an offered day (the hold is NOT in the way) asks first
    const win = page.locator('.board-window.is-offered').first();
    const box = await win.boundingBox();
    // the day column is covered by the window itself (it is a button); a click there opens the club popover, a drag in free time asks - use the hour below the window
    await win.click(); await page.waitForTimeout(700);
    ok(await page.locator('[data-testid=club-popover]').count() > 0, `${size}: (c) a click on the offered hold opens the club order`);
    await page.keyboard.press('Escape');
    // an offered day warns instead of refusing: a press on its free part asks first, then the usual choice follows
    const w0 = await page.locator('.board-window.is-offered').first().boundingBox();
    await page.mouse.click(w0.x + w0.width / 2, w0.y + 40);
    await page.waitForTimeout(600);
    ok(await page.locator('[data-testid=offered-ask]').count() > 0, `${size}: (c) booking onto an offered day asks first ("Nabídnuto klubu")`);
    await shot(page, `r22-c-ask-${size}`);
    await page.locator('[data-testid=offered-ask-go]').click(); await page.waitForTimeout(500);
    ok(await page.locator('.board-selection, [data-testid=selection-popover], [role=menu]').count() > 0, `${size}: (c) after "Přesto rezervovat" the usual booking choice opens`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // (b) requested days 23.-24.11 (Mon, Tue)
    for (let i = 0; i < 2; i++) { await page.click('[data-command=nextWeek]'); await page.waitForTimeout(2200); }
    const req = await page.$$('.board-window.is-requested');
    ok(req.length >= 2, `${size}: (b) requested days drawn as holds (${req.length})`);
    ok((await page.$eval('.board-window.is-requested .win-label', (e) => e.textContent)).startsWith('Rezervováno pro klub'), `${size}: (b) label "Rezervováno pro klub ..."`);
    ok((await page.$eval('.board-window.is-requested .win-hold', (e) => e.textContent)) === 'Čeká na potvrzení', `${size}: (b) "Čeká na potvrzení"`);
    // lighter than confirmed: compare hatch alpha from the css variable
    const alpha = await page.evaluate(() => {
      const a = (el) => { const m = /rgba?\([^)]*?,\s*([\d.]+)\)/.exec(getComputedStyle(el).getPropertyValue('--win-hatch')); return m ? Number(m[1]) : null; };
      return { req: a(document.querySelector('.board-window.is-requested')) };
    });
    ok(alpha.req !== null && alpha.req < 0.24, `${size}: (b) lighter hatch than a confirmed hold (${alpha.req} < 0.24)`);
    await shot(page, `r22-b-${size}`);
    // refusal: dragging over a requested hold - the window is a button, so booking is refused by the selection rule; try a keyboard-free click on it
    await page.locator('.board-window.is-requested').first().click(); await page.waitForTimeout(700);
    ok(await page.locator('[data-testid=club-popover]').count() > 0, `${size}: (b) a click opens the club order`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // mini calendar marks
    const mini = await page.$$eval('.mini-clubs i[data-hold=requested], .mini-clubs i[data-hold=offered]', (e) => e.length);
    ok(mini > 0, `${size}: mini calendar marks the pending days (${mini})`);
    // month
    await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(2200);
    const tile = await page.$$eval('.tile-club[data-hold=requested], .tile-club[data-hold=offered]', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ')));
    ok(tile.length > 0 && tile.some((t) => /Čeká na potvrzení/.test(t)), `${size}: month tile says it (${tile.length})`);
    await shot(page, `r22-month-${size}`);
  } else {
    await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) { await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(1200); }
    await page.waitForTimeout(2500);
    const rows = await page.$$eval('.phone-month-row, [data-testid^=phone-month-row]', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ')));
    ok(rows.some((t) => /Čeká na potvrzení|Čeká na odpověď/.test(t)), `phone: month list names the pending holds (${rows.filter((t) => /Čeká na/.test(t)).length})`);
    ok(await noScroll(), 'phone: document does not scroll');
    await shot(page, 'r22-month-phone');
  }
  console.log(size, 'console errors:', page.errors.filter((e) => !/403|font/i.test(e)).slice(0, 3));
  await page.context().close();
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
