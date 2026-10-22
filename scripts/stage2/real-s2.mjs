/*
 * Part B against the REAL Stage 2 backend (branch feature/stage2-rules, built from a clone, run on :5193 against a COPY of the dev
 * database; this worktree's Vite on :3006 proxies to it). Nothing here touches the shared dev stack (:5092 / sportmedical_dev).
 *
 *   node scripts/stage2/real-s2.mjs [r4|r17|r13|all]
 *
 * Own headless Chromium, the login of the copy is read from a private file and never printed. Each check prints PASS / FAIL with what was
 * measured; the exit code is the number of failures.
 */
process.env.BASE ??= 'http://localhost:3006';
process.env.DEV_LOGIN ??= 'C:/Users/Matko/vt-tmp/s2api-login.txt';
process.env.OUT ??= 'design/stage2';
const { launch, newPage, login, api, shot, waitPlanner, BASE } = await import('./lib.mjs');

const only = process.argv[2] ?? 'all';
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failed += 1;
};

const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const A = (method, path, body) => api(page, method, path, body);
const cals = un((await A('GET', '/api/calendars')).json).filter((c) => c.isActive);
const byName = (n) => cals.find((c) => c.name === n);
const diag = byName('Diagnostika');
const inb = byName('InBody');
const me = (await A('GET', '/api/v1/account')).json.account.userId;
const acts = (() => 0)();
const activities = (await (async () => { const j = un((await A('GET', '/api/activities')).json); return Array.isArray(j) ? j : j.activities; })()).filter((a) => a.isActive);
const actOf = (name) => activities.find((a) => a.name === name);
const diagAct = actOf('Základní diagnostika');
const inbAct = actOf('Základní InBody měření');

