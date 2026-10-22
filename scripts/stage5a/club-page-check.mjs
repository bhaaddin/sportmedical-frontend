/*
 * Stage 5a - the club PAGE (`/clubs/:clubId`) in a real browser, in three layouts plus the wide desktop.
 *
 *     BASE=http://localhost:3009 node scripts/stage5a/club-page-check.mjs
 *     env: DEV_LOGIN=<file with "E-mail:" / "Password:" lines>   OUT_DIR=design/stage5a   VP=390x844,820x1180,1440x900,1920x1080
 *          PLAYWRIGHT_CORE / CHROME_PATH as in scripts/pw-env.mjs
 *
 * OWN headless Chromium (never the shared browser pane), the login is read from the file and typed into the form, never printed.
 * Data: the club with the most orders is only READ (no write); one empty club "ZZ test stage5a" is created for the empty state and
 * deactivated at the end. For every viewport:
 *   - the clubs list -> a click on the club lands on the PAGE (not the planner), the first request wave is timed;
 *   - screenshot (small JPEG) of the populated page, the empty page, and (desktop) both themes;
 *   - the document does not scroll, nothing overflows sideways, one h1, every shelf is a region with a heading, six figures at most;
 *   - no console error / failed request; every touch target 44 px (phone, tablet), 32 px with a pointer;
 *   - text contrast >= 4.5 (3 for large text) for the text that sits on a plain background, in light and dark;
 *   - "Kalendář" opens the planner at /clubs/:id/kalendar (the stage is drawn), "Zpět na klub" returns to the page;
 *   - the old deep link /clubs/:id is the page; /clubs/objednavky/:orderId/historie is the history page, not a club;
 *   - an order card opens the order panel on /clubs/objednavky, "Historie" opens the history page.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from '../pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://localhost:3009';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'stage5a'));
const VIEWPORTS = (process.env.VP ?? '390x844,820x1180,1440x900,1920x1080').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});
mkdirSync(OUT, { recursive: true });

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const EMPTY_CLUB = process.env.EMPTY_CLUB ?? `ZZ test stage5a ${process.pid}`;
/** A valid IČO (modulo-11 check digit) the server has not seen: seven random digits and their check digit. */
function freshIco() {
  const d = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));
  const sum = d.reduce((a, x, i) => a + x * (8 - i), 0);
  return d.join('') + String((11 - (sum % 11)) % 10);
}

const failures = [];
const notes = [];
const report = { base: BASE, at: new Date().toISOString(), runs: {} };
const fail = (where, what) => { failures.push(`${where}: ${what}`); console.log(`  FAIL ${where}: ${what}`); };
const ok = (where, what) => console.log(`  ok   ${where}: ${what}`);
const check = (cond, where, what) => (cond ? ok(where, what) : fail(where, what));

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const STATE = join(tmpdir(), `sm-stage5a-${process.pid}.json`);

