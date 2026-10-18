import { launch, login, settle, BASE } from './lib.mjs';
const { browser, page, log } = await launch();
await login(page); await settle(page, 1200);
await page.goto(BASE + '/planovani'); await page.waitForSelector('[data-testid="mini-day-2026-10-26"]'); await settle(page, 1500);
const res = await page.evaluate(async () => {
  const api = (await import('/src/api/appointments.ts')).appointmentsApi;
  const cals = (await (await import('/src/api/calendars.ts')).calendarsApi.list());
  const cal = cals[0].id;
  const out = {};
  const count = () => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/') && e.name.includes('/blocks')).length;
  await api.blocks(cal, '2026-11-09', '2026-12-13');               // fills the cover (a wide window)
  const c0 = count();
  const week = await api.blocks(cal, '2026-11-16', '2026-11-22');   // inside: no request
  out.requestsForWeekInsideHeldMonth = count() - c0;
  out.weekBefore = week.length;
  const created = await api.createBlock(cal, '2026-11-20T07:00:00Z', '2026-11-20T07:30:00Z', 'PF-C perf test');
  const c1 = count();
  const weekAfter = await api.blocks(cal, '2026-11-16', '2026-11-22');
  out.requestsAfterWrite = count() - c1;
  out.weekAfterHasNewBlock = weekAfter.some((b) => b.id === created.id);
  const monthAfter = await api.blocks(cal, '2026-11-09', '2026-12-13');
  out.monthAfterHasNewBlock = monthAfter.some((b) => b.id === created.id);
  await api.deleteBlock(cal, created.id);
  const weekGone = await api.blocks(cal, '2026-11-16', '2026-11-22');
  out.weekGoneAfterDelete = !weekGone.some((b) => b.id === created.id);
  return out;
});
console.log(res);
await browser.close();
