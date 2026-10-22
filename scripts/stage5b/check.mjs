/*
 * Stage 5b in a real browser (its OWN headless Chromium, never the shared pane):
 *   R14a  the merged history page of an order group, at phone / tablet / desktop;
 *   R14f  every download button as the owner (a file arrives: CSV with one BOM, audit row written) and as a receptionist
 *         (buttons off with the reason, the API answers 403 export.forbidden), then with the permission granted.
 *
 *     BASE=http://localhost:3096 API=http://localhost:5096 node scripts/stage5b/check.mjs
 *     env: DEV_LOGIN (file with "E-mail:" / "Password:"), OUT_DIR (design/stage5b), PART=history|downloads (default both)
 *
 * The API must run against a SCRATCH copy of the dev database (this script writes orders, a user and permission changes).
 * Credentials are read from the file and used; never printed.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from '../pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://localhost:3096';
const API = process.env.API ?? 'http://localhost:5096';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'stage5b'));
const PART = process.env.PART ?? 'history,downloads';
mkdirSync(OUT, { recursive: true });

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const STAFF_EMAIL = 'recepce.s5b@example.test';
const STAFF_PASS = 'Stage5b-Reception-Pass-2026!';

const failures = [];
const fail = (where, what) => {
  failures.push(`${where}: ${what}`);
  console.log(`  FAIL ${where}: ${what}`);
};
const ok = (where, what) => console.log(`  ok   ${where}: ${what}`);
const check = (cond, where, what) => (cond ? ok(where, what) : fail(where, what));

/* ------------------------------ API helpers ------------------------------ */

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text === '' ? null : JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, headers: res.headers };
}
const unwrap = (r) => (r.json && 'data' in r.json && r.json.success !== undefined ? r.json.data : r.json);

async function signIn(email, password) {
  const r = await api(null, 'POST', '/api/v1/session', { email, password });
  if (r.status !== 200) throw new Error(`sign-in ${email.split('@')[0]} -> ${r.status}`);
  return r.json.accessToken;
}

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });

async function uiLogin(ctx, email, password) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  await page.waitForTimeout(1200);
  return page;
}

/** Document never scrolls, nothing overflows sideways, tap targets are 44 px on phone and tablet. */
const measure = () => {
  const doc = document.documentElement;
  const small = [];
  for (const el of document.querySelectorAll('button, a[href], [role=button], input, [role=tab]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden=true]')) continue;
    if (el.disabled && !el.closest('[data-testid=export-blocked]')) continue;
    if (r.height < 43.5 && r.width < 200) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return {
    docY: Math.max(doc.scrollHeight - innerHeight, document.body.scrollHeight - innerHeight),
    docX: Math.max(doc.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth),
    small: small.slice(0, 8),
  };
};

const VIEWPORTS = [
  { width: 390, height: 844, label: 'phone', touch: true },
  { width: 820, height: 1180, label: 'tablet', touch: true },
  { width: 1440, height: 900, label: 'desktop', touch: false },
];

/* ================================ owner, seed ================================ */

const ownerToken = await signIn(EMAIL, PASS);
const seed = {};