/* ---------------------------------- sign in once ---------------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  await page.waitForTimeout(1500);
  await ctx.storageState({ path: STATE });
  await ctx.close();
}

const apiOf = (page) => async (method, path, body) =>
  page.evaluate(async ({ method, path, body }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json };
  }, { method, path, body });
const unwrap = (b) => (b && typeof b === 'object' && 'data' in b && !('id' in b) ? b.data : b);

async function contextFor(vp, extra = {}) {
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height }, locale: 'cs-CZ', timezoneId: 'Europe/Prague', storageState: STATE,
    isMobile: vp.width < 768, hasTouch: vp.width < 1280, ...extra,
  });
}

/* ---------------------------------- the data ---------------------------------- */
let populated = null;
let empty = null;
let firstOrderId = null;
{
  const ctx = await contextFor({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prehled`);
  await page.waitForTimeout(800);
  const api = apiOf(page);
  const clubs = unwrap((await api('GET', '/api/clubs')).json) ?? [];
  const orders = unwrap((await api('GET', '/api/v1/club-orders')).json) ?? [];
  const count = new Map();
  for (const o of orders) if (o.status !== 'Cancelled') count.set(o.clubId, (count.get(o.clubId) ?? 0) + 1);
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  populated = best === undefined ? null : clubs.find((c) => c.id === best[0]) ?? null;
  firstOrderId = populated === null ? null : orders.find((o) => o.clubId === populated.id)?.id ?? null;
  empty = clubs.find((c) => c.name === EMPTY_CLUB) ?? null;
  if (empty === null) {
    const made = await api('POST', '/api/clubs', { name: EMPTY_CLUB, ico: freshIco(), paymentTermsDays: 14, contactPerson: 'Test Test', contactEmail: 'zz-test@example.invalid', contactPhone: '+420777000111' });
    console.log(`create ${EMPTY_CLUB}: ${made.status}`);
    empty = (unwrap((await api('GET', '/api/clubs')).json) ?? []).find((c) => c.name === EMPTY_CLUB) ?? null;
  }
  await ctx.close();
}
console.log(`populated club: ${populated?.name ?? '(none)'}  orders: ${firstOrderId ? 'yes' : 'no'}  empty club: ${empty ? 'ready' : 'missing'}`);

/* ---------------------------------- measurements run inside the page ---------------------------------- */
const measurePage = () => {
  const region = document.getElementById('fit-region');
  const out = { docScrollY: 0, docScrollX: 0, clipped: [], shelves: [], h1: 0, metrics: 0, regionScroll: 0 };
  const doc = document.documentElement;
  out.docScrollY = Math.max(doc.scrollHeight - window.innerHeight, document.body.scrollHeight - window.innerHeight);
  out.docScrollX = Math.max(doc.scrollWidth - window.innerWidth, document.body.scrollWidth - window.innerWidth);
  if (region === null) return out;
  out.regionScroll = region.scrollHeight - region.clientHeight;
  const box = region.getBoundingClientRect();
  const scrolls = (el) => {
    for (let a = el.parentElement; a !== null && a !== region; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };
  for (const el of region.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]') !== null) continue;
    if (r.right > box.right + 1 && !scrolls(el)) {
      out.clipped.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} > ${Math.round(box.right)} "${(el.textContent || '').trim().slice(0, 30)}"`);
      if (out.clipped.length >= 6) break;
    }
  }
  out.h1 = document.querySelectorAll('h1').length;
  out.metrics = document.querySelectorAll('[data-shelf="club-stats"] [data-card="metric"]').length;
  for (const s of region.querySelectorAll('section[data-shelf]')) {
    const labelled = s.getAttribute('aria-labelledby');
    const heading = labelled ? document.getElementById(labelled) : null;
    out.shelves.push({ id: s.getAttribute('data-shelf'), state: s.getAttribute('data-state'), heading: heading ? heading.textContent.trim() : null });
  }
  return out;
};

const smallTargets = (min) => {
  const region = document.getElementById('fit-region');
  if (region === null) return [];
  const list = [];
  const sel = 'a[href], button, [role=button], [role=tab], [role=option], [role=checkbox], input:not([type=hidden]), select, textarea';
  for (const el of region.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]') !== null || el.hasAttribute('disabled')) continue;
    const after = getComputedStyle(el, '::after');
    if (after.position === 'absolute' && after.content !== 'none' && after.content !== 'normal') continue;
    const isTextLink = el.tagName === 'A' && !el.querySelector('svg, img') && (el.textContent || '').trim().length > 0 && el.children.length === 0;
    const tooSmall = r.height < min - 0.5 || (!isTextLink && r.width < min - 0.5);
    if (!tooSmall) continue;
    list.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)}`);
  }
  return list;
};

/** WCAG contrast of the text that sits on a plain colour (a gradient or an image behind it is skipped and counted). */
const contrastAudit = () => {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const region = document.getElementById('fit-region');
  const bad = [];
  let checked = 0;
  let skipped = 0;
  const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (el === null || seen.has(el) || (n.textContent || '').trim() === '') continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const fg0 = parse(cs.color);
    if (fg0 === null) continue;
    /* find the first plain background; a gradient / image on the way makes it unknown */
    let bg = null;
    let unknown = false;
    const layers = [];
    for (let a = el; a !== null; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.backgroundImage !== 'none') { unknown = true; break; }
      const c = parse(s.backgroundColor);
      if (c !== null && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    if (unknown) { skipped += 1; continue; }
    bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) bg = over(l, bg);
    const fg = over(fg0, bg);
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    checked += 1;
    if (ratio < (large ? 3 : 4.5)) bad.push(`${ratio.toFixed(2)} "${(n.textContent || '').trim().slice(0, 28)}" ${px}px`);
  }
  return { checked, skipped, bad: bad.slice(0, 8), badCount: bad.length };
};

function watch(page, bucket) {
  page.on('pageerror', (e) => bucket.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|outside of Vite serving allow list/.test(m.text())) bucket.push(`console ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(BASE) && r.status() >= 400 && !/\/api\/(account|v1\/account)|\.woff|fontsource/.test(u)) bucket.push(`http ${r.status()} ${new URL(u).pathname}`);
  });
}

