/* R23 in a real browser: a click that leaves a hole after the lunch / the opening time asks which place is meant.
 * Data: a clean future day (no booking is created; the lunch and the opening time are the "previous"). Nothing is written. */
import { launch, newPage, login, shot, api } from './lib.mjs';
const sizes = process.argv[2] ? [process.argv[2]] : ['phone', 'tablet', 'desktop'];
const browser = await launch();
const created = [];
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
for (const size of sizes) {
  const page = await newPage(browser, size);
  await login(page);
  // test data: one 40-minute booking on Tuesday 1. 12. at 09:00, so it ends 09:40 (not on the 15-minute grid)
  const cals = (await api(page, 'GET', '/api/calendars')).json; const calendar = (cals.data ?? cals).find((c) => c.isActive !== false);
  const act = (await api(page, 'GET', '/api/activities')).json.data.activities.find((a) => a.isActive && a.durationMinutes === 40);
  const pts = (await api(page, 'GET', '/api/patients?pageSize=100')).json;
  const patient = (pts.data?.items ?? pts.items ?? pts.data ?? [])[0];
  const av = await api(page, 'GET', `/api/calendars/${calendar.id}/availability?activityId=${act.id}&from=2026-12-01&to=2026-12-01&forPublic=false&staffStarts=true`);
  const slot = (av.json?.data ?? av.json ?? []).map((x) => x.startUtc).find((u) => u.startsWith('2026-12-01T08:00')) ?? (av.json?.data ?? av.json ?? [])[0]?.startUtc;
  ok(!!slot, `${size}: a free slot for the test booking (${slot})`);
  const made = await api(page, 'POST', `/api/calendars/${calendar.id}/appointments`, { calendarId: calendar.id, patientId: patient.id, activityId: act.id, startUtc: slot, source: 0, note: 'ZZ test stage8 r23' });
  const madeId = made.json?.data?.appointment?.id ?? made.json?.data?.id ?? made.json?.appointment?.id;
  if (madeId) created.push({ calendarId: calendar.id, id: madeId });
  ok(made.status === 201 || made.status === 200, `${size}: test booking created (${made.status})`);
  const startMin = (() => { const d = new Date(slot); const [h, mi] = d.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number); return h * 60 + mi; })();
  const endMin = startMin + 40;
  const hh = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const clickMin = Math.ceil((endMin + 1) / 15) * 15; // the first grid line after the booking's end
  await page.addInitScript(() => { try { localStorage.setItem('calendarZoomV2', '3'); } catch { /* */ } });
  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(3000);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth);
  // a clean week: 30.11. (Mon) - the week of 30. 11. has no club and no bookings in the dev data
  for (let i = 0; i < 6; i++) { await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(900); }
  await page.waitForTimeout(2000);
  if (size !== 'desktop') { await page.getByRole('button', { name: /1\. 12\./ }).first().click().catch(() => {}); await page.waitForTimeout(1200); }
  const H = Math.floor(clickMin / 60);
  const info = await page.evaluate((H) => {
    const b = document.querySelector('#day-board').getBoundingClientRect();
    const find = (h) => [...document.querySelectorAll('.sm-planner *')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === `${h}:00` && e.getBoundingClientRect().left < b.left + 5);
    const el = find(H); el?.scrollIntoView({ block: 'center' });
    const pos = (h) => { const e = find(h); const r = e?.getBoundingClientRect(); return r ? r.y + r.height / 2 : undefined; };
    const bb = document.querySelector('#day-board').getBoundingClientRect();
    return { b: { x: bb.x, y: bb.y, w: bb.width, h: bb.height }, y0: pos(H), y1: pos(H + 1) };
  }, H);
  await page.waitForTimeout(500);
  const info2 = await page.evaluate((H) => { const b = document.querySelector('#day-board').getBoundingClientRect(); const find = (h) => [...document.querySelectorAll('.sm-planner *')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === `${h}:00` && e.getBoundingClientRect().left < b.left + 5); const pos = (h) => { const r = find(h)?.getBoundingClientRect(); return r ? r.y + r.height / 2 : undefined; }; return { y0: pos(H), y1: pos(H + 1) }; }, H);
  let y12 = info2.y0, y13 = info2.y1; let tx = 0;
  if (size !== 'desktop') { const card = page.locator('.schedule-event').filter({ hasText: `${hh(startMin)} – ${hh(endMin)}` }).last(); await card.scrollIntoViewIfNeeded(); const r = await card.boundingBox(); tx = r.x + r.width / 2; y12 = r.y + r.height - (endMin - H * 60) * (r.height / 40); y13 = y12 + 60 * (r.height / 40); }
  ok(y12 !== undefined && y13 !== undefined, `${size}: the hour labels are found`);
  const px = (y13 - y12) / 60;
  const colX = size === 'desktop' ? info.b.x + info.b.w * (1.5 / 7) : info.b.x + info.b.w * 0.6;
  const clickAt = async (min) => { const yy = y12 + (min - H * 60) * px; if (size === 'desktop') await page.mouse.click(colX, yy); else await page.mouse.click(tx, yy); await page.waitForTimeout(500); };
  // the lunch ends 12:30: a click at 12:40 leaves 10 minutes
  await clickAt(clickMin + 2);
  const label = await page.locator('.board-selection b').first().textContent().catch(() => null);
  console.log(`${size}: marked`, label);
  await page.getByRole('menuitem').first().first().click().catch(async () => { console.log('menu:', await page.$$eval('body button', (e) => e.filter((x) => x.getClientRects().length && /Rezerv|Objedn|Blok|Klub|Zrušit/.test(x.textContent)).map((x) => x.textContent.trim()))); });
  await page.waitForTimeout(700);
  const gap = page.locator('[data-testid=gap-choice]');
  ok(await gap.count() === 1, `${size}: the choice pop-out opens at the click`);
  if (await gap.count()) {
    const texts = await page.$$eval('[data-testid=gap-choice] button', (e) => e.map((x) => x.textContent.trim()));
    console.log(size, texts);
    ok(texts[0].includes(`Hned po předchozím (${hh(endMin)})`) && texts[1].includes(`Přesně jak jsem klikl (${hh(clickMin)})`), `${size}: "Hned po předchozím (${hh(endMin)})" / "Přesně jak jsem klikl (${hh(clickMin)})"`);
    const heights = await page.$$eval('[data-testid=gap-choice] button', (e) => e.map((x) => Math.round(x.getBoundingClientRect().height)));
    ok(heights.every((h) => h >= 44), `${size}: buttons are >= 44 px (${heights})`);
    await shot(page, `r23-ask-${size}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    ok(await page.locator('[data-testid=gap-choice]').count() === 0, `${size}: Esc closes it and books nothing`);
    ok(await page.locator('[data-testid=new-appointment], [role=dialog][aria-label*="Nová"]').count() === 0, `${size}: no booking dialog opened`);
    // again, take the neighbour's side
    await clickAt(clickMin + 2);
    await page.getByRole('menuitem').first().first().click(); await page.waitForTimeout(600);
    await page.locator('[data-testid=gap-moved]').click(); await page.waitForTimeout(1500);
    const dlg = await page.locator('[role=dialog]').allInnerTexts();
    ok(dlg.some((t) => t.includes(hh(endMin))), `${size}: the booking dialog opens on ${hh(endMin)} (${dlg.length} dialog)`);
    await shot(page, `r23-booking-${size}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    // as clicked
    await clickAt(clickMin + 2);
    await page.getByRole('menuitem').first().first().click(); await page.waitForTimeout(600);
    await page.locator('[data-testid=gap-keep]').click(); await page.waitForTimeout(1500);
    const dlg2 = await page.locator('[role=dialog]').allInnerTexts();
    ok(dlg2.some((t) => t.includes(hh(clickMin))), `${size}: "as clicked" opens the dialog on ${hh(clickMin)}`);
    await page.keyboard.press('Escape');
  }
  ok(await noScroll(), `${size}: document does not scroll`);
  console.log(size, 'console errors:', page.errors.filter((e) => !/403|font/i.test(e)).slice(0, 3));
  await page.context().close();
}
for (const c of created) await api(await (async () => { const pg = await newPage(browser, 'desktop'); await login(pg); return pg; })(), 'DELETE', `/api/calendars/${c.calendarId}/appointments/${c.id}?reason=ZZ%20test%20cleanup`).then((r) => console.log('cleanup', r.status));
await browser.close().catch(() => {});
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
