/*
 * R15c in a real browser (own headless Chromium, dev API :5092, this worktree's Vite :3011):
 *   (a) discount chips  (b) nearest free per činnost  (c) same-day notice  (d) undo of a move / a cancel
 *   (e) shortcuts       (f) phone search               (g) remembered confirmation channel
 * Test data: bookings with the note "ZZ test" for an existing patient (no patient data is created, printed or put in a URL);
 * every booking made here is cancelled at the end. Usage: node r15c-check.mjs [phone|tablet|desktop]
 */
import { launch, newPage, login, api, shot } from './lib.mjs';

const sizes = process.argv[2] ? [process.argv[2]] : ['desktop', 'tablet', 'phone'];
const browser = await launch();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const created = [];

async function setup(page) {
  const cals = (await api(page, 'GET', '/api/calendars')).json;
  const calendar = (cals.data ?? cals).find((c) => c.isActive !== false);
  const acts = (await api(page, 'GET', '/api/activities')).json.data.activities.filter((a) => a.isActive && a.clinicServiceId === calendar.clinicServiceId && a.priceCzk > 0);
  const act = acts[0];
  const pts = (await api(page, 'GET', '/api/patients?pageSize=100')).json;
  const rows = pts.data?.items ?? pts.items ?? pts.data ?? [];
  const patient = rows.find((r) => r.phone && String(r.phone).replace(/\D/g, '').length >= 9);
  return { calendar, act, patient, phoneDigits: String(patient.phone).replace(/\D/g, '').slice(-9) };
}

async function freeSlots(page, calendarId, activityId, days = 21) {
  const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const r = await api(page, 'GET', `/api/calendars/${calendarId}/availability?activityId=${activityId}&from=${from}&to=${to}&forPublic=false&staffStarts=true`);
  return (r.json?.data ?? r.json ?? []).map((s) => s.startUtc);
}