async function setMode(page, mode) {
  await page.evaluate((m) => { localStorage.setItem('sm-theme-mode-v2', m); }, mode);
  await page.reload();
}

const waitPage = async (page) => {
  await page.waitForSelector('[data-shelf="club-stats"]', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-shelf="club-stats"] [data-card="metric"]').length > 0 && !document.querySelector('[data-shelf][aria-busy="true"]'), null, { timeout: 60000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1400);
};

async function auditPage(page, where, vp, mode) {
  const m = await page.evaluate(measurePage);
  check(m.docScrollY <= 1, where, m.docScrollY <= 1 ? 'the document does not scroll' : `the document scrolls vertically by ${m.docScrollY}px`);
  check(m.docScrollX <= 1, where, m.docScrollX <= 1 ? 'no sideways scroll' : `the document scrolls sideways by ${m.docScrollX}px`);
  check(m.clipped.length === 0, where, m.clipped.length === 0 ? 'nothing overflows sideways' : `clipped: ${m.clipped.join(' | ')}`);
  check(m.h1 === 1, where, `one h1 (${m.h1})`);
  check(m.metrics >= 1 && m.metrics <= 6, where, `${m.metrics} figure(s) on the statistics shelf (max 6)`);
  for (const s of m.shelves) if (!s.heading) fail(where, `shelf "${s.id}" has no heading naming its region`);
  const touch = vp.width < 1280;
  const small = await page.evaluate(smallTargets, touch ? 44 : 32);
  if (small.length > 0) {
    if (touch) fail(where, `${small.length} target(s) under 44 px: ${small.slice(0, 6).join(' | ')}`);
    else notes.push(`${where}: ${small.length} target(s) under 32 px: ${small.slice(0, 4).join(' | ')}`);
  } else ok(where, touch ? 'every target is 44 px' : 'every target is 32 px or more');
  const c = await page.evaluate(contrastAudit);
  check(c.badCount === 0, where, c.badCount === 0 ? `text contrast AA in ${mode} (${c.checked} text nodes on a plain colour, ${c.skipped} on a gradient skipped)` : `contrast below AA in ${mode}: ${c.bad.join(' | ')}`);
  report.runs[where] = { regionScroll: m.regionScroll, shelves: m.shelves, contrast: { checked: c.checked, skipped: c.skipped, bad: c.badCount } };
}