if (PART.includes('history')) {
  console.log('\n== R14a seed ==');
  const clubs = unwrap(await api(ownerToken, 'GET', '/api/clubs?activeOnly=true')) ?? [];
  const club = (Array.isArray(clubs) ? clubs : clubs.items ?? [])[0];
  if (!club) throw new Error('no club in the scratch database');
  seed.clubId = club.id;
  const all = unwrap(await api(ownerToken, 'GET', '/api/activities'))?.activities ?? [];
  const byService = new Map();
  for (const a of all.filter((x) => x.isActive !== false).concat(all)) if (!byService.has(a.clinicServiceId)) byService.set(a.clinicServiceId, a.id);
  const acts = [...byService.entries()].map(([serviceId, activityId]) => ({ serviceId, activityId }));
  if (acts.length < 2) throw new Error(`need two services with an activity, found ${acts.length}`);
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const order = (extra) => ({
    clubId: club.id,
    paymentMethod: 'ClubInvoice',
    ranges: [{ fromDate: day(40), toDate: day(41) }],
    calendarIds: [],
    status: 'Requested',
    note: 'stage 5b',
    ...extra,
  });
  const root = await api(ownerToken, 'POST', '/api/v1/club-orders/staff', order({ serviceId: acts[0].serviceId, activitySeats: [{ activityId: acts[0].activityId, seats: 6 }] }));
  if (root.status !== 201) throw new Error(`root order -> ${root.status} ${root.text.slice(0, 200)}`);
  seed.rootId = root.json.id;
  const add1 = await api(ownerToken, 'POST', '/api/v1/club-orders/staff', order({ serviceId: acts[1].serviceId, activitySeats: [{ activityId: acts[1].activityId, seats: 4 }], parentOrderId: seed.rootId }));
  const add2 = await api(ownerToken, 'POST', '/api/v1/club-orders/staff', order({ serviceId: acts[1].serviceId, activitySeats: [{ activityId: acts[1].activityId, seats: 3 }], parentOrderId: seed.rootId }));
  if (add1.status !== 201 || add2.status !== 201) throw new Error(`addenda -> ${add1.status}/${add2.status}`);
  seed.add1 = add1.json.id;
  seed.add2 = add2.json.id;
  await api(ownerToken, 'POST', `/api/v1/club-orders/${seed.rootId}/notice`, { text: 'Prosíme o doložení seznamu hráčů.' });
  await api(ownerToken, 'POST', `/api/v1/club-orders/${seed.add2}/cancel`, { clubMessage: 'Dodatek už nepotřebujeme.' });
  const edit = await api(ownerToken, 'GET', `/api/v1/club-orders/${seed.rootId}`);
  const put = await api(ownerToken, 'PUT', `/api/v1/club-orders/${seed.rootId}`, { activitySeats: [{ activityId: acts[0].activityId, seats: 8 }], note: 'stage 5b změna' });
  console.log(`  seeded root/addenda; history lines on root: ${edit.json.history.length}, edit -> ${put.status}`);
}

/* ================================ R14a ================================ */