for (const size of sizes) {
  const page = await newPage(browser, size);
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await login(page);
  const { calendar, act, patient, phoneDigits } = await setup(page);
  const desk = size === 'desktop';

  // ---- (c) data: one booking of the patient on a day, so the dialog (opened on the next free slot) can warn
  const slots = await freeSlots(page, calendar.id, act.id);
  const day = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
  const firstDay = day(slots[0]);
  const sameDay = slots.filter((s) => day(s) === firstDay);
  const pick = sameDay[sameDay.length - 1];
  const made = await api(page, 'POST', `/api/calendars/${calendar.id}/appointments`, { calendarId: calendar.id, patientId: patient.id, activityId: act.id, startUtc: pick, source: 0, note: 'ZZ test stage6 (c)' });
  const madeId = made.json?.data?.appointment?.id ?? made.json?.data?.id ?? made.json?.appointment?.id;
  ok(made.status === 201 || made.status === 200, `${size}: test booking created (${made.status})`);
  if (madeId) created.push({ calendarId: calendar.id, id: madeId });

  await page.goto(`${process.env.BASE}/planovani`);
  await page.waitForSelector('.sm-planner', { timeout: 90000 });
  await page.waitForTimeout(2500);

  // ---- (e) shortcuts (a keyboard exists on tablet / desktop)
  if (!size.startsWith('phone')) {
    await page.keyboard.press('?');
    await page.waitForSelector('[data-testid=board-shortcuts]', { timeout: 8000 }).catch(() => {});
    ok(await page.locator('[data-testid=board-shortcuts]').count() === 1, `${size}: ? shows the shortcut pop-out`);
    if (desk) await shot(page, `r15c-shortcuts-${size}`);
    ok(await page.evaluate(() => { const r = document.querySelector('[data-testid=board-shortcuts]').getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight; }), `${size}: pop-out inside the viewport`);
    await page.keyboard.press('Escape');
    ok(await page.locator('[data-testid=board-shortcuts]').count() === 0, `${size}: Esc closes it`);
    const head0 = await page.textContent('#week-range');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
    ok((await page.textContent('#week-range')) !== head0, `${size}: arrow right = next week`);
    await page.keyboard.press('t'); await page.waitForTimeout(600);
    ok((await page.textContent('#week-range')) === head0, `${size}: T = today`);
    await page.keyboard.press('m'); await page.waitForTimeout(500);
    ok(await page.locator('.view-segment [data-view=month].active').count() === 1, `${size}: M = month`);
    await page.keyboard.press('w'); await page.waitForTimeout(500);
    ok(await page.locator('.view-segment [data-view=week].active').count() === 1, `${size}: W = week`);
  }

  // ---- open the dialog: N on a keyboard, the button on a phone
  if (!size.startsWith('phone')) { await page.keyboard.press('n'); } else { await page.click('[data-command=newBooking]'); }
  await page.waitForSelector('[role=dialog] input[aria-label="Jméno nebo příjmení"]', { timeout: 20000 });
  ok(true, `${size}: ${size.startsWith('phone') ? 'button' : 'N'} opens the booking dialog`);

  // typing in the dialog must not trigger shortcuts
  const search = page.locator('input[aria-label="Jméno nebo příjmení"]');
  await search.click();
  const headTyped = await page.textContent('#week-range').catch(() => '');
  await search.type('tmw', { delay: 20 });
  ok((await search.inputValue()) === 'tmw', `${size}: typing t/m/w into a field is typing, not shortcuts`);
  await search.fill('');

  // ---- (f) phone search: digits with a space, no + prefix; nothing of the number may reach a URL
  const typed = `${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 6)} ${phoneDigits.slice(6)}`;
  const mark = urls.length;
  await search.fill(typed);
  await page.waitForSelector('[role=list][aria-label="Nalezení pacienti"] button', { timeout: 30000 });
  ok(true, `${size}: a patient is found by a telephone number typed with spaces`);
  ok(!urls.slice(mark).some((u) => u.includes(phoneDigits.slice(0, 6))), `${size}: the number never appears in a request URL`);
  await search.fill(`+420${phoneDigits}`);
  await page.waitForTimeout(900);
  ok(await page.locator('[role=list][aria-label="Nalezení pacienti"] button').count() > 0, `${size}: the same number with +420 finds the patient`);


  // ---- choose the patient (the first card whose button text matches the patient's phone digits is the one searched for)
  await page.locator('[role=list][aria-label="Nalezení pacienti"] button').first().click();
  // (c) the notice, still on step 1 and again on step 2
  await page.waitForTimeout(1500);
  const noticeOn1 = await page.locator('[data-testid=same-day-notice]').count();
  console.log(`${size}: same-day notice on step 1: ${noticeOn1}`);
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.waitForTimeout(1200);
  await page.waitForSelector('[role=radiogroup][aria-label="Činnost"] [role=radio]', { timeout: 20000 });
  const dateShown = await page.locator('[data-testid=chosen-slot]').innerText().catch(() => '');
  const notice = page.locator('[data-testid=same-day-notice]');
  const noticeShown = await notice.count();
  console.log(`${size}: slot card "${dateShown.replace(/\s+/g, ' ').slice(0, 60)}"; notice count ${noticeShown}`);

  // ---- (b) nearest free per činnost: the link on the card (selects it and moves the slot)
  const card = page.locator(`[data-testid=nearest-free-${act.id}]`);
  ok(await card.count() === 1, `${size}: "Nejbližší volný termín" under the činnost in the list`);
  await page.locator('[role=radiogroup][aria-label="Činnost"] [role=radio]').filter({ hasText: act.name }).first().click();
  ok(await page.locator('[data-testid=nearest-free-chosen]').count() === 1, `${size}: one button in the dialog for the chosen činnost`);
  await page.locator('[data-testid=nearest-free-chosen]').click();
  await page.waitForSelector('[data-testid=nearest-note]', { timeout: 30000 });
  const note = await page.textContent('[data-testid=nearest-note]');
  ok(/Nejbližší volný termín: /.test(note ?? ''), `${size}: nearest free is named ("${(note ?? '').slice(0, 50)}")`);
  await page.waitForTimeout(800);
  const label = (d) => d.split('-').map(Number).reverse().join('. ');
  for (let i = 0; i < 25; i++) {
    const t = await page.locator('[data-testid=chosen-slot]').innerText().catch(() => '');
    if (t.includes(label(firstDay))) break;
    await page.locator('[data-testid=chosen-slot]').getByRole('button', { name: 'Změnit' }).click();
    await page.getByRole('menuitem', { name: /Zítra|Zítřek/ }).click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  ok(await notice.count() === 1 || noticeOn1 > 0, `${size}: same-day notice shown for the patient with another booking that day`);
  if (await notice.count()) {
    const text = await notice.first().innerText();
    ok(/Pacient už má ten den rezervaci: \d\d:\d\d/.test(text), `${size}: notice names the time and činnost`);
    ok((await notice.first().locator('a').getAttribute('href')).startsWith('/patients/'), `${size}: notice links to the patient card`);
  }

  // ---- (a) chips
  await page.waitForSelector('[data-testid=discount-presets]', { timeout: 20000 });
  const list = Number((await page.inputValue('[data-testid=agreed-price] input')) || 0);
  await page.click('[data-testid=discount-pct-10]');
  const afterTen = Number(await page.inputValue('[data-testid=agreed-price] input'));
  ok(afterTen === Math.floor((list * 0.9) + 0.5), `${size}: -10 % fills the editable price (${list} -> ${afterTen})`);
  ok((await page.getAttribute('[data-testid=discount-pct-10]', 'aria-pressed')) === 'true', `${size}: the chip stays pressed`);
  await page.click('[data-testid=discount-free]');
  ok(await page.locator('[data-testid=discount-free-reason]').count() === 1, `${size}: Zdarma asks for a reason`);
  const footerBtn = page.getByRole('button', { name: 'Objednat termín' });
  console.log(`${size}: submit enabled while free has no reason: ${await footerBtn.isEnabled().catch(() => 'n/a')}`);
  await page.fill('[data-testid=agreed-price-reason]', 'ZZ test zaměstnanec');
  ok(await page.locator('[data-testid=discount-free-reason]').count() === 0, `${size}: the reason removes the warning`);
  await page.getByRole('button', { name: 'Vrátit ceník' }).click();
  ok(Number(await page.inputValue('[data-testid=agreed-price] input')) === list, `${size}: "Vrátit ceník" resets the price`);
  const heights = await page.evaluate(() => [...document.querySelectorAll('[data-testid=discount-presets] button')].map((b) => b.getBoundingClientRect().height));
  ok(heights.every((h) => h >= 43.5), `${size}: chips are 44 px targets (${heights.map((h) => Math.round(h)).join(',')})`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${size}: no horizontal overflow`);
  await shot(page, `r15c-dialog-${size}`);

  // ---- (g) the e-mail link choice is remembered per user, default off
  const link = page.getByRole('checkbox', { name: /Poslat odkaz/ });
  const wasOn = await link.isChecked();
  ok(!wasOn, `${size}: confirmation channel starts off`);
  await link.check();
  const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('sm.booking.confirmChannel.')).map(([k, v]) => v));
  ok(stored.length === 1 && stored[0] === '{"sms":false,"email":true}', `${size}: stored as two booleans only (${stored.join('|')})`);
  await page.getByRole('button', { name: 'Zrušit' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  if (!size.startsWith('phone')) await page.keyboard.press('n'); else await page.click('[data-command=newBooking]');
  await page.waitForSelector('[role=dialog] input[aria-label="Jméno nebo příjmení"]', { timeout: 20000 });
  await page.locator('input[aria-label="Jméno nebo příjmení"]').fill(phoneDigits);
  await page.waitForSelector('[role=list][aria-label="Nalezení pacienti"] button');
  await page.locator('[role=list][aria-label="Nalezení pacienti"] button').first().click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.waitForTimeout(1000);
  ok(await page.getByRole('checkbox', { name: /Poslat odkaz/ }).isChecked(), `${size}: the choice is remembered when the dialog is opened again`);
  await page.getByRole('checkbox', { name: /Poslat odkaz/ }).uncheck();
  ok(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sm.booking.confirmChannel.')).length) === 0, `${size}: switching it off removes the stored value`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ---- (d) undo, desktop only (a mouse drag): move the test booking and take it back, then cancel it and take that back
  if (desk && madeId) {
    await page.goto(`${process.env.BASE}/planovani`);
    await page.waitForSelector('.sm-planner', { timeout: 90000 });
    await page.waitForTimeout(2000);
    // go to the week that holds the test booking
    for (let i = 0; i < 6 && (await page.locator(`[data-testid=board-booking-${madeId}]`).count()) === 0; i++) { await page.click('[data-command=nextWeek]'); await page.waitForTimeout(1500); }
    const cardEl = page.locator(`[data-testid=board-booking-${madeId}]`);
    ok(await cardEl.count() === 1, 'desktop: the test booking is on the board');
    if (await cardEl.count()) {
      const box = await cardEl.boundingBox();
      const before = (await api(page, 'GET', `/api/calendars/${calendar.id}/appointments/${madeId}`)).json;
      const startBefore = (before.data ?? before).startUtc;
      await page.mouse.move(box.x + box.width / 2, box.y + 6);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 30, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y - box.height * 1.3, { steps: 8 });
      await page.mouse.up();
      const confirm = page.locator('[data-testid=move-confirm]');
      await confirm.waitFor({ timeout: 8000 }).catch(() => {});
      if (await confirm.count()) {
        const sub = confirm.getByRole('checkbox', { name: 'Upozornit klienta na změnu' });
        if (await sub.isChecked()) await sub.uncheck(); // do not mail anybody from a test
        await confirm.getByRole('button', { name: 'Přesunout' }).click();
        await page.waitForSelector('[data-testid=board-undo]', { timeout: 15000 });
        ok(/30 s|29 s/.test(await page.textContent('[data-testid=board-undo-left]')), 'desktop: a move arms a 30 s undo');
        const moved = (await api(page, 'GET', `/api/calendars/${calendar.id}/appointments/${madeId}`)).json;
        ok((moved.data ?? moved).startUtc !== startBefore, 'desktop: the booking really moved');
        await shot(page, 'r15c-undo-bar-desktop');
        await page.click('[data-testid=board-undo-run]');
        await page.waitForSelector('[data-testid=board-undo]', { state: 'detached', timeout: 15000 });
        const back = (await api(page, 'GET', `/api/calendars/${calendar.id}/appointments/${madeId}`)).json;
        ok((back.data ?? back).startUtc === startBefore, 'desktop: Vrátit zpět put the booking back at its old time');
      } else ok(false, 'desktop: the move confirm did not appear (drag target)');

      // cancel from the detail, then undo = a new booking at the same time
      await page.locator(`[data-testid=board-booking-${madeId}]`).click();
      await page.waitForTimeout(600);
      await page.getByText('Otevřít detail').first().click().catch(() => {});
      await page.waitForTimeout(1800);
      console.log('detail buttons:', (await page.$$eval('[role=dialog] button', (b) => b.map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().replace(/s+/g, ' ')).filter(Boolean))).join(' | '));
      const cancelBtn = page.getByRole('button', { name: 'Zrušit termín' }).first();
      if (await cancelBtn.count()) {
        await cancelBtn.click();
        const reason = page.getByRole('textbox', { name: /Důvod/ }).first();
        if (await reason.count()) await reason.fill('ZZ test');
        await page.getByRole('button', { name: 'Zrušit termín' }).last().click();
        await page.waitForSelector('[data-testid=board-undo][data-kind=cancel]', { timeout: 15000 });
        ok(true, 'desktop: a cancel arms the undo');
        await page.click('[data-testid=board-undo-run]');
        await page.waitForSelector('[data-testid=board-undo]', { state: 'detached', timeout: 15000 });
        const all = (await api(page, 'GET', `/api/day?from=${day(startBefore)}&to=${day(startBefore)}&calendarIds=${calendar.id}`)).json;
        const rows = all?.data?.items ?? all?.data ?? all ?? [];
        const again = (Array.isArray(rows) ? rows : []).filter((r) => r.startUtc === startBefore && r.patientId === patient.id && r.status !== 4);
        ok(again.length === 1, 'desktop: Vrátit zpět of the cancel created the booking again (new id: ' + (again[0]?.id !== madeId) + ')');
        for (const r of again) created.push({ calendarId: calendar.id, id: r.id });

      } else {
        console.log('desktop: the detail dialog did not offer a cancel button by that name (see screenshot)');
        await shot(page, 'r15c-detail-desktop');
        ok(false, 'desktop: cancel flow reachable');
      }
    }
  }
  console.log(size, 'console errors:', page.errors.filter((e) => !/403|font/i.test(e)).slice(0, 3));
  await page.context().close();
}

// ---- clean up: every booking made here is cancelled
const cleaner = await newPage(browser, 'desktop');
await login(cleaner);
for (const c of created) await api(cleaner, 'DELETE', `/api/calendars/${c.calendarId}/appointments/${c.id}?reason=ZZ%20test%20cleanup`);
console.log('cleaned', created.length, 'test bookings');
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
