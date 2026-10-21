/*
 * "Everything is connected": plan, SAVE (the one real write) and look for stale figures without a reload - the club
 * screen's switcher and deck, the order list of the club, the calendar's month. Then the test order is cancelled
 * through the API (an order cannot be deleted; a cancelled one frees its windows).
 *
 *   node scripts/club-planning/save-flow.mjs
 *
 * Only the test club 'ZZ test plánování' is used.
 */
import { launch, newPage, login, shot, toasts, api, findOrMakeClub, startClubOrder } from './lib.mjs';

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const text = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const club = await findOrMakeClub(page);
const before = ((await api(page, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json ?? []).length;
await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 3 });
await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click();
for (let i = 0; i < 8 && !(await text(page, '.alternative-head')).startsWith('Leden 2027'); i++) {
  await page.getByRole('button', { name: 'Následující měsíc' }).first().click();
  await page.waitForTimeout(600);
}
await page.locator('.month-tile[data-day="2027-01-26"]').click();
await page.waitForTimeout(1500);
check(/3 \/ 3/.test(await text(page, '.plan-card .plan-num')), `3 / 3 after one click on a day (${await text(page, '.plan-card .plan-num')})`);
await shot(page, 'save-1-planned');

/* finish: the callout -> Prohlédnout plán -> the one write */
await page.getByRole('button', { name: /Prohlédnout plán/ }).first().click();
const dialog = page.getByTestId('planner-dialog');
await dialog.waitFor();
check(!(await dialog.innerText()).includes('Není co uložit'), 'the finish dialog does not say "nothing to save"');
check(/3 \/ 3/.test(await dialog.innerText()), 'the finish dialog reads 3 / 3');
await shot(page, 'save-2-finish');
await page.locator('[data-testid=pick-confirm]').click();
await page.waitForTimeout(3500);
await shot(page, 'save-3-saved');
const saved = ((await api(page, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json ?? []);
check(saved.length === before + 1, `one order was created (${before} -> ${saved.length})`);
const order = saved.find((o) => o.status !== 'Cancelled' && (o.blocks ?? []).some((b) => (b.fromDate ?? '').startsWith('2027-01-26')));
check(Boolean(order), 'the saved order holds the picked day');

/* no reload: close the summary - the club screen already shows the saved order */
await page.locator('.s41-scene').getByRole('button', { name: /Zpět/ }).first().click();
await page.waitForTimeout(1500);
await shot(page, 'save-3b-after-summary');
const switcher = await text(page, '[data-testid=club-order-switch-button]');
check(/KO-/i.test(switcher), `the order switcher names the saved order without a reload ("${switcher}")`);
console.log('   toasts:', await toasts(page));

/* in-app navigation to the calendar: the club's window is there, no reload */
/* a client-side route change (the router's own popstate), so nothing is reloaded and the cache is what the app has */
await page.evaluate(() => { window.history.pushState({}, '', '/planovani'); window.dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.sm-planner #day-board', { timeout: 60000 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click();
for (let i = 0; i < 8 && !(await text(page, '.alternative-head')).startsWith('Leden 2027'); i++) {
  await page.getByRole('button', { name: 'Následující měsíc' }).first().click();
  await page.waitForTimeout(600);
}
const tile = await text(page, '.month-tile[data-day="2027-01-26"]');
check(/ZZ test|termín|Slot|slot/i.test(tile), `the calendar's month shows the club's day without a reload ("${tile}")`);
await shot(page, 'save-4-calendar');

/* clean up: cancel the test order */
if (order) {
  const r = await api(page, 'POST', `/api/v1/club-orders/${order.id}/cancel?cancelAthletes=false`, {});
  check(r.status < 300, `the test order was cancelled (${r.status})`);
}
check(page.errors.length === 0, `no console errors (${page.errors.slice(0, 2).join(' | ')})`);
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall passed');
process.exit(failures.length ? 1 : 0);
