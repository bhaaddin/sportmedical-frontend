/*
 * QA on the REAL stack: the owner's rule
 *   "When a club books days that already have patients, nobody is thrown out. The days I agreed with a club are visible in the
 *    normal calendar even before the club sent its players, and nobody can book them."
 *
 *   BASE=http://localhost:3116 node scripts/qa/club-hold-e2e.mjs [desktop|phone|both]      (THEME=light|dark seeds the stored theme; OUT=... moves the screenshots)
 *
 * Needs the app/next API on :5093 and Vite (vite.qa.config.mts) on :3116. Own headless Chromium; the login comes from the private
 * dev-login file (never printed). Test data is "ZZ test" only (club "ZZ test plánování", bookings noted "ZZ test club-hold") and is
 * cancelled at the end of every run (the API cannot delete). Screenshots go to design/qa/. Exit code = number of FAILed steps.
 *
 * Steps (per viewport):  1 booking  2 order over it  3 hold drawn in every view  4 nobody can book (staff UI / API / public)  5 release  6 cleanup
 */
process.env.BASE ??= 'http://localhost:3116';
process.env.OUT ??= 'design/qa';
const { launch, newPage, login, api, shot, findOrMakeClub, BASE } = await import('../club-planning/lib.mjs');

const which = process.argv[2] ?? 'both';
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
const results = [];
let size = 'desktop';
const check = (id, ok, text) => {
  results.push({ size, id, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${size}] ${id}  ${text}`);
};
const info = (id, text) => console.log(`INFO  [${size}] ${id}  ${text}`);
const guard = async (id, fn) => {
  try { await fn(); } catch (e) { check(id, false, `exception: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
};

const browser = await launch();
for (const sz of which === 'both' ? ['desktop', 'phone'] : [which]) {
  size = sz;
  await runSize(sz);
}
await browser.close().catch(() => {});
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\nFAILED ${failed} of ${results.length}` : `\nALL ${results.length} PASSED`);
process.exit(failed);

async function runSize(sz) {
  const phone = sz === 'phone';
  const page = await newPage(browser, sz);
  if (process.env.THEME) await page.addInitScript((m) => { try { localStorage.setItem('sm-theme-mode-v2', m); } catch { /* */ } }, process.env.THEME);
  await login(page);
  const A = (m, p, b) => api(page, m, p, b);
  const made = { appts: [], orders: [] };

  /* ---------- data ---------- */
  const cals = un((await A('GET', '/api/calendars')).json).filter((c) => c.isActive !== false);
  const X = cals.find((c) => c.name === 'Ordinace 1') ?? cals[0];
  const act = (await A('GET', '/api/activities')).json.data.activities.find((a) => a.isActive && a.durationMinutes === 40);
  const patient = (await A('GET', '/api/patients?pageSize=100&search=Etapa')).json.data.items.find((p) => p.lastName === 'Etapa')
    ?? (await A('GET', '/api/patients?pageSize=5')).json.data.items[0];
  const club = await findOrMakeClub(page);
  const slotsOf = async (d, pub) => un((await A('GET', `/api/calendars/${X.id}/availability?activityId=${act.id}&from=${d}&to=${d}&forPublic=${pub}${pub ? '' : '&staffStarts=true'}`)).json) ?? [];
  const hhmm = (utc) => new Date(utc).toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false });
  /* no booking of any status and no block of any kind on the day: earlier runs leave cancelled ZZ rows that would sit under the pointer */
  const dayIsClean = async (iso) => {
    const rows = un((await A('GET', `/api/day?from=${iso}&to=${iso}`)).json) ?? [];
    const blocks = un((await A('GET', `/api/calendars/${X.id}/blocks?from=${iso}&to=${iso}`)).json) ?? [];
    const orders = (await A('GET', '/api/v1/club-orders')).json; const list = (Array.isArray(orders) ? orders : orders?.data ?? []).filter((o) => o.status !== 'Cancelled');
    const pending = list.some((o) => (o.offeredDates ?? []).includes(iso) || (o.requestedDates ?? []).includes(iso) || (o.requestedRanges ?? []).some((r) => r.fromDate <= iso && r.toDate >= iso) || (o.blocks ?? []).some((b) => b.fromDate <= iso && b.toDate >= iso));
    return rows.length === 0 && (Array.isArray(blocks) ? blocks.length === 0 : true) && !pending;
  };
  let D = null;
  for (let i = 8; i < 60 && !D; i++) {
    const day = new Date(Date.now() + i * 864e5);
    const iso = day.toISOString().slice(0, 10);
    if ([0, 6].includes(day.getUTCDay())) continue;
    if ((await slotsOf(iso, false)).length >= 30 && (await slotsOf(iso, true)).length >= 5 && (await dayIsClean(iso))) D = iso;
  }
  if (!D) for (let i = 8; i < 21 && !D; i++) { const day = new Date(Date.now() + i * 864e5); const iso = day.toISOString().slice(0, 10); if (![0, 6].includes(day.getUTCDay()) && (await slotsOf(iso, false)).length >= 30) D = iso; }
  if (!D) throw new Error('no working day 8-20 days ahead with free slots');
  const staffSlots = await slotsOf(D, false);
  const slot = staffSlots.map((s) => s.startUtc).find((u) => hhmm(u) === '09:00') ?? staffSlots[4].startUtc;
  const bookH = Number(hhmm(slot).slice(0, 2));
  console.log(`\n=== ${sz}: day ${D}, calendar ${X.name}, činnost ${act.name}, booking at ${hhmm(slot)} ===`);

  const cancelAll = async () => {
    for (const o of made.orders) {
      const r = await A('POST', `/api/v1/club-orders/${o}/cancel?cancelAthletes=false`, {});
      console.log(`cleanup order ${o.slice(0, 8)} ${r.status}`);
    }
    for (const a of made.appts) {
      const r = await A('DELETE', `/api/calendars/${X.id}/appointments/${a}?reason=ZZ%20test%20cleanup`);
      console.log(`cleanup booking ${a.slice(0, 8)} ${r.status}`);
    }
  };

  try {
    /* ---------- 1 ---------- */
    const book = await A('POST', `/api/calendars/${X.id}/appointments`, { calendarId: X.id, patientId: patient.id, activityId: act.id, startUtc: slot, source: 0, note: 'ZZ test club-hold' });
    const appt = book.json?.data?.appointment ?? book.json?.data;
    if (appt?.id) made.appts.push(appt.id);
    check('1 booking', book.status === 201 && !!appt?.id, `POST appointment ${book.status}, ${D} ${hhmm(slot)} in ${X.name}`);
    const apptState = async () => {
      const r = await A('GET', `/api/calendars/${X.id}/appointments/${appt.id}`);
      const a = un(r.json);
      return { status: a?.status, startUtc: a?.startUtc, http: r.status };
    };
    const before = await apptState();

    /* ---------- 2: the club order over the patient ---------- */
    /* a placeholder order on another day, so staff can "Přidat do objednávky klubu" the marked range over the booking */
    let otherDay = null;
    for (let i = 14; i < 40 && !otherDay; i++) {
      const day = new Date(new Date(D + "T12:00:00Z").getTime() + i * 864e5);
      const iso = day.toISOString().slice(0, 10);
      if (![0, 6].includes(day.getUTCDay()) && (await slotsOf(iso, false)).length >= 30) otherDay = iso;
    }
    const mk = (d, f, t) => ({ fromDate: d, toDate: d, dailyFrom: f, dailyTo: t, activityIds: null });
    const base = await A('POST', '/api/v1/club-orders/staff', { clubId: club.id, serviceId: act.clinicServiceId, activitySeats: [{ activityId: act.id, seats: 3 }], paymentMethod: 'ClubInvoice', ranges: [mk(otherDay, '08:00', '09:00')], calendarIds: [X.id], status: 'Confirmed', note: 'ZZ test club-hold' });
    if (base.json?.id) made.orders.push(base.json.id);
    const orderId = base.json?.id;
    check('2 order created (other day)', base.status === 201, `POST club-orders/staff ${base.status} on ${otherDay}`);
    if (!orderId) throw new Error('the placeholder club order could not be made: ' + JSON.stringify(base.json).slice(0, 200));

    const hmin = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    let conflictStepShown = false;
    let holdFrom = hmin(bookH - 1, 0);
    let holdTo = hmin(bookH + 2, 0);
    let viaUi = false;

    if (!phone) {
      await guard('2 UI add-to-order', async () => {
        await page.addInitScript(() => { try { localStorage.setItem('calendarZoomV2', '3'); } catch { /* */ } });
        await page.goto(`${BASE}/planovani`);
        await page.waitForSelector('.sm-planner', { timeout: 120000 });
        await page.waitForTimeout(2500);
        await gotoWeek(page, D);
        const g = await geom(page, bookH);
        const x = g.x + g.w * ((weekdayIndex(D) + 0.5) / 7);
        const yAt = (min) => g.y0 + (min - bookH * 60) * g.px;
        /* drag from 30 min before the booking down across it to 90 min after its start */
        const from = bookH * 60 - 30;
        const to = bookH * 60 + 90;
        await page.mouse.move(x, yAt(from)); await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(x, yAt(from + ((to - from) * i) / 10));
        await page.mouse.up(); await page.waitForTimeout(800);
        info('2 menu', JSON.stringify(await page.$$eval('[role=menuitem]', (e) => e.map((n) => n.textContent.trim()))));
        await page.getByRole('menuitem', { name: /klub/i }).first().click(); await page.waitForTimeout(800);
        await page.getByRole('combobox', { name: 'Klub' }).click();
        await page.getByRole('option', { name: club.name }).first().click();
        await page.waitForTimeout(600);
        const rowHas = await page.getByTestId('add-to-club-order-row').count();
        info('2 dialog', `order rows offered: ${rowHas}`);
        await page.getByTestId('add-to-club-order-row').first().click();
        await shot(page, `qa-2a-add-dialog-${sz}`);
        await page.getByTestId('add-to-club-confirm').click();
        await page.waitForTimeout(3500);
        conflictStepShown = (await page.getByTestId('club-conflict').count()) > 0;
        const dialogOpen = (await page.getByTestId('add-to-club-order-dialog').count()) > 0;
        const failureText = dialogOpen ? (await page.getByTestId('add-to-club-order-dialog').innerText()).replace(/\s+/g, ' ').slice(-260) : '';
        await shot(page, `qa-2b-after-confirm-${sz}`);
        info('2 after confirm', `conflictStep=${conflictStepShown} dialogStillOpen=${dialogOpen} ${dialogOpen ? 'text: ' + failureText : ''}`);
        if (conflictStepShown) {
          const buttons = await page.getByTestId('club-conflict').getByRole('button').allInnerTexts();
          info('2 conflict step offers', `${buttons.join(' | ')}; notify checkbox: ${await page.getByRole('checkbox', { name: 'Upozornit klienta' }).count()}; propose: ${await page.locator('[data-testid^=club-conflict-to-]').count()}`);
          const now = await apptState();
          check('2 patient NOT moved while the conflict step is open', now.startUtc === before.startUtc && now.status === before.status, `${before.status}@${before.startUtc} -> ${now.status}@${now.startUtc}`);
          await page.keyboard.press('Escape'); await page.waitForTimeout(500);
        }
        viaUi = !dialogOpen || conflictStepShown;
      });
    }
    if (phone) info('2 R24 conflict step', 'not exercised on the phone (the marking of a range on the board is the desktop path)');
    else check('2 R24 conflict step appears (booking in a confirmed club window)', conflictStepShown, conflictStepShown ? 'shown' : 'NOT shown: the server accepted the club over the booking, so the UI never reached the step (it only opens after a 409)');

    /* make sure the order really covers D over the booking, whatever the UI did */
    let order = (await A('GET', `/api/v1/club-orders/${orderId}`)).json;
    const holdsD = () => (order.blocks ?? []).filter((b) => b.fromDate <= D && b.toDate >= D);
    if (holdsD().length === 0) {
      const ranges = [...(order.ranges ?? order.requestedRanges ?? []).map((r) => ({ fromDate: r.fromDate, toDate: r.toDate, dailyFrom: r.dailyFrom?.slice(0, 5) ?? null, dailyTo: r.dailyTo?.slice(0, 5) ?? null, activityIds: r.activityIds ?? null })), mk(D, holdFrom, holdTo)];
      const put = await A('PUT', `/api/v1/club-orders/${orderId}`, { activitySeats: order.activitySeats.map((s) => ({ activityId: s.activityId, seats: s.seats })), paymentMethod: order.paymentMethod, ranges, calendarIds: [X.id], note: 'ZZ test club-hold' });
      info('2 API fallback', `PUT order with ${D} ${holdFrom}-${holdTo}: ${put.status} ${put.status >= 300 ? JSON.stringify(put.json).slice(0, 200) : ''}`);
      order = (await A('GET', `/api/v1/club-orders/${orderId}`)).json;
    }
    const hold = holdsD()[0];
    info('2 hold', hold ? `${hold.fromDate} ${hold.dailyFrom}-${hold.dailyTo} players ${order.registeredSeats ?? order.registered ?? 0}/${order.totalSeats}` : 'NONE');
    if (hold) { holdFrom = hold.dailyFrom.slice(0, 5); holdTo = hold.dailyTo.slice(0, 5); }
    const after = await apptState();
    check('2 patient booking untouched (API: still active, same time)', hold != null && after.http === 200 && after.status === before.status && after.startUtc === before.startUtc && Number(after.status) === 0, `status ${before.status} -> ${after.status}, start ${before.startUtc} -> ${after.startUtc}; hold ${holdFrom}-${holdTo} covers it: ${hold ? 'yes' : 'NO HOLD'}`);
    const code = order.orderCode ?? order.code ?? null;
    info('2 order', `code ${code}, status ${order.status}, players registered ${order.registeredSeats ?? 0}`);
    check('2 order has no players (Čeká na hráče case)', (order.registeredSeats ?? order.registered ?? 0) === 0, `registered ${order.registeredSeats ?? 0}/${order.totalSeats}`);

    /* ---------- 3: the hold in every view ---------- */
    const clubName = club.name;
    if (!phone) {
      await guard('3 week', async () => {
        await page.goto(`${BASE}/planovani`);
        await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        await gotoWeek(page, D);
        await page.waitForTimeout(1500);
        const win = page.locator('.board-window.is-club').filter({ hasText: clubName }).first();
        const txt = (await win.innerText()).replace(/\s+/g, ' ');
        const hatch = await win.evaluate((e) => { const cs = getComputedStyle(e); return `${cs.backgroundImage.slice(0, 60)} | var ${cs.getPropertyValue('--win-hatch')}`; });
        info('3 week window', `${txt} | ${hatch}`);
        check('3 week view: hatched window with club name, order code, "Čeká na hráče"', /ZZ test plánování/.test(txt) && (!code || txt.includes(code)) && /Čeká na hráče/.test(txt) && /gradient|hatch|rgba/.test(hatch), txt);
        await page.mouse.move(900, 100); await page.waitForTimeout(400);
        check('3 week view: the words of the hold are on top, not hidden under the patient card', await wordsVisible(page, win), 'elementFromPoint at the centre of the club name');
        await shot(page, `qa-3-week-${sz}`);
        /* mini calendar */
        const miniLab = await page.$$eval('.mini-clubs i[data-hold]', (e) => e.length);
        const dayBtns = await page.$$eval('[aria-label*="Čeká na hráče"]', (e) => e.map((n) => n.getAttribute('aria-label')));
        info('3 mini', `marks ${miniLab}, aria: ${dayBtns.slice(0, 2).join(' / ')}`);
        check('3 mini calendar marks the day (club name + "Čeká na hráče" in its name)', dayBtns.some((l) => l.includes(clubName) && l.includes(D.slice(8) .replace(/^0/, ''))) || dayBtns.some((l) => l.includes(clubName)), `${dayBtns.length} labelled day(s)`);
        const mini = page.locator('.sm-planner [aria-label*="Čeká na hráče"]').first();
        if (await mini.count()) await mini.scrollIntoViewIfNeeded().catch(() => {});
        await shot(page, `qa-3-mini-${sz}`);
        /* day view */
        await page.locator('[data-view=day]:visible').first().click(); await page.waitForTimeout(1500);
        await gotoDay(page, D);
        const dwin = page.locator('[data-testid^=day-hold-]').filter({ hasText: clubName }).first();
        await dwin.waitFor({ timeout: 8000 }).catch(() => {});
        const dtxt = (await dwin.count()) ? (await dwin.textContent()).replace(/\s+/g, ' ') : '';
        check('3 day view: club row with name, code, "Čeká na hráče"', /ZZ test plánování/.test(dtxt) && /Čeká na hráče/.test(dtxt) && (!code || dtxt.includes(code)), dtxt || 'no club row in the Den list');
        await page.mouse.move(900, 700); await page.waitForTimeout(500);
        await shot(page, `qa-3-day-${sz}`);
        /* month */
        await page.locator('[data-view=month]:visible').first().click(); await page.waitForTimeout(1800);
        await gotoMonth(page, D);
        const tile = await page.$$eval('.tile-club', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ')));
        const mine = tile.filter((t) => t.includes(clubName));
        check('3 month tile: club name + "Čeká na hráče"', mine.some((t) => /Čeká na hráče/.test(t)), mine[0] ?? `no tile (${tile.length} club tiles)`);
        await shot(page, `qa-3-month-${sz}`);
      });
    } else {
      await guard('3 phone', async () => {
        await page.goto(`${BASE}/planovani`);
        await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        const dd = new Date(D + 'T12:00:00Z');
        const dayRe = new RegExp(`${dd.getUTCDate()}\\. ${dd.getUTCMonth() + 1}\\.`);
        const stripBtn = () => page.locator('button').filter({ hasText: dayRe }).filter({ hasText: /^(Po|Út|St|Čt|Pá|So|Ne)/ }).first();
        for (let i = 0; i < 8; i++) {
          if (await stripBtn().count()) break;
          await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(900);
        }
        await stripBtn().click(); await page.waitForTimeout(1500);
        /* the board of the day (default "Týden", one day) */
        const win = page.locator('.board-window.is-club').filter({ hasText: clubName }).first();
        await win.scrollIntoViewIfNeeded().catch(() => {});
        const wtxt = (await win.textContent().catch(() => '') ?? '').replace(/\s+/g, ' ');
        check('3 phone board (1 day): hatched window with club name, code, "Čeká na hráče"', /ZZ test plánování/.test(wtxt) && /Čeká na hráče/.test(wtxt) && (!code || wtxt.includes(code)), wtxt || 'no window');
        check('3 phone board: the words of the hold are on top, not hidden under the patient card', await wordsVisible(page, win), 'elementFromPoint at the centre of the club name');
        await shot(page, `qa-3-phone-board-${sz}`);
        /* 4a on the phone: a tap on the held time opens the club order, never the booking menu */
        { const wb = await win.boundingBox(); await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height - 12); }
        await page.waitForTimeout(900);
        const popTxt = (await page.locator('[data-testid=club-popover]').innerText().catch(() => '')).replace(/\s+/g, ' ');
        const bookItems = await page.getByRole('menuitem', { name: /Objednat pacienta/ }).count();
        check('4a phone: a tap on the held time opens the club order ("Čas drží klub – běžné objednávky sem nejdou"), no booking menu', /běžné objednávky sem nejdou/.test(popTxt) && bookItems === 0, `popover "${popTxt.slice(0, 150)}", booking menu items ${bookItems}`);
        await shot(page, `qa-4a-phone-tap-${sz}`);
        await page.keyboard.press('Escape'); await page.waitForTimeout(500);
        /* the agenda */
        await page.locator('[data-view=day]:visible').first().click(); await page.waitForTimeout(1500);
        await stripBtn().click().catch(() => {}); await page.waitForTimeout(800);
        await page.locator(`[data-testid=phone-strip-${D}]`).click().catch(() => {}); await page.waitForTimeout(1200);
        const entries = (await page.locator('[data-testid=phone-day-list]').innerText()).replace(/\s+/g, ' ');
        info('3 phone day list', entries);
        check('3 phone agenda: club entry with name, code, "Čeká na hráče"', entries.includes(clubName) && /Čeká na hráče/.test(entries) && (!code || entries.includes(code)), entries.slice(0, 200));
        await shot(page, `qa-3-agenda-${sz}`);
        await page.locator('[data-view=month]:visible').first().click(); await page.waitForTimeout(1500);
        for (let i = 0; i < 4; i++) {
          if (await page.locator(`[data-testid=phone-month-day-${D}]`).count()) break;
          await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(1000);
        }
        const row = (await page.locator(`[data-testid=phone-month-day-${D}]`).innerText().catch(() => '')).replace(/\s+/g, ' ');
        check('3 phone month list: club + "Čeká na hráče"', row.includes(clubName) && /Čeká na hráče/.test(row), row);
        await shot(page, `qa-3-phone-month-${sz}`);
      });
    }

    /* ---------- 4: nobody can book it ---------- */
    if (!phone) {
      await guard('4a staff UI', async () => {
        await page.goto(`${BASE}/planovani`);
        await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        await page.locator('[data-view=week]:visible').first().click().catch(() => {});
        await gotoWeek(page, D); await page.waitForTimeout(1500);
        const g = await geom(page, bookH);
        const x = g.x + g.w * ((weekdayIndex(D) + 0.5) / 7);
        const yAt = (min) => g.y0 + (min - bookH * 60) * g.px;
        /* (i) a drag that starts in free time before the hold and reaches into it */
        const from = hmin2(holdFrom) - 30; const to = hmin2(holdFrom) + 15;
        await page.mouse.move(x, yAt(from)); await page.mouse.down();
        for (let i = 1; i <= 6; i++) await page.mouse.move(x, yAt(from + ((to - from) * i) / 6));
        await page.mouse.up(); await page.waitForTimeout(600);
        const notice = await page.getByText(/Rezervováno pro klub/).first().innerText().catch(() => '');
        const menu = await page.locator('[role=menu], [data-testid=selection-popover], [role=dialog]').count();
        check('4a staff: a selection reaching into the hold says "Rezervováno pro klub …" and opens no booking menu', /Rezervováno pro klub ZZ test plánování/.test(notice) && menu === 0, `notice "${notice.replace(/\s+/g, ' ')}", menus/dialogs open: ${menu}`);
        await shot(page, `qa-4a-refusal-${sz}`);
        await page.waitForTimeout(3800);
        /* (ii) a click / drag that starts INSIDE the hold (free time after the booking) opens the club order, not the booking menu */
        const inFrom = bookH * 60 + 43; const inTo = bookH * 60 + 57;
        await page.mouse.move(x, yAt(inFrom)); await page.mouse.down();
        for (let i = 1; i <= 4; i++) await page.mouse.move(x, yAt(inFrom + ((inTo - inFrom) * i) / 4));
        await page.mouse.up(); await page.waitForTimeout(800);
        const pop = await page.locator('[data-testid=club-popover]').innerText().catch(() => '');
        const bookMenu = await page.getByRole('menuitem', { name: /Objednat pacienta/ }).count();
        check('4a staff: a drag that starts inside the hold opens the club order ("Čas drží klub – běžné objednávky sem nejdou"), no booking menu', /ZZ test plánování/.test(pop) && /běžné objednávky sem nejdou/.test(pop) && bookMenu === 0, `popover: "${pop.replace(/\s+/g, ' ').slice(0, 170)}", booking menu items: ${bookMenu}`);
        await shot(page, `qa-4a-click-inside-${sz}`);
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        await page.mouse.click(x, yAt(bookH * 60 + 50)); await page.waitForTimeout(800);
        const bookMenu2 = await page.getByRole('menuitem', { name: /Objednat pacienta/ }).count();
        const pop2 = await page.locator('[data-testid=club-popover]').count();
        check('4a staff: a plain click inside the hold never offers "Objednat pacienta"', bookMenu2 === 0, `club popover open: ${pop2}, booking menu items: ${bookMenu2}`);
        await page.keyboard.press('Escape');
      });
      await guard('4a drag booking', async () => {
        /* a second booking on the same day, outside the hold (after it), dragged into the hold */
        const later = staffSlots.map((s) => s.startUtc).find((u) => Number(hhmm(u).slice(0, 2)) >= bookH + 3);
        const b2 = await A('POST', `/api/calendars/${X.id}/appointments`, { calendarId: X.id, patientId: patient.id, activityId: act.id, startUtc: later, source: 0, note: 'ZZ test club-hold drag' });
        const a2 = b2.json?.data?.appointment ?? b2.json?.data;
        if (a2?.id) made.appts.push(a2.id);
        check('4a second booking for the drag created', b2.status === 201, `POST ${b2.status} at ${hhmm(later)}`);
        await page.reload(); await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        await gotoWeek(page, D); await page.waitForTimeout(1500);
        const card = page.getByTestId(`board-booking-${a2.id}`);
        await card.scrollIntoViewIfNeeded();
        const lh = Number(hhmm(later).slice(0, 2));
        const mid = Math.round((bookH + 1 + lh) / 2);
        const g = await geom(page, mid);
        const x = g.x + g.w * ((weekdayIndex(D) + 0.5) / 7);
        const yAt = (min) => g.y0 + (min - mid * 60) * g.px;
        const cb = await card.boundingBox(); const grab = cb.y + cb.height / 2;
        const targetMin = bookH * 60 + 45; // free time inside the hold, card top at 09:45 (after the 40-min booking)
        await page.mouse.move(cb.x + cb.width / 2, grab); await page.mouse.down();
        for (let i = 1; i <= 14; i++) await page.mouse.move(cb.x + cb.width / 2, grab + ((yAt(targetMin + 20) - grab) * i) / 14);
        await page.waitForTimeout(500);
        const reason = await page.locator('.move-ghost-reason').first().innerText().catch(() => '');
        await shot(page, `qa-4a-drag-refused-${sz}`);
        await page.mouse.up(); await page.waitForTimeout(1500);
        const r = await A('GET', `/api/calendars/${X.id}/appointments/${a2.id}`);
        const st = un(r.json);
        check('4a staff: dragging a booking into the hold is refused ("Rezervováno pro klub …") and it does not move', /Rezervováno pro klub/.test(reason) && st.startUtc === later, `ghost: "${reason}", start ${later} -> ${st.startUtc}`);
      });
    } else {
      info('4a', 'phone has no board selection/drag; staff UI refusal is verified at desktop (the agenda lists the hold, new bookings start from the same selection rule)');
    }

    /* 4b API direct POST into the held time */
    const heldStart = new Date(new Date(slot).getTime() + 45 * 60000).toISOString(); // booking start + 45 min: right after the patient, inside the hold
    const probeFree = await A('POST', `/api/calendars/${X.id}/appointments`, { calendarId: X.id, patientId: patient.id, activityId: act.id, startUtc: heldStart, source: 0, note: 'ZZ test club-hold api' });
    const created = probeFree.json?.data?.appointment ?? probeFree.json?.data;
    if (probeFree.status < 300 && created?.id) made.appts.push(created.id);
    check('4b API: direct POST of an appointment into the held time is refused', probeFree.status === 409 || probeFree.status === 422, `POST ${hhmm(heldStart)} -> ${probeFree.status} ${JSON.stringify({ message: probeFree.json?.message, code: probeFree.json?.code, errorCode: probeFree.json?.errorCode }).slice(0, 220)}`);
    const quick = await A('POST', `/api/calendars/${X.id}/appointments/quick`, { calendarId: X.id, activityId: act.id, startUtc: heldStart, firstName: 'ZZ test', lastName: 'Rychlá', note: 'ZZ test club-hold api' });
    if (quick.status < 300) { const q = quick.json?.data?.appointment ?? quick.json?.data; if (q?.id) made.appts.push(q.id); }
    info('4b API quick', `POST appointments/quick into the hold -> ${quick.status} ${JSON.stringify(quick.json).slice(0, 160)}`);
    const into = await A('POST', `/api/calendars/${X.id}/appointments/into-lunch`, { calendarId: X.id, patientId: patient.id, activityId: act.id, startUtc: heldStart, source: 0, note: 'ZZ test club-hold api' });
    if (into.status < 300) { const q = into.json?.data?.appointment ?? into.json?.data; if (q?.id) made.appts.push(q.id); }
    info('4b API into-lunch', `-> ${into.status}`);

    /* 4c public */
    const pubSlots = (await publicGet(page, `/api/public/booking/slots?calendarId=${X.id}&activityId=${act.id}&date=${D}`));
    const inHold = (pubSlots.list ?? []).filter((s) => hhmm(s.startUtc) >= holdFrom && hhmm(s.startUtc) < holdTo);
    const inHoldEnd = (pubSlots.list ?? []).filter((s) => { const e = hhmm(new Date(new Date(s.startUtc).getTime() + 40 * 60000).toISOString()); return e > holdFrom && hhmm(s.startUtc) < holdTo; });
    check('4c public API: /slots for the day offers nothing inside the hold', pubSlots.status === 200 && inHoldEnd.length === 0, `status ${pubSlots.status}, ${pubSlots.list?.length ?? 0} slots: ${(pubSlots.list ?? []).map((s) => hhmm(s.startUtc)).join(' ')}; overlapping the hold ${holdFrom}-${holdTo}: ${inHold.length}`);
    const pubHold = await page.evaluate(async ({ calendarId, activityId, startUtc }) => {
      const r = await fetch('/api/public/booking/hold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendarId, activityId, startUtc }) });
      return { status: r.status, text: (await r.text()).slice(0, 200) };
    }, { calendarId: X.id, activityId: act.id, startUtc: heldStart });
    check('4c public API: POST /hold into the held time is refused', pubHold.status >= 400 && pubHold.status < 500, `${pubHold.status} ${pubHold.text}`);
    if (pubHold.status < 300) info('4c', 'WARNING: a public hold was created; it lapses by itself');
    await guard('4c public UI', async () => {
      const pp = await newPage(browser, sz);
      const times = await publicDaySlots(pp, D, `qa-4c-public-hold-${sz}`);
      const inside = times.filter((t) => hhmm2(t, 40) > holdFrom && t < holdTo);
      check('4c public /objednat: the day is offered, but no slot inside the hold', times.length > 0 && inside.length === 0, `slots offered ${D}: ${times.join(' ') || 'none'}; inside ${holdFrom}-${holdTo}: ${inside.length}`);
      await pp.context().close();
    });

    /* ---------- 5: release ---------- */
    const rel = await A('POST', `/api/v1/club-orders/${orderId}/cancel?cancelAthletes=false`, {});
    check('5 cancelling the order succeeds', rel.status === 200, `cancel -> ${rel.status}`);
    made.orders = made.orders.filter((o) => o !== orderId);
    const staffAfter = (await slotsOf(D, false)).map((s) => hhmm(s.startUtc));
    const pubAfter = (await slotsOf(D, true)).map((s) => hhmm(s.startUtc));
    const bookEnd = hhmm(new Date(new Date(slot).getTime() + 40 * 60000).toISOString());
    const back = (list) => list.some((t) => t >= bookEnd && t < holdTo);
    check('5 the time is bookable again (staff + public availability)', back(staffAfter) && back(pubAfter), `staff slots in ${holdFrom}-${holdTo}: ${staffAfter.filter((t) => t >= holdFrom && t < holdTo).join(' ')}; public: ${pubAfter.filter((t) => t >= holdFrom && t < holdTo).join(' ')}`);
    await guard('5 public UI', async () => {
      const pp = await newPage(browser, sz);
      const times = await publicDaySlots(pp, D, `qa-5-public-released-${sz}`);
      check('5 public /objednat: the released time is offered again', times.some((t) => t >= bookEnd && t < holdTo), `slots offered ${D}: ${times.join(' ') || 'none'}`);
      await pp.context().close();
    });
    const again = await A('POST', `/api/calendars/${X.id}/appointments`, { calendarId: X.id, patientId: patient.id, activityId: act.id, startUtc: heldStart, source: 0, note: 'ZZ test club-hold after release' });
    const againAppt = again.json?.data?.appointment ?? again.json?.data;
    if (again.status < 300 && againAppt?.id) made.appts.push(againAppt.id);
    check('5 a booking into the released time is accepted', again.status === 201, `POST ${hhmm(heldStart)} -> ${again.status}`);
    if (!phone) {
      await guard('5 UI', async () => {
        await page.reload(); await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        await gotoWeek(page, D); await page.waitForTimeout(1500);
        const wins = await page.locator('.board-window.is-club').filter({ hasText: clubName }).count();
        check('5 UI: the hatched window is gone from the calendar', wins === 0, `club windows named ${clubName} on the week: ${wins}`);
        await shot(page, `qa-5-released-week-${sz}`);
      });
    }

    /* ---------- 2b: staff explicitly choose to move the patient ---------- */
    if (!phone) {
      await guard('2b explicit move', async () => {
        if (againAppt?.id) await A('DELETE', `/api/calendars/${X.id}/appointments/${againAppt.id}?reason=ZZ%20test`);
        const o2 = await A('POST', '/api/v1/club-orders/staff', { clubId: club.id, serviceId: act.clinicServiceId, activitySeats: [{ activityId: act.id, seats: 3 }], paymentMethod: 'ClubInvoice', ranges: [mk(otherDay, '08:00', '09:00')], calendarIds: [X.id], status: 'Confirmed', note: 'ZZ test club-hold 2b' });
        if (o2.json?.id) made.orders.push(o2.json.id);
        await page.goto(`${BASE}/planovani`);
        await page.waitForSelector('.sm-planner', { timeout: 120000 }); await page.waitForTimeout(2500);
        await gotoWeek(page, D);
        const g = await geom(page, bookH);
        const x = g.x + g.w * ((weekdayIndex(D) + 0.5) / 7);
        const yAt = (min) => g.y0 + (min - bookH * 60) * g.px;
        const from = bookH * 60 - 30; const to = bookH * 60 + 90;
        await page.mouse.move(x, yAt(from)); await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(x, yAt(from + ((to - from) * i) / 10));
        await page.mouse.up(); await page.waitForTimeout(800);
        await page.getByRole('menuitem', { name: /klub/i }).first().click(); await page.waitForTimeout(800);
        await page.getByRole('combobox', { name: 'Klub' }).click();
        await page.getByRole('option', { name: club.name }).first().click(); await page.waitForTimeout(600);
        await page.getByTestId('add-to-club-order-row').first().click();
        await page.getByTestId('add-to-club-confirm').click();
        await page.getByTestId('club-conflict').waitFor({ timeout: 20000 });
        await page.waitForSelector('[data-testid^=club-conflict-to-]', { timeout: 20000 });
        const mid = await apptState();
        check('2b the step names the booking and a proposed new slot; nothing moved yet', mid.startUtc === before.startUtc && (await page.locator('[data-testid^=club-conflict-to-]').count()) >= 1 && (await page.getByTestId('club-conflict-list').innerText()).includes(patient.lastName), `booking still ${mid.startUtc}; proposal: ${(await page.locator('[data-testid^=club-conflict-to-]').first().innerText()).replace(/s+/g, ' ')}`);
        await shot(page, `qa-2c-conflict-step-${sz}`);
        const orderBefore = (await A('GET', `/api/v1/club-orders/${o2.json.id}`)).json;
        await page.getByRole('checkbox', { name: 'Upozornit klienta' }).first().uncheck().catch(() => {});
        await page.getByTestId('club-conflict-go').click(); await page.waitForTimeout(5000);
        const moved = await apptState();
        const ord = (await A('GET', `/api/v1/club-orders/${o2.json.id}`)).json;
        const heldNow = (ord.blocks ?? []).filter((b) => b.fromDate <= D && b.toDate >= D)[0];
        const mStart = hhmm(moved.startUtc); const mEnd = hhmm(new Date(new Date(moved.startUtc).getTime() + 40 * 60000).toISOString());
        const clear = heldNow ? (mEnd <= heldNow.dailyFrom.slice(0, 5) || mStart >= heldNow.dailyTo.slice(0, 5) || moved.startUtc.slice(0, 10) !== before.startUtc.slice(0, 10)) : false;
        check('2b after the explicit "Přesunout a pokračovat": the patient is still booked (not cancelled) at a new time outside the hold, and the club holds the day', Number(moved.status) === 0 && moved.startUtc !== before.startUtc && clear, `booking ${before.startUtc} -> ${moved.startUtc} (status ${moved.status}); hold ${heldNow ? heldNow.dailyFrom + '-' + heldNow.dailyTo : 'NONE'}; blocks before ${(orderBefore.blocks ?? []).length}, after ${(ord.blocks ?? []).length}`);
        await shot(page, `qa-2d-after-move-${sz}`);
      });
    }
  } finally {
    /* ---------- 6 ---------- */
    await guard('6 cleanup', async () => {
      await cancelAll();
      const left = (await A('GET', `/api/v1/club-orders?clubId=${club.id}`)).json ?? [];
      const live = (Array.isArray(left) ? left : left.data ?? []).filter((o) => o.status !== 'Cancelled');
      check('6 cleanup: no live ZZ test order left', live.length === 0, `${live.length} live`);
    });
    console.log(sz, 'console errors:', page.errors.filter((e) => !/403|font|409|422/i.test(e)).slice(0, 4));
    await page.context().close();
  }
}

/* ---------- helpers ---------- */
async function wordsVisible(page, win) {
  const lab = win.locator('.win-label').first();
  await lab.scrollIntoViewIfNeeded().catch(() => {});
  const b = await lab.boundingBox();
  if (!b) return false;
  return page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('.board-window') && !el.closest('.board-booking'); }, { x: b.x + Math.min(b.width / 2, 40), y: b.y + b.height / 2 });
}
function hmin2(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function weekdayIndex(iso) { return (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7; }
function mondayOf(iso) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - weekdayIndex(iso)); return d; }
async function gotoWeek(page, iso) {
  const target = mondayOf(iso);
  const now = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }) + 'T12:00:00Z');
  const weeks = Math.round((target - mondayOf(now.toISOString().slice(0, 10))) / (7 * 864e5));
  for (let i = 0; i < weeks; i++) { await page.locator('[data-command=nextWeek]:visible').first().click(); await page.waitForTimeout(700); }
  await page.waitForTimeout(1200);
}
async function gotoDay(page, iso) {
  /* the mini calendar's day button is named "5. 11. 2026 · ..." */
  const d = new Date(iso + 'T12:00:00Z');
  const btn = page.locator(`[aria-label^="${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}"]`).first();
  await btn.click(); await page.waitForTimeout(1500);
}
async function gotoMonth(page, iso) { void page; void iso; /* the week of D is within the first/second month shown; the tile list is read as is */ }
async function geom(page, H) {
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
  return { ...g, px: (g.y1 - g.y0) / 60 };
}
function hhmm2(t, addMin) { const [h, m] = t.split(':').map(Number); const x = h * 60 + m + addMin; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; }
/** /objednat: first service, then the weeks until the day D; returns the HH:MM start of every slot button of that day. */
async function publicDaySlots(page, iso, shotName) {
  await page.goto(`${BASE}/objednat`); await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Objednat' }).first().click(); await page.waitForTimeout(2500);
  const label = new Date(iso + 'T12:00:00Z').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Prague' });
  const slotButtons = () => page.getByRole('button', { name: new RegExp('^' + label + ', ') });
  for (let i = 0; i < 12; i++) {
    const head = (await page.locator('body').innerText()).replace(/s+/g, ' ');
    const d = new Date(iso + 'T12:00:00Z');
    if (new RegExp(`${d.getUTCDate()}\. ${d.getUTCMonth() + 1}\.`).test(head)) break;
    await page.getByRole('button', { name: 'Následující týden' }).click(); await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(1200);
  const names = await slotButtons().evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent || ''));
  await page.screenshot({ path: `${process.env.OUT}/${shotName}.png` });
  return names.map((n) => n.split(', ').pop().trim()).sort();
}
async function publicGet(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(p);
    let j = null; try { j = await r.json(); } catch { /* */ }
    const list = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null;
    return { status: r.status, list };
  }, path);
}