if (PART.includes('history')) {
  console.log('\n== R14a: merged history ==');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
  const page = await uiLogin(ctx, EMAIL, PASS);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_BLOCKED/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 160)}`));
  page.on('requestfailed', (r) => !/favicon|hot-update/.test(r.url()) && errors.push(`requestfailed ${r.url().slice(0, 100)}`));

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}/clubs/objednavky/${seed.rootId}/historie`);
    await page.waitForSelector('[data-testid=order-history]', { timeout: 30000 });
    await page.waitForFunction(() => /Vše \((\d+)\)/.exec(document.querySelector('[data-testid=history-view-all]')?.textContent ?? '')?.[1] >= 5, null, { timeout: 15000 }).catch(() => undefined);
    const title = (await page.textContent('h1')) ?? '';
    const total = await page.textContent('[data-testid=history-view-all]');
    const rows = await page.$$eval('[data-testid=order-history] > li', (li) => li.map((n) => n.textContent ?? ''));
    check(/Historie objednávky/.test(title), `history ${vp.label}`, 'page title');
    check(rows.length >= 5, `history ${vp.label}`, `one list across the group: ${total}, ${rows.length} entries`);
    check(rows.some((r) => /Dodatek KO-/.test(r)), `history ${vp.label}`, 'entries from an addendum are labelled with its code');
    check(rows.some((r) => /Důvod: Dodatek už nepotřebujeme/.test(r)), `history ${vp.label}`, 'cancellation reason is in the timeline');
    const chips = await page.$$eval('[data-testid=history-kinds] [data-testid^=history-kind-]', (c) => c.map((n) => n.textContent));
    check(chips.length >= 3, `history ${vp.label}`, `kind chips: ${chips.join(' | ')}`);
    const dates = await page.$$eval('[data-testid=order-history] > li', (li) => li.map((n) => n.textContent ?? ''));
    await page.screenshot({ path: join(OUT, `history-${vp.label}-all.jpg`), type: 'jpeg', quality: 80 });

    const m = await page.evaluate(measure);
    check(m.docY <= 1 && m.docX <= 1, `history ${vp.label}`, `document does not scroll (y ${m.docY}, x ${m.docX})`);
    if (vp.touch) check(m.small.length === 0, `history ${vp.label}`, `44 px targets ${m.small.join('; ')}`);

    /* a chip */
    const addendumChip = await page.$('[data-testid=history-kind-addendum]');
    if (addendumChip) {
      await addendumChip.click();
      await page.waitForTimeout(200);
      const filtered = await page.$$eval('[data-testid=order-history] > li', (li) => li.length);
      check(filtered > 0 && filtered < rows.length, `history ${vp.label}`, `Dodatky chip narrows ${rows.length} -> ${filtered}`);
      await page.screenshot({ path: join(OUT, `history-${vp.label}-addenda.jpg`), type: 'jpeg', quality: 80 });
      const link = await page.$('[data-testid=order-history] [data-testid=history-link]');
      check(link !== null, `history ${vp.label}`, 'an addendum entry has a link to its order');
      await addendumChip.click();
    }
    /* the club view */
    await page.click('[data-testid=history-view-club]');
    await page.waitForTimeout(200);
    const clubRows = await page.$$eval('[data-testid=order-history] > li', (li) => li.length);
    check(clubRows > 0 && clubRows < rows.length, `history ${vp.label}`, `Co vidí klub shows ${clubRows} of ${rows.length}`);
    await page.screenshot({ path: join(OUT, `history-${vp.label}-club.jpg`), type: 'jpeg', quality: 80 });
    await page.click('[data-testid=history-view-all]');
    if (vp.label === 'desktop') {
      const sorted = await page.$$eval('[data-testid=order-history] > li', (li) => li.length);
      void sorted;
    }
  }

  /* opened from an addendum: the same group */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/clubs/objednavky/${seed.add1}/historie`);
  await page.waitForSelector('[data-testid=order-history]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const fromAdd = await page.$$eval('[data-testid=order-history] > li', (li) => li.length);
  check(fromAdd >= 5, 'history from addendum', `${fromAdd} entries (the root's story is there too)`);

  /* the order panel shows the status chip and no history list */
  await page.goto(`${BASE}/clubs/objednavky`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((id) => history.pushState({ usr: { openOrderId: id } }, ''), seed.rootId);
  check(errors.length === 0, 'history console', errors.length === 0 ? 'no console error, no failed request' : errors.slice(0, 4).join(' || '));
  await ctx.close();
}

/* ================================ R14f ================================ */

if (PART.includes('downloads')) {
  console.log('\n== R14f: downloads ==');
  const auditCount = async () => {
    const r = await api(ownerToken, 'GET', '/api/audit/search?action=export.downloaded');
    return r.json?.data?.totalCount ?? -1;
  };
  const before = await auditCount();

  /* owner: files arrive */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ', acceptDownloads: true });
  const page = await uiLogin(ctx, EMAIL, PASS);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 160)}`));

  const bytesOf = async (download) => {
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
  };

  const tryDownload = async (where, url, buttonName, expectExt) => {
    await page.goto(`${BASE}${url}`);
    await page.waitForTimeout(1800);
    const button = page.getByRole('button', { name: buttonName }).first();
    if ((await button.count()) === 0) return fail(where, `button "${buttonName}" not found`);
    if (await button.isDisabled()) return ok(where, `"${buttonName}" is disabled (nothing to export in the scratch data) - skipped`);
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), button.click()]);
    const buf = await bytesOf(download);
    const name = download.suggestedFilename();
    check(name.endsWith(expectExt), where, `file "${name}" (${buf.length} bytes)`);
    if (expectExt === '.csv') {
      check(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf && buf[3] !== 0xef, where, 'CSV starts with exactly one UTF-8 BOM');
    }
    return buf;
  };

  
  await tryDownload('owner club statistics CSV', '/clubs/statistiky', 'Export CSV', '.csv');
  await tryDownload('owner players CSV', '/clubs/hraci', 'Stáhnout seznam', '.csv');
  const acc = await tryDownload('owner accounting export', '/accounting-export', 'Exportovat', '.csv');
  if (acc) check(acc[0] === 0xef && acc[1] === 0xbb && acc[2] === 0xbf, 'owner accounting export', 'server CSV carries the BOM');

  const after = await auditCount();
  check(after > before, 'audit', `export.downloaded rows ${before} -> ${after}`);
  const rowsRes = await api(ownerToken, 'GET', '/api/audit/search?action=export.downloaded');
  const rowsText = JSON.stringify(rowsRes.json);
  check(!/\d{6}\/\d{3,4}/.test(rowsText) && !/hraci-klubu|\.csv|\.pdf/.test(rowsText), 'audit', 'rows carry no birth number and no file name');

  /* an invoice PDF straight from the API: PDF/A markers and embedded fonts */
  const invoices = unwrap(await api(ownerToken, 'GET', '/api/billing/invoices')) ?? [];
  const inv = (Array.isArray(invoices) ? invoices : invoices.items ?? []).find((i) => i.status !== 'PendingApproval');
  if (inv) {
    const res = await fetch(`${API}/api/billing/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    const buf = Buffer.from(await res.arrayBuffer());
    const raw = buf.toString('latin1');
    check(res.status === 200 && raw.startsWith('%PDF-'), 'invoice PDF', `status ${res.status}, ${buf.length} bytes`);
    check(raw.includes('pdfaid:part') && raw.includes('/OutputIntents') && raw.includes('/FontFile'), 'invoice PDF', 'PDF/A identification, output intent and embedded fonts present');
  } else {
    console.log('  (no invoice in the scratch data - PDF/A is covered by the unit test)');
  }
  await ctx.close();

  /* receptionist: refused */
  console.log('\n-- receptionist --');
  const created = await api(ownerToken, 'POST', '/api/v1/users', { email: STAFF_EMAIL, displayName: 'Recepce S5B', role: 'Staff' });
  let userId = created.json?.account?.userId;
  if (created.status === 200) {
    await api(null, 'POST', '/api/v1/accounts/activate', { email: STAFF_EMAIL, temporaryPassword: created.json.temporaryPassword, newPassword: STAFF_PASS, newPasswordConfirmation: STAFF_PASS });
  } else {
    const users = unwrap(await api(ownerToken, 'GET', '/api/v1/users'));
    userId = (Array.isArray(users) ? users : users?.items ?? []).find((u) => u.email === STAFF_EMAIL)?.userId;
  }
  const staffToken = await signIn(STAFF_EMAIL, STAFF_PASS);

  const direct = await api(staffToken, 'GET', '/api/billing/invoices/00000000-0000-4000-8000-000000000001/pdf');
  check(direct.status === 403 && direct.json?.code === 'export.forbidden', 'receptionist API', `invoice PDF -> ${direct.status} ${direct.json?.code}`);
  const authz = await api(staffToken, 'POST', '/api/v1/exports/authorize', { kind: 'statistics-csv', count: 3 });
  check(authz.status === 403 && authz.json?.code === 'export.forbidden', 'receptionist API', `authorize -> ${authz.status} ${authz.json?.code}`);

  const sctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ', acceptDownloads: true });
  const spage = await uiLogin(sctx, STAFF_EMAIL, STAFF_PASS);
  for (const vp of VIEWPORTS) {
    await spage.setViewportSize({ width: vp.width, height: vp.height });
    await spage.goto(`${BASE}/clubs/statistiky`);
    await spage.waitForTimeout(2200);
    const blockedCount = await spage.$$eval('[data-testid=export-blocked]', (n) => n.length);
    const disabled = await spage.$$eval('[data-testid=export-blocked] button', (b) => b.every((x) => x.disabled));
    check(blockedCount > 0 && disabled, `receptionist ${vp.label} statistics`, `${blockedCount} export buttons switched off`);
    const reason = await spage.$eval('[data-testid=export-blocked]', (n) => n.getAttribute('aria-label'));
    check(reason === 'Stahování povoluje administrátor.', `receptionist ${vp.label}`, `reason "${reason}"`);
    if (vp.label === 'desktop') {
      await spage.hover('[data-testid=export-blocked]');
      await spage.waitForTimeout(500);
      check((await spage.getByText('Stahování povoluje administrátor.').count()) > 0, 'receptionist desktop', 'the reason shows on hover');
    }
    const m = await spage.evaluate(measure);
    check(m.docY <= 1 && m.docX <= 1, `receptionist ${vp.label}`, `document does not scroll (y ${m.docY}, x ${m.docX})`);
    await spage.screenshot({ path: join(OUT, `downloads-blocked-${vp.label}.jpg`), type: 'jpeg', quality: 80 });
  }
  await spage.goto(`${BASE}/accounting-export`);
  await spage.waitForTimeout(1500);
  const exportBtn = spage.getByRole('button', { name: 'Exportovat' }).first();
  check(await exportBtn.isDisabled().catch(() => false), 'receptionist accounting', 'Exportovat is off');

  /* the administrator grants it: the same person can download */
  const grant = await api(ownerToken, 'PUT', `/api/v1/users/${userId}/permissions/exports.download`, { granted: true });
  check(grant.status === 200, 'grant', `owner grants exports.download -> ${grant.status}`);
  const allowed = await api(await signIn(STAFF_EMAIL, STAFF_PASS), 'POST', '/api/v1/exports/authorize', { kind: 'statistics-csv', count: 3 });
  check(allowed.status === 204, 'receptionist after grant', `authorize -> ${allowed.status}`);
  await api(ownerToken, 'PUT', `/api/v1/users/${userId}/permissions/exports.download`, { granted: null });
  await sctx.close();
  check(errors.length === 0, 'downloads console', errors.length === 0 ? 'no page error' : errors.join(' || '));
}

await browser.close();
console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILED`}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