/** Prague wall clock -> UTC instant (the dates used are in CET, UTC+1, after 25. 10. 2026). */
const utc = (day, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${day}T00:00:00Z`) + ((h - 1) * 60 + m) * 60000).toISOString().replace('.000Z', 'Z');
};

/** The first Monday-to-Friday from `from` on which both calendars have nothing but their weekly lunch (no blocks) - a clean day. */
async function cleanDay(from, skip = []) {
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.parse(`${from}T12:00:00Z`) + i * 86400000);
    const day = d.toISOString().slice(0, 10);
    if ([0, 6].includes(d.getUTCDay()) || skip.includes(day)) continue;
    let clean = true;
    for (const c of [diag, inb]) {
      const blocks = un((await A('GET', `/api/calendars/${c.id}/blocks?from=${day}&to=${day}`)).json);
      const rows = un((await A('GET', `/api/day?from=${day}&to=${day}&calendarIds=${c.id}`)).json);
      const pv = un((await A('GET', `/api/calendars/${c.id}/preview?from=${day}&to=${day}`)).json)?.[0];
      if ((blocks ?? []).length || (rows ?? []).length || !pv?.isOpen) clean = false;
    }
    if (clean) return day;
  }
  throw new Error('no clean day found');
}

const weekOf = async (day) => {
  await page.goto(`${BASE}/planovani`);
  await waitPlanner(page);
  /* walk the week arrows until the heading shows the day */
  for (let i = 0; i < 12; i++) {
    const has = await page.evaluate((d) => !!document.querySelector(`[data-day="${d}"]`), day);
    if (has) return;
    await page.click('[data-command=nextWeek]');
    await page.waitForTimeout(500);
  }
  throw new Error(`week of ${day} not reached`);
};
const pickServices = async (...names) => {
  await page.waitForSelector('.calendar-chip');
  for (const n of names) await page.locator('.calendar-chip', { hasText: n }).first().click();
  await page.waitForTimeout(1500);
};

/* ------------------------------------------------------------------------------------------------------------ R4 */
async function r4() {
  console.log('\n== R4 ==');
  await page.goto(`${BASE}/nastaveni/vzhled-kalendare`);
  const sw = page.getByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' });
  await sw.waitFor({ timeout: 60000 });
  check(true, 'settings: the real server has the setting - the card with the switch is shown');
  check((await sw.isChecked()) === false, 'settings: the switch starts off (default false)');
  await shot(page, 's2-real-r4-settings-before');
  await sw.click();
  await page.getByRole('button', { name: 'Uložit pravidlo' }).click();
  await page.getByText(/Pravidlo platí v celé ordinaci/).waitFor({ timeout: 20000 });
  const slots = (await A('GET', '/api/v1/settings/booking-slots')).json;
  check(slots.settings.singleWorkerAtATime === true && Array.isArray(slots.settings.workerExceptions), `settings: saved on the server (singleWorkerAtATime=${slots.settings.singleWorkerAtATime})`);
  check(slots.settings.examinationPauseMinutes === 10, 'settings: the pause is untouched by the save (a PUT that leaves a field out keeps it)');
  await shot(page, 's2-real-r4-settings-on');

  const day = await cleanDay('2026-11-23');
  console.log(`   clean day: ${day}`);
  /* the same worker is rostered in both calendars that day (a one-day exception with a worker) */
  for (const c of [diag, inb]) {
    const r = await A('POST', `/api/calendars/${c.id}/exceptions`, { date: day, isClosed: false, startTime: '08:00', endTime: '18:00', workerUserId: me, reason: 'stage2 test' });
    check(r.status === 200 || r.status === 201, `rota: worker put on ${c.name} for ${day} (HTTP ${r.status})`);
  }
  const first = await A('POST', `/api/calendars/${diag.id}/appointments/unregistered`, { activityId: diagAct.id, startUtc: utc(day, '09:00'), name: 'ZZ s2 test A' });
  check(first.status === 200 || first.status === 201, `booking: Diagnostika 09:00 made (HTTP ${first.status})`);
  const clash = await A('POST', `/api/calendars/${inb.id}/appointments/unregistered`, { activityId: inbAct.id, startUtc: utc(day, '09:00'), name: 'ZZ s2 test B' });
  check(clash.status === 409 && clash.json?.code === 'worker.busy', `API: the same worker in InBody at 09:00 is refused 409 worker.busy (got ${clash.status} ${clash.json?.code})`);
  if (clash.json?.code !== 'worker.busy') console.log('   DEBUG slots at the time:', JSON.stringify((await A('GET', '/api/v1/settings/booking-slots')).json.settings), JSON.stringify(clash.json).slice(0, 160));
  const d = clash.json?.details ?? {};
  check(d.calendarName === 'Diagnostika' && d.conflictKind === 'appointment' && d.overridable === true && !JSON.stringify(clash.json).includes('ZZ s2 test'), `API: details name the clashing booking (${d.calendarName}, ${d.activityName}) and carry no patient name`);

  /* the offers already leave the busy time out (server side): no InBody start inside Diagnostika's 09:00-10:00 */
  const offers = un((await A('GET', `/api/calendars/${inb.id}/availability?activityId=${inbAct.id}&from=${day}&to=${day}&forPublic=false&staffStarts=true`)).json) ?? [];
  const inside = offers.filter((o) => o.startUtc < utc(day, '10:00') && o.endUtc > utc(day, '09:00'));
  check(offers.length > 0 && inside.length === 0, `API: availability for InBody lists ${offers.length} starts and none inside the busy 09:00-10:00 (${inside.length})`);
  await weekOf(day);
  await pickServices('Sportovní diagnostika', 'InBody 770');
  const clashSel = `[data-testid^="clash-${inb.id}-${day}-"]`;
  const clashEl = page.locator(clashSel).first();
  await clashEl.waitFor({ timeout: 20000 });
  const title = await clashEl.getAttribute('title');
  check(!!title && title.includes('Diagnostika') && !title.includes('ZZ s2 test'), `UI: the clash is drawn in the other column with the reason: "${title}"`);
  await shot(page, 's2-real-r4-clash');

  /* a second InBody booking at 14:00, dragged onto 09:00 -> the real server refuses the move with worker.busy */
  const other = await A('POST', `/api/calendars/${inb.id}/appointments/unregistered`, { activityId: inbAct.id, startUtc: utc(day, '14:00'), name: 'ZZ s2 test C' });
  check(other.status === 200 || other.status === 201, `booking: InBody 14:00 made (HTTP ${other.status})`);
  const otherId = (other.json?.data ?? other.json)?.id ?? (other.json?.appointment?.id);
  await page.reload();
  await waitPlanner(page);
  await weekOf(day);
  await pickServices('Sportovní diagnostika', 'InBody 770');
  const card = page.locator(`[data-testid="board-booking-${otherId}"]`);
  await card.waitFor({ timeout: 20000 });
  const cb = await card.boundingBox();
  const target = await page.locator(clashSel).first().boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + 6);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2, (cb.y + target.y) / 2, { steps: 6 });
  await page.mouse.move(target.x + target.width / 2, target.y + 6, { steps: 8 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
  await shot(page, 's2-real-r4-drag-dropped');
  const confirm = page.getByRole('button', { name: /Přesunout|Potvrdit/ }).first();
  await confirm.click({ timeout: 8000 }).catch((e) => console.log('   (no confirm button:', String(e).slice(0, 80), ')'));
  const dialog = page.getByTestId('worker-busy-dialog');
  await dialog.waitFor({ timeout: 20000 }).catch(async (e) => { await shot(page, 's2-real-r4-drag-fail'); console.log('   notice:', await page.locator('.board-notice').allInnerTexts()); throw e; });
  const msg = await dialog.getByTestId('worker-busy-message').innerText();
  check(/zaneprázdněn/.test(msg) && msg.includes('Diagnostika'), `UI: a refused move opens the dialog with the real clash: "${msg}"`);
  await shot(page, 's2-real-r4-move-busy');
  await dialog.getByLabel('Důvod výjimky').fill('Pacient čeká na místě');
  await dialog.getByRole('button', { name: 'Přesto potvrdit (správce)' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 20000 });
  const moved = un((await A('GET', `/api/day?from=${day}&to=${day}&calendarIds=${inb.id}`)).json).find((x) => x.id === otherId);
  check(!!moved && moved.startUtc.startsWith(`${day}T08:00`), `UI+API: the owner's override moved it to 09:00 (${moved?.startUtc})`);
  const detail = (await A('GET', `/api/calendars/${inb.id}/appointments/${otherId}`)).json;
  const hist = JSON.stringify(un(detail)).includes('Overridden') || JSON.stringify((await A('GET', `/api/calendars/${inb.id}/appointments/${otherId}/history`)).json).includes('Pacient čeká na místě');
  check(hist, 'API: the override reason is written into the appointment history');

  /* the club-window clash with the rule on: an exception list entry removes the refusal */
  const base = await A('POST', `/api/calendars/${diag.id}/appointments/unregistered`, { activityId: diagAct.id, startUtc: utc(day, '11:00'), name: 'ZZ s2 test D' });
  check(base.status === 200 || base.status === 201, 'booking: Diagnostika 11:00 made');
  const again = await A('POST', `/api/calendars/${inb.id}/appointments/unregistered`, { activityId: inbAct.id, startUtc: utc(day, '11:00'), name: 'ZZ s2 test E' });
  check(again.status === 409 && again.json?.code === 'worker.busy', 'API: at 11:00 the same worker is busy too (409 worker.busy) - before the exception');
  const put = await A('PUT', '/api/v1/settings/booking-slots', { workerExceptions: [me] });
  check(put.status === 200 && put.json.settings.workerExceptions.includes(me) && put.json.settings.singleWorkerAtATime === true, 'API: workerExceptions saved, the switch stayed on (a PUT that leaves a field out keeps it)');
  const free = await A('POST', `/api/calendars/${inb.id}/appointments/unregistered`, { activityId: inbAct.id, startUtc: utc(day, '11:00'), name: 'ZZ s2 test F' });
  check(free.status === 200 || free.status === 201, `API: a worker on the exception list can hold two things at once (HTTP ${free.status})`);
  await A('PUT', '/api/v1/settings/booking-slots', { workerExceptions: [] });
}

