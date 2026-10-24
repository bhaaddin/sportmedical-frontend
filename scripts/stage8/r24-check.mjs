/* R24 in a real browser (desktop; tablet / phone are noted in the write-up). The dev API of this checkout accepts a club over a booking, so
 * the refusal is simulated ONCE in the browser (route: the first PUT of the club order answers 409). Everything else is real: the booking, the
 * availability, the reschedule, the second PUT that really places the club. Test data: "ZZ test" club + booking, cancelled at the end. */
import { launch, newPage, login, shot, api, findOrMakeClub } from './lib.mjs';
const browser = await launch();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const size = process.argv[2] ?? 'desktop';
const page = await newPage(browser, size);
await login(page);
const cals = (await api(page, 'GET', '/api/calendars')).json; const calendar = (cals.data ?? cals).find((c) => c.isActive !== false);
const act = (await api(page, 'GET', '/api/activities')).json.data.activities.find((a) => a.isActive && a.durationMinutes === 40);
const pts = (await api(page, 'GET', '/api/patients?pageSize=100')).json; const patient = (pts.data?.items ?? pts.items ?? pts.data ?? [])[0];
const DAY = '2026-12-03';
const av = await api(page, 'GET', `/api/calendars/${calendar.id}/availability?activityId=${act.id}&from=${DAY}&to=${DAY}&forPublic=false&staffStarts=true`);
const slots = (av.json?.data ?? av.json ?? []).map((x) => x.startUtc);
const slot = slots.find((u) => u.startsWith(`${DAY}T08:00`)) ?? slots[2];
const made = await api(page, 'POST', `/api/calendars/${calendar.id}/appointments`, { calendarId: calendar.id, patientId: patient.id, activityId: act.id, startUtc: slot, source: 0, note: 'ZZ test stage8 r24' });
const appt = made.json?.data?.appointment ?? made.json?.data ?? made.json?.appointment;
ok(made.status === 201 || made.status === 200, `${size}: test booking created (${made.status}) at ${slot}`);
const club = await findOrMakeClub(page);
const mk = (d, f = '08:00', t = '09:00') => ({ fromDate: d, toDate: d, dailyFrom: f, dailyTo: t, activityIds: null });
const order = (await api(page, 'POST', '/api/v1/club-orders/staff', { clubId: club.id, serviceId: act.clinicServiceId, activitySeats: [{ activityId: act.id, seats: 3 }], paymentMethod: 'ClubInvoice', ranges: [mk('2026-12-08')], calendarIds: [calendar.id], status: 'Confirmed', note: 'ZZ test stage8 r24' })).json;
let puts = 0;
await page.route(`**/api/v1/club-orders/${order.id}*`, async (route) => {
  if (route.request().method() !== 'PUT') return route.continue();
  puts++;
  if (puts === 1) return route.fulfill({ status: 409, contentType: 'application/json', json: { success: false, code: 'scheduling.booking.time_taken', message: 'Čas je už obsazený.' } });
  return route.continue();
});
await page.addInitScript(() => { try { localStorage.setItem('calendarZoomV2', '3'); } catch { /* */ } });
await page.goto(`${process.env.BASE}/planovani`); await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(3000);
for (let i = 0; i < 6; i++) { await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(900); }
await page.waitForTimeout(2000);
const startMin = (() => { const [h, m] = new Date(slot).toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number); return h * 60 + m; })();
const H = Math.floor(startMin / 60);
await page.evaluate((H) => {
  const b = document.querySelector('#day-board').getBoundingClientRect();
  const find = (h) => [...document.querySelectorAll('.sm-planner *')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === `${h}:00` && e.getBoundingClientRect().left < b.left + 5);
  find(H)?.scrollIntoView({ block: 'center' });
}, H);
await page.waitForTimeout(500);
const g = await page.evaluate((H) => {
  const b = document.querySelector('#day-board').getBoundingClientRect();
  const find = (h) => [...document.querySelectorAll('.sm-planner *')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === `${h}:00` && e.getBoundingClientRect().left < b.left + 5);
  const pos = (h) => { const r = find(h)?.getBoundingClientRect(); return r ? r.y + r.height / 2 : undefined; };
  return { x: b.x, w: b.width, y0: pos(H), y1: pos(H + 1) };
}, H);
const px = (g.y1 - g.y0) / 60;
const yAt = (min) => g.y0 + (min - H * 60) * px;
const x = g.x + g.w * (3.5 / 7); // Thursday
// drag from 30 minutes before the booking (free) down across it
await page.mouse.move(x, yAt(startMin - 30)); await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(x, yAt(startMin - 30 + (i * 60) / 8));
await page.mouse.up(); await page.waitForTimeout(700);
console.log('menu:', await page.$$eval('[role=menuitem]', (e) => e.map((n) => n.textContent.trim())));
await page.getByRole('menuitem', { name: /klub/i }).first().click(); await page.waitForTimeout(800);
await page.getByRole('combobox', { name: 'Klub' }).click(); await page.getByRole('option', { name: club.name }).first().click();
await page.getByTestId('add-to-club-order-row').first().click();
await page.getByTestId('add-to-club-confirm').click();
await page.getByTestId('club-conflict').waitFor({ timeout: 15000 });
await page.waitForSelector('[data-testid^=club-conflict-to-]', { timeout: 20000 }).catch(() => {});
ok(await page.locator('[data-testid=club-conflict-list] > li').count() >= 1, `${size}: the conflict step lists the booking in the way`);
ok(await page.locator('[data-testid^=club-conflict-to-]').count() >= 1, `${size}: a proposed new slot is shown`);
ok(await page.getByRole('checkbox', { name: 'Upozornit klienta' }).count() >= 1, `${size}: "Upozornit klienta" checkbox per booking`);
const before = (await api(page, 'GET', `/api/calendars/${calendar.id}/appointments/${appt.id}`)).json;
const was = (before.data ?? before).startUtc;
ok(new Date(was).getTime() === new Date(slot).getTime(), `${size}: nothing moved before the confirmation`);
const btn = await page.getByTestId('club-conflict-go').boundingBox();
ok(btn.height >= 44, `${size}: the button is >= 44 px (${Math.round(btn.height)})`);
ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), `${size}: document does not scroll`);
await shot(page, `r24-conflict-${size}`);
await page.getByRole('checkbox', { name: 'Upozornit klienta' }).first().uncheck().catch(() => {});
await page.getByTestId('club-conflict-go').click();
await page.waitForTimeout(4000);
const after = (await api(page, 'GET', `/api/calendars/${calendar.id}/appointments/${appt.id}`)).json;
const now = (after.data ?? after).startUtc;
ok(new Date(now).getTime() !== new Date(slot).getTime(), `${size}: the booking was moved (${slot} -> ${now})`);
ok(puts >= 2, `${size}: the club was placed after the move (PUT #${puts})`);
const o2 = (await api(page, 'GET', `/api/v1/club-orders/${order.id}`)).json;
ok((o2.blocks ?? []).some((b) => b.fromDate === DAY), `${size}: the order now holds ${DAY}`);
console.log(size, 'console errors:', page.errors.filter((e) => !/403|font|409/i.test(e)).slice(0, 3));
await api(page, 'DELETE', `/api/calendars/${calendar.id}/appointments/${appt.id}?reason=ZZ%20test%20cleanup`);
await api(page, 'POST', `/api/v1/club-orders/${order.id}/cancel?cancelAthletes=true`);
await browser.close().catch(() => {});
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