/* ---------------------------------- the run ---------------------------------- */
for (const vp of VIEWPORTS) {
  console.log(`\n== ${vp.label}`);
  const ctx = await contextFor(vp);
  const page = await ctx.newPage();
  const problems = [];
  watch(page, problems);

  if (populated !== null) {
    const where = `${vp.label} list->page`;
    await page.goto(`${BASE}/clubs`);
    const card = page.locator('[role=listitem]').filter({ hasText: populated.name }).first();
    await card.waitFor({ timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await card.hover().catch(() => undefined);
    await page.waitForTimeout(350);
    const t0 = Date.now();
    await card.click();
    await page.waitForURL((u) => u.pathname === `/clubs/${populated.id}`, { timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 30000 });
    const heading = Date.now() - t0;
    await waitPage(page);
    check(!(await page.locator('.sm-planner').count()), where, `a click on the club lands on its PAGE (heading after ${heading} ms), not on the planner`);
    report.runs[`${where} timing`] = { headingMs: heading };
    await page.screenshot({ path: join(OUT, `page-${vp.label}-dark.jpg`), type: 'jpeg', quality: 70 });

    await auditPage(page, `${vp.label} populated dark`, vp, 'dark');

    /* an order card -> the order panel on /clubs/objednavky ; Historie -> the history page */
    const cardLink = page.locator('[data-shelf="club-orders"] [data-card="entity"] a').first();
    if (await cardLink.count()) {
      await cardLink.click();
      await page.waitForURL((u) => u.pathname === '/clubs/objednavky', { timeout: 15000 }).then(() => ok(where, 'an order card opens the orders page'), () => fail(where, 'an order card did not open /clubs/objednavky'));
      const panel = await page.locator('[role=dialog], [data-testid=order-detail], [aria-label*="Objednávka"]').count();
      check(panel > 0, where, 'the order panel is open on the orders page');
      await page.goBack();
      await waitPage(page);
      const hist = page.locator('[data-shelf="club-orders"] [data-testid=order-history]').first();
      await hist.click();
      await page.waitForURL((u) => /^\/clubs\/objednavky\/[^/]+\/historie$/.test(u.pathname), { timeout: 15000 }).then(() => ok(where, 'Historie opens the order history page (not mistaken for a club)'), () => fail(where, 'Historie did not open the history page'));
      await page.waitForTimeout(500);
      check((await page.locator('.sm-planner').count()) === 0 && (await page.locator('h1').count()) >= 1, where, 'the history page is an ordinary page');
      await page.goBack();
      await waitPage(page);
    } else notes.push(`${where}: no order card to click`);

    /* Kalendář -> the planner, then back */
    const calendar = page.locator('a[href$="/kalendar"]').first();
    await calendar.hover().catch(() => undefined);
    await page.waitForTimeout(500);
    const t1 = Date.now();
    await calendar.click();
    await page.waitForURL((u) => u.pathname === `/clubs/${populated.id}/kalendar`, { timeout: 30000 });
    await page.waitForSelector('.sm-planner', { timeout: 90000 });
    const planner = Date.now() - t1;
    await page.waitForTimeout(1500);
    ok(where, `Kalendář opens the planner at /kalendar (stage drawn after ${planner} ms)`);
    report.runs[`${where} timing`].calendarMs = planner;
    await page.screenshot({ path: join(OUT, `calendar-${vp.label}.jpg`), type: 'jpeg', quality: 60 });
    /* desktop / tablet: the "Zpět na klub" button next to Menu; the phone has no Menu, its top bar's trail leads back (Kluby a týmy › Klub › Kalendář) */
    const backButton = page.getByRole('button', { name: 'Zpět na klub' }).first();
    const backLink = page.locator(`a[href="/clubs/${populated.id}"]`).first();
    const back = (await backButton.count()) > 0 ? backButton : backLink;
    if (await back.count()) {
      await back.click();
      await page.waitForURL((u) => u.pathname === `/clubs/${populated.id}`, { timeout: 15000 }).then(() => ok(where, 'the way back to the club page works from the calendar'), () => fail(where, 'the way back did not return to the page'));
    } else fail(where, 'no way back to the club page from the club calendar');

    /* deep links */
    await page.goto(`${BASE}/clubs/${populated.id}`);
    await waitPage(page);
    check((await page.locator('.sm-planner').count()) === 0, where, 'the old deep link /clubs/:id is the page');
    await page.goto(`${BASE}/clubs/${populated.id}/kalendar`);
    await page.waitForSelector('.sm-planner', { timeout: 90000 });
    ok(where, 'the deep link /clubs/:id/kalendar is the planner');

    /* light theme (desktop and phone only: the two ends) */
    if (vp.width === 1440 || vp.width === 390) {
      await page.goto(`${BASE}/clubs/${populated.id}`);
      await setMode(page, 'light');
      await waitPage(page);
      await page.screenshot({ path: join(OUT, `page-${vp.label}-light.jpg`), type: 'jpeg', quality: 70 });
      await auditPage(page, `${vp.label} populated light`, vp, 'light');
      await setMode(page, 'dark');
    }
  }

  if (empty !== null) {
    const where = `${vp.label} empty club`;
    await page.goto(`${BASE}/clubs/${empty.id}`);
    await waitPage(page);
    const text = await page.locator('#fit-region').innerText();
    check(/Klub zatím nemá žádnou objednávku/.test(text), where, 'the orders shelf says the club has no order and offers the next action');
    check(await page.getByTestId('club-billing-warning').count() === 1, where, 'the missing billing data are marked in the header');
    check(!/NaN|undefined/.test(text), where, 'no NaN / undefined on the page');
    await page.screenshot({ path: join(OUT, `page-empty-${vp.label}.jpg`), type: 'jpeg', quality: 70 });
    await auditPage(page, `${vp.label} empty dark`, vp, 'dark');
  }

  if (problems.length > 0) fail(vp.label, `console / page / request errors: ${[...new Set(problems)].slice(0, 6).join(' | ')}`);
  else ok(vp.label, 'no console error, no failed request');
  await ctx.close();
}

/* ---------------------------------- clean up ---------------------------------- */
if (empty !== null && !process.env.KEEP_CLUB) {
  const ctx = await contextFor({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prehled`);
  await page.waitForTimeout(600);
  const del = await apiOf(page)('DELETE', `/api/clubs/${empty.id}`);
  console.log(`\ndeactivated ${EMPTY_CLUB}: ${del.status}`);
  await ctx.close();
}
await browser.close();

console.log('\n--- notes');
for (const n of notes) console.log('  ' + n);
console.log(`\n${failures.length ? `FAILED ${failures.length}` : 'ALL OK'}`);
for (const f of failures) console.log(' - ' + f);
import('node:fs').then(({ writeFileSync }) => writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2)));
process.exitCode = failures.length ? 1 : 0;