/* ----------------------------------------------------------------------------------------------------------- R17 */
async function r17() {
  console.log('\n== R17 ==');
  const day = await cleanDay('2026-12-01', ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  console.log(`   clean day: ${day}`);
  for (const c of cals) await A('DELETE', `/api/calendars/${c.id}/lunch-exceptions/${day}`); /* a known start: the weekly lunch everywhere */
  await weekOf(day);
  await pickServices('Sportovní diagnostika', 'InBody 770');
  const band = page.getByTestId(`lunch-${day}`);
  await band.waitFor({ timeout: 30000 });
  await page.getByTestId(`lunch-hit-${day}`).waitFor({ timeout: 30000 });
  check(true, 'UI: on the real server the lunch band has its click target (a Stage 2 server, the probe found the lunch routes)');
  /* Friday (any weekday) has the lunch band */
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="lunch-2"]').length >= 5, null, { timeout: 30000 }).catch(() => {});
  const days = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="lunch-2"]')].map((e) => e.getAttribute('data-testid').slice(6)));
  /* the weekdays of this week on which the server says the clinic works with a lunch (the planner draws the lunch where the open calendars share one) */
  const monday = (await page.evaluate(() => document.querySelector('[data-day]')?.getAttribute('data-day'))) ?? day;
  const expected = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.parse(`${monday}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    const rows = await Promise.all(cals.map(async (c) => un((await A('GET', `/api/calendars/${c.id}/preview?from=${d}&to=${d}`)).json)?.[0]));
    if (rows.every((r) => r?.isOpen && r.breakStart)) expected.push(d);
  }
  check(days.length === expected.length && expected.every((d) => days.includes(d)), `UI: the week shows the lunch on exactly the ${expected.length} working days the server gives one (${days.length})${expected.some((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 5) ? ', Friday included' : ''}`);
  await page.getByTestId(`lunch-hit-${day}`).click();
  const pop = page.getByTestId('lunch-popover');
  await pop.waitFor();
  await shot(page, 's2-real-r17-popover');
  await pop.getByTestId('lunch-start').fill('14:00');
  await pop.getByTestId('lunch-move-go').click();
  await pop.waitFor({ state: 'detached', timeout: 20000 });
  for (const c of cals) {
    const ex = un((await A('GET', `/api/calendars/${c.id}/lunch-exceptions?from=${day}&to=${day}`)).json);
    check(ex.length === 1 && ex[0].kind === 'moved' && ex[0].startTime === '14:00' && ex[0].endTime === '14:30' && ex[0].originalStart === '12:00', `API: ${c.name} holds the one-day exception moved 14:00-14:30 (was ${ex[0]?.originalStart})`);
  }
  const weekly = un((await A('GET', `/api/calendars/${diag.id}/preview?from=${day}&to=${day}`)).json)[0];
  check(weekly.breakStart?.startsWith('14:00') && weekly.lunchException?.kind === 'moved', `API: the preview shows the effective lunch ${weekly.breakStart} and lunchException ${JSON.stringify(weekly.lunchException)}`);
  const nextDay = new Date(Date.parse(`${day}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const nextRow = un((await A('GET', `/api/calendars/${diag.id}/preview?from=${nextDay}&to=${nextDay}`)).json)[0];
  check(nextRow.breakStart?.startsWith('12:00') && !nextRow.lunchException, 'API: the same weekday a week later still has the weekly 12:00 lunch (a one-day exception only)');
  await page.waitForFunction((d) => document.querySelector(`[data-testid="lunch-${d}"]`)?.textContent?.includes('přesunut'), day, { timeout: 20000 });
  check(true, 'UI: the band reads "Oběd · přesunut"');
  await shot(page, 's2-real-r17-moved');
  /* the 12:00 slot is bookable now (availability), the old lunch is free */
  await page.getByTestId(`lunch-hit-${day}`).click();
  await page.getByTestId('lunch-restore').click();
  await page.getByTestId('lunch-popover').waitFor({ state: 'detached', timeout: 20000 });
  const after = un((await A('GET', `/api/calendars/${diag.id}/lunch-exceptions?from=${day}&to=${day}`)).json);
  check(after.length === 0, 'API: "Vrátit" restored the weekly lunch (no exception left)');
  /* remove for today only -> ghost -> restore */
  await page.getByTestId(`lunch-hit-${day}`).click();
  await page.getByTestId('lunch-remove').click();
  await page.getByTestId('lunch-popover').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForFunction((d) => document.querySelector(`[data-testid="lunch-${d}"]`)?.getAttribute('data-lunch') === 'removed', day, { timeout: 20000 });
  check(true, 'UI: "Smazat jen dnes" leaves the dashed "Oběd · smazán dnes" ghost where it was');
  await shot(page, 's2-real-r17-removed');
  const rem = un((await A('GET', `/api/calendars/${diag.id}/lunch-exceptions?from=${day}&to=${day}`)).json);
  check(rem[0]?.kind === 'removed', 'API: the exception is "removed" for that day only');
  /* overlap with a booking is refused by the server too (and by the pop-out before it asks) */
  await page.getByTestId(`lunch-hit-${day}`).click();
  await page.getByTestId('lunch-restore').click();
  await page.getByTestId('lunch-popover').waitFor({ state: 'detached', timeout: 20000 });
  const booked = await A('POST', `/api/calendars/${diag.id}/appointments/unregistered`, { activityId: diagAct.id, startUtc: utc(day, '15:00'), name: 'ZZ s2 lunch overlap' });
  check(booked.status === 200 || booked.status === 201, 'booking: Diagnostika 15:00-16:00 made');
  const overlap = await A('PUT', `/api/calendars/${diag.id}/lunch-exceptions/${day}`, { kind: 'moved', startTime: '15:30' });
  check(overlap.status === 409 && overlap.json?.code === 'lunch.overlaps_booking', `API: moving the lunch onto a booking is refused (${overlap.status} ${overlap.json?.code})`);
  /* into-lunch */
  const lunchSlot = await A('POST', `/api/calendars/${diag.id}/appointments/into-lunch`, { activityId: actOf('Individuální videoinstruovaný kompenzační plán').id, startUtc: utc(day, '12:00'), name: 'ZZ s2 do oběda' });
  check(lunchSlot.status === 201, `API: a booking INTO the lunch (12:00, 30 min) answers 201 (got ${lunchSlot.status})`);
  const ex2 = un((await A('GET', `/api/calendars/${diag.id}/lunch-exceptions?from=${day}&to=${day}`)).json);
  check(ex2[0]?.kind === 'removed', 'API: and that day\'s lunch is now removed (one calendar)');
  const nextExc = un((await A('GET', `/api/calendars/${diag.id}/lunch-exceptions?from=${nextDay}&to=${nextDay}`)).json);
  check(nextExc.length === 0, 'API: no other day was touched');
  await A('DELETE', `/api/calendars/${diag.id}/lunch-exceptions/${day}`);
  await weekOf(day);
  await pickServices('Sportovní diagnostika', 'InBody 770');
  /* "Objednat pacienta sem" opens the real dialog on the lunch slot */
  await page.getByTestId(`lunch-hit-${day}`).waitFor({ timeout: 30000 });
  await page.getByTestId(`lunch-hit-${day}`).click();
  await page.getByTestId('lunch-book').click();
  const dlg = page.getByRole('dialog').first();
  await dlg.waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  const txt = (await dlg.innerText()).replace(/\s+/g, ' ');
  check(/12:00/.test(txt), `UI: the booking dialog opens on the lunch slot ("${txt.slice(0, 100)}...")`);
  await shot(page, 's2-real-r17-book-here');
}

/* ----------------------------------------------------------------------------------------------------------- R13 */
async function r13() {
  console.log('\n== R13 ==');
  /* the first week (from 26. 10.) that still has a club block - the release below consumes the copy's data, so a rerun uses the next one */
  let week = '2026-10-26';
  for (let i = 0; i < 12; i++) {
    const from = new Date(Date.parse('2026-10-26T12:00:00Z') + i * 7 * 86400000);
    const to = new Date(from.getTime() + 6 * 86400000);
    const found = un((await A('GET', `/api/calendars/${byName('Ordinace 1').id}/blocks?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)).json).some((b) => b.kind === 'club');
    if (found) { week = from.toISOString().slice(0, 10); break; }
  }
  const weekEnd = new Date(Date.parse(`${week}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  console.log(`   week with a club hold: ${week}`);
  const blocks = un((await A('GET', `/api/calendars/${byName('Ordinace 1').id}/blocks?from=${week}&to=${weekEnd}`)).json);
  const club = blocks.find((b) => b.kind === 'club');
  check(!!club && !!club.orderCode && club.clubOrderId && typeof club.playersMissing === 'boolean' && 'holdExpired' in club, `API: club blocks carry the contract fields (${club?.orderCode}, playersMissing=${club?.playersMissing}, holdExpired=${club?.holdExpired}, holdUntilUtc=${club?.holdUntilUtc ?? '-'})`);
  const manual = blocks.find((b) => b.kind === 'manual');
  check(!manual || !('orderCode' in manual), 'API: a manual block carries none of them');
  await weekOf(week);
  await pickServices('Sportovní lékařské prohlídky');
  const win = page.locator('[data-testid^="board-window-"]').first();
  await win.waitFor({ timeout: 30000 });
  const code = await win.getByTestId('club-window-code').innerText().catch(() => '');
  const hold = await win.getByTestId('club-window-hold').innerText().catch(() => '');
  check(/^KO-/.test(code) && /Čeká na hráče|Obsazeno|Hold vypršel/.test(hold), `UI week: the window shows the lock, club, order code "${code}" and hold "${hold}"`);
  await shot(page, 's2-real-r13-week');
  /* month */
  await page.click('[data-view=month]');
  const tile = page.locator('[data-testid^="tile-club-"]').first();
  await tile.waitFor({ timeout: 20000 });
  const t = (await tile.innerText()).replace(/\s+/g, ' ');
  check(/KO-/.test(t) && /Čeká na hráče|Obsazeno|Hold vypršel/.test(t), `UI month: the tile says "${t}"`);
  await shot(page, 's2-real-r13-month');
  const mini = await page.locator('[data-testid^="mini-clubs-"]').count();
  check(mini > 0, `UI mini calendar: ${mini} day(s) carry the club bar`);
  await page.click('[data-view=week]');
  await page.waitForTimeout(1200);
  /* the click -> popover with the state and the release action */
  await win.click();
  const pop = page.getByTestId('club-popover');
  await pop.waitFor({ timeout: 20000 });
  await page.getByTestId('club-popover-hold').waitFor({ timeout: 20000 });
  const holdLine = await page.getByTestId('club-popover-hold').innerText();
  check(/zapsáno|Čeká|Hold|Obsazeno/.test(holdLine), `UI popover: "${holdLine}"`);
  await shot(page, 's2-real-r13-popover');
  /* release the expired holds of that order (this copy of the database only) */
  const before = un((await A('GET', `/api/calendars/${byName('Ordinace 1').id}/blocks?from=${week}&to=${weekEnd}`)).json).filter((b) => b.kind === 'club' && b.clubOrderId === club.clubOrderId).length;
  const releaseBtn = page.getByTestId('club-release');
  check((await releaseBtn.count()) === 1, 'UI popover: "Uvolnit nevyplněné" is offered (bookings.edit, server sent hold data)');
  await releaseBtn.click();
  await page.getByTestId('club-popover-release-confirm').getByRole('button', { name: 'Uvolnit' }).click();
  const done = page.getByTestId('club-popover-released');
  await done.waitFor({ timeout: 20000 });
  const said = await done.innerText();
  const afterBlocks = un((await A('GET', `/api/calendars/${byName('Ordinace 1').id}/blocks?from=${week}&to=${weekEnd}`)).json).filter((b) => b.kind === 'club' && b.clubOrderId === club.clubOrderId).length;
  check(afterBlocks < before || /Není co uvolnit/.test(said), `UI+API: release answered "${said}" (club windows of the order in that week: ${before} -> ${afterBlocks})`);
  const again = await A('POST', `/api/v1/club-orders/${club.clubOrderId}/release-unfilled`, { onlyExpired: false });
  check(again.status === 200 && again.json.windowsRemoved === 0 && again.json.windowsShortened === 0, 'API: a second release changes nothing (idempotent)');
  await shot(page, 's2-real-r13-released');
  /* the hold setting */
  await page.goto(`${BASE}/nastaveni/kluby`);
  const field = page.getByLabel('Držet čas klubu do X dní před termínem');
  await field.waitFor({ timeout: 30000 });
  check((await field.inputValue()) === '7', 'UI settings: holdUntilDaysBefore reads 7 from the real server');
  await field.fill('10');
  await page.getByRole('button', { name: 'Uložit' }).first().click();
  await page.waitForTimeout(1500);
  check((await A('GET', '/api/v1/settings/clubs')).json.holdUntilDaysBefore === 10, 'API: saved 10 (the other club settings were carried back)');
  await A('PUT', '/api/v1/settings/clubs', { ...(await A('GET', '/api/v1/settings/clubs')).json, holdUntilDaysBefore: 7 });
  await shot(page, 's2-real-r13-settings');
}

if (only === 'all' || only === 'r4') await r4();
if (only === 'all' || only === 'r17') await r17();
if (only === 'all' || only === 'r13') await r13();
console.log('console errors:', page.errors.filter((e) => !e.includes('403')).slice(0, 5));
await browser.close();
console.log(failed === 0 ? '\nALL REAL-BACKEND CHECKS PASS' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed);
