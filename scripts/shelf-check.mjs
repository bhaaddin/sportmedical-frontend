/*
 * Does the shelf system hold in a real browser? Run against the dev stack (frontend :3000 or any Vite port, API :5092):
 *
 *     node scripts/shelf-check.mjs
 *     env: BASE=http://localhost:3000   DEV_LOGIN=<file with "E-mail:" / "Password:" lines>   OUT_DIR=design/shelf
 *          PLAYWRIGHT_CORE=<folder of playwright-core>   CHROME_PATH=<chrome.exe>
 *          VP=390x844,820x1180,1440x900,1920x1080   PAGES=prehled,patients,patient   POPULATED=0 (skip the mocked pass)
 *
 * It uses its OWN headless Chromium (never the shared browser pane), signs in once, then for each viewport x page
 * (Přehled /prehled, Pacienti /patients, a patient's card /patients/:id):
 *   - takes a screenshot into design/shelf/,
 *   - asserts the DOCUMENT never scrolls (the app shell is 100dvh and #fit-region is the one scroller),
 *   - asserts nothing overflows sideways - not the page, and not an element clipped by the region's edge,
 *   - asserts no console error, no page error and no failed request,
 *   - asserts every touch target in the page is 44 px (phone and tablet; on a desktop it only counts those under 32),
 *   - asserts every shelf is a region with a heading, and the page has one h1.
 * Then, on each viewport:
 *   - opens the command palette (Ctrl+K, and the search button), types, walks the list with the arrows and closes it with
 *     Esc, timing each step;
 *   - hovers a connected chip and times the peek;
 *   - swaps the accent through Nastavení (one swatch) and asserts the shelf's colours moved, then puts it back;
 *   - switches the Animace setting to vypnuto / omezené and asserts the shelves write no transform style.
 * A last pass (POPULATED=1, the default) answers today's bookings, the club inquiries, the registration queue and the
 * health of the outgoing queue from MOCKS in this private browser context (never the shared one; the context is closed
 * at the end), so the attention shelf and the day's rows can be photographed with something in them. Those screenshots are
 * named "-populated" and are not evidence of the dev data.
 *
 * Credentials are read from the file and typed into the form; they are never printed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'shelf'));
const VIEWPORTS = (process.env.VP ?? '390x844,820x1180,1440x900,1920x1080').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});
const PAGES = (process.env.PAGES ?? 'prehled,patients,patient').split(',');
const POPULATED = (process.env.POPULATED ?? '1') !== '0';
/* MODE=light photographs the light theme (screenshots get a "-light" suffix). */
const MODE = process.env.MODE ?? 'dark';
/* Which parts to run (default all): pages, palette, accent, motion, populated. */
const SECTIONS = new Set((process.env.SECTIONS ?? 'pages,palette,accent,motion,populated').split(','));
mkdirSync(OUT, { recursive: true });

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];

const failures = [];
const notes = [];
const report = { base: BASE, at: new Date().toISOString(), pages: {}, timing: {}, accent: {}, motion: {} };
const fail = (where, what) => {
  failures.push(`${where}: ${what}`);
  console.log(`  FAIL ${where}: ${what}`);
};
const ok = (where, what) => console.log(`  ok   ${where}: ${what}`);

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });

/* ------------------------------ sign in once ------------------------------ */

const STATE = join(tmpdir(), `sm-shelf-check-${process.pid}.json`);
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

/* ------------------------------ measurements, run inside the page ------------------------------ */

/** Scroll, overflow and structure of the page as it stands. */
const measurePage = () => {
  const region = document.getElementById('fit-region');
  const out = { docScrollY: 0, docScrollX: 0, clipped: [], shelves: [], h1: 0, regionScroll: 0 };
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
      out.clipped.push(`${el.tagName.toLowerCase()}${el.getAttribute('data-shelf') ? `[${el.getAttribute('data-shelf')}]` : ''} right=${Math.round(r.right)} > ${Math.round(box.right)} "${(el.textContent || '').trim().slice(0, 30)}"`);
      if (out.clipped.length >= 6) break;
    }
  }
  out.h1 = document.querySelectorAll('h1').length;
  for (const s of region.querySelectorAll('section[data-shelf]')) {
    const labelled = s.getAttribute('aria-labelledby');
    const heading = labelled ? document.getElementById(labelled) : null;
    out.shelves.push({ id: s.getAttribute('data-shelf'), state: s.getAttribute('data-state'), heading: heading ? heading.textContent.trim() : null });
  }
  return out;
};

/** Every visible interactive element in the page region that is smaller than `min` px. */
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
    /* a stretched card link's ::after covers the whole card: its hit area is the card, not the words */
    const after = getComputedStyle(el, '::after');
    if (after.position === 'absolute' && after.content !== 'none' && after.content !== 'normal') continue;
    /* a link that is only text is as wide as its words */
    const isTextLink = el.tagName === 'A' && !el.querySelector('svg, img') && (el.textContent || '').trim().length > 0 && el.children.length === 0;
    const tooSmall = r.height < min - 0.5 || (!isTextLink && r.width < min - 0.5);
    if (!tooSmall) continue;
    list.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)}`);
  }
  return list;
};

/* ------------------------------ one page, one viewport ------------------------------ */

/** A patient to open, read through the real API (a phone's register draws cards, not links). */
async function patientPath(page) {
  await page.goto(`${BASE}/prehled`);
  await page.waitForSelector('section[data-shelf]', { timeout: 30000 });
  const id = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/patients?pageSize=1', { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    return (body?.data?.items ?? body?.items ?? [])[0]?.id ?? null;
  });
  return id === null ? null : `/patients/${id}`;
}

const PAGE_PATH = { prehled: '/prehled', patients: '/patients' };
/* S-1 Den na recepci (route table 33-36 and `*`); `termin` opens a real appointment of the next weeks (read only, nothing is written). */
Object.assign(PAGE_PATH, { dnes: '/dnes', sluzby: '/prehled-sluzeb', availability: '/availability', notfound: '/tahle-stranka-neexistuje' });

/** An appointment to open (its own page, route 36): the first one the API lists from today on. */
async function appointmentPath(page) {
  await page.goto(`${BASE}/dnes`);
  await page.waitForSelector('section[data-shelf]', { timeout: 30000 });
  return page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(d);
    const from = day(new Date());
    const to = day(new Date(Date.now() + 40 * 864e5));
    const res = await fetch(`/api/day?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    const rows = (body?.data ?? body ?? []).filter((r) => r.calendarId);
    return rows.length === 0 ? null : `/kalendar/${rows[0].calendarId}/termin/${rows[0].id}`;
  });
}

async function openPage(page, name, patientHref) {
  const path = name === 'patient' || name === 'termin' ? patientHref : PAGE_PATH[name];
  await page.goto(`${BASE}${path}`);
  await page.waitForSelector('section[data-shelf]', { timeout: 30000 });
  /* let the data arrive, the cascade finish and the count-ups settle */
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1600);
}

function watch(page, bucket) {
  page.on('pageerror', (e) => bucket.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) bucket.push(`console ${m.text().slice(0, 200)}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(BASE) && r.status() >= 400 && !/\/api\/(account|v1\/account)/.test(u)) bucket.push(`http ${r.status()} ${new URL(u).pathname}`);
  });
}

async function checkPage(ctxFactory, vp, name, label = '') {
  const where = `${vp.label} ${name}${label}`;
  const ctx = await ctxFactory(vp);
  const page = await ctx.newPage();
  const problems = [];
  watch(page, problems);
  const href = name === 'patient' ? await patientPath(page) : name === 'termin' ? await appointmentPath(page) : null;
  if ((name === 'patient' || name === 'termin') && href === null) {
    fail(where, `no ${name === 'patient' ? 'patient' : 'appointment'} to open`);
    await ctx.close();
    return;
  }
  await openPage(page, name, href);
  /* The appointment's page opens with its detail dialog: close it to see (and measure) the page behind. */
  if (name === 'termin') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  const shot = join(OUT, `${name}${label}${MODE === 'light' ? '-light' : ''}-${vp.label}.jpg`);
  await page.screenshot({ path: shot, type: 'jpeg', quality: 82 });
  const m = await page.evaluate(measurePage);
  report.pages[where] = { regionScroll: m.regionScroll, shelves: m.shelves };

  if (m.docScrollY > 1) fail(where, `the document scrolls vertically by ${m.docScrollY}px`);
  else ok(where, 'the document does not scroll');
  if (m.docScrollX > 1) fail(where, `the document scrolls sideways by ${m.docScrollX}px`);
  if (m.clipped.length > 0) fail(where, `content is clipped by the right edge: ${m.clipped.join(' | ')}`);
  else ok(where, 'nothing overflows sideways');
  if (m.h1 !== 1) fail(where, `expected one h1, found ${m.h1}`);
  if (m.shelves.length === 0) fail(where, 'no shelf on the page');
  for (const s of m.shelves) if (!s.heading) fail(where, `shelf "${s.id}" has no heading naming its region`);
  if (problems.length > 0) fail(where, `console / page / request errors: ${[...new Set(problems)].slice(0, 5).join(' | ')}`);
  else ok(where, 'no console error, no failed request');

  const touch = vp.width < 1280;
  const small = await page.evaluate(smallTargets, touch ? 44 : 32);
  if (small.length > 0) {
    if (touch) fail(where, `${small.length} target(s) under 44 px: ${small.slice(0, 6).join(' | ')}`);
    else notes.push(`${where}: ${small.length} target(s) under 32 px: ${small.slice(0, 4).join(' | ')}`);
  } else ok(where, touch ? 'every target is 44 px' : 'every target is 32 px or more (a pointer)');

  await ctx.close();
  return shot;
}

const contextFor = (extra = {}) => async (vp) => {
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: vp.width, height: vp.height }, locale: 'cs-CZ', ...extra });
  /* MODE=light: the person picked "Světlý režim" (the staff app starts dark). */
  if (MODE === 'light') await ctx.addInitScript(() => localStorage.setItem('sm-theme-mode-v2', 'light'));
  return ctx;
};

if (SECTIONS.has('pages')) {
  for (const vp of VIEWPORTS) {
    console.log(`== ${vp.label}`);
    for (const name of PAGES) await checkPage(contextFor(), vp, name);
  }
}

/* ------------------------------ the palette, the peek, timed ------------------------------ */

async function paletteAndPeek(vp) {
  const where = `${vp.label} palette`;
  const ctx = await contextFor()(vp);
  const page = await ctx.newPage();
  const problems = [];
  watch(page, problems);
  await openPage(page, 'prehled');
  const timing = {};
  const phone = vp.width < 768;

  /* 1. the keyboard: Ctrl+K */
  const t0 = Date.now();
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role=combobox][aria-label="Hledat"]', { timeout: 10000 });
  timing.openByShortcutMs = Date.now() - t0;
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox');
  if (!focused) fail(where, 'the search field is not focused when the palette opens');
  else ok(where, `Ctrl+K opens the palette in ${timing.openByShortcutMs} ms with the field focused`);
  await page.screenshot({ path: join(OUT, `palette-open-${vp.label}.jpg`), type: 'jpeg', quality: 82 });

  const optionsBefore = await page.locator('[role=option]').count();
  if (optionsBefore < 3) fail(where, `the opening view lists ${optionsBefore} rows`);

  /* 2. type a name and let the server's answer come (the dev register has a patient found by "Test") */
  const t1 = Date.now();
  await page.keyboard.type('Test', { delay: 30 });
  await page
    .waitForSelector('[role=option][data-command^="patient-"]', { timeout: 15000 })
    .then(() => { timing.typeToPatientRowMs = Date.now() - t1; })
    .catch(() => fail(where, 'typing "Test" brought no patient row'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `palette-typed-${vp.label}.jpg`), type: 'jpeg', quality: 82 });

  /* 3. the arrows move the selection, the active descendant follows */
  const before = await page.evaluate(() => document.querySelector('[role=combobox]').getAttribute('aria-activedescendant'));
  await page.keyboard.press('ArrowDown');
  const after = await page.evaluate(() => document.querySelector('[role=combobox]').getAttribute('aria-activedescendant'));
  if (before === after) fail(where, 'ArrowDown did not move the selection');
  else ok(where, 'ArrowDown moves the selection');

  /* 4. Escape closes it and the focus goes back */
  const t2 = Date.now();
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role=combobox][aria-label="Hledat"]', { state: 'detached', timeout: 10000 });
  timing.closeByEscapeMs = Date.now() - t2;
  ok(where, `Esc closes it in ${timing.closeByEscapeMs} ms`);

  /* 5. the button: the header's on tablet and desktop, the top bar's on a phone */
  const button = phone ? page.locator('button[aria-label="Hledat"]').first() : page.locator('[data-palette-trigger]').first();
  if ((await button.count()) === 0) fail(where, 'there is no search button in the header');
  else {
    const box = await button.boundingBox();
    if (box && (phone || vp.width < 1280) && (box.height < 43.5 || box.width < 43.5)) fail(where, `the search button is ${Math.round(box.width)}x${Math.round(box.height)}, not 44 px`);
    const t3 = Date.now();
    await button.click();
    await page.waitForSelector('[role=combobox][aria-label="Hledat"]', { timeout: 10000 });
    timing.openByButtonMs = Date.now() - t3;
    ok(where, `the search button opens it in ${timing.openByButtonMs} ms`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role=combobox][aria-label="Hledat"]', { state: 'detached', timeout: 10000 });
  }

  /* 6. Enter on the first row goes somewhere (the first action is "Nová objednávka" -> the calendar) */
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role=combobox][aria-label="Hledat"]');
  const t4 = Date.now();
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === '/planovani', { timeout: 15000 });
  timing.enterToRouteMs = Date.now() - t4;
  ok(where, `Enter on "Nová objednávka" reaches the calendar in ${timing.enterToRouteMs} ms`);

  if (problems.length > 0) fail(where, `errors: ${[...new Set(problems)].slice(0, 4).join(' | ')}`);
  report.timing[vp.label] = { ...(report.timing[vp.label] ?? {}), ...timing };
  await ctx.close();
}

async function peek(vp) {
  const where = `${vp.label} peek`;
  if (vp.width < 1280) return; /* a touch never peeks */
  const ctx = await contextFor()(vp);
  const page = await ctx.newPage();
  const problems = [];
  watch(page, problems);
  await openPage(page, 'patients');
  /* Measured inside the page, so Playwright's own overhead is not counted: from the pointer arriving on the chip to the
     tooltip being in the document, and to its facts being there. */
  await page.evaluate(() => {
    window.__peek = { enter: 0, shown: 0, facts: 0 };
    document.addEventListener('pointerover', (e) => {
      if (window.__peek.enter === 0 && e.target instanceof Element && e.target.closest('a[data-entity="patient"]')) window.__peek.enter = performance.now();
    }, true);
    new MutationObserver(() => {
      const tip = document.querySelector('[role=tooltip][id]');
      if (tip !== null && window.__peek.shown === 0) window.__peek.shown = performance.now();
      if (tip !== null && window.__peek.facts === 0 && /Ročník|Telefon|Příští termín/.test(tip.textContent ?? '')) window.__peek.facts = performance.now();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  const chip = page.locator('a[data-entity="patient"]').first();
  await chip.hover();
  await page.waitForFunction(() => window.__peek.facts > 0, null, { timeout: 10000 });
  const m = await page.evaluate(() => window.__peek);
  const openMs = Math.round(m.shown - m.enter);
  const factsMs = Math.round(m.facts - m.enter);
  await page.screenshot({ path: join(OUT, `peek-${vp.label}.jpg`), type: 'jpeg', quality: 82 });
  report.timing[vp.label] = { ...(report.timing[vp.label] ?? {}), peekOpenAfterHoverMs: openMs, peekFactsMs: factsMs };
  ok(where, `the peek is in the document ${openMs} ms after the pointer arrives (350 ms is the designed pause) and has its facts after ${factsMs} ms`);
  if (openMs < 330) fail(where, `the peek opened after ${openMs} ms: faster than its designed pause`);
  await page.mouse.move(5, 5);
  await page.waitForSelector('[role=tooltip][id]', { state: 'detached', timeout: 5000 }).catch(() => fail(where, 'the peek did not close when the pointer left'));
  /* keyboard: Tab to a chip opens it, Escape closes it */
  await page.locator('a[data-entity="patient"]').first().focus();
  await page.waitForSelector('[role=tooltip][id]', { timeout: 5000 }).catch(() => fail(where, 'the peek did not open for keyboard focus'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role=tooltip][id]', { state: 'detached', timeout: 5000 }).catch(() => fail(where, 'Escape did not close the peek'));
  if (problems.length > 0) fail(where, `errors: ${[...new Set(problems)].slice(0, 4).join(' | ')}`);
  await ctx.close();
}

if (SECTIONS.has('palette')) {
  console.log('== palette, peek');
  for (const vp of VIEWPORTS) {
    await paletteAndPeek(vp);
    await peek(vp);
  }
}

/* ------------------------------ one accent swap ------------------------------ */

async function accentSwap() {
  const vp = VIEWPORTS.find((v) => v.width >= 1280) ?? VIEWPORTS[0];
  const where = `${vp.label} accent`;
  const ctx = await contextFor()(vp);
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('__shelf_seeded')) {
      localStorage.removeItem('sm-theme-accent');
      localStorage.setItem('sm-theme-mode-v2', 'dark');
      sessionStorage.setItem('__shelf_seeded', '1');
    }
  });
  const page = await ctx.newPage();
  const problems = [];
  watch(page, problems);

  const paint = () => page.evaluate(() => {
    const rail = [...document.querySelectorAll('section[data-shelf]')].map((s) => s.querySelector(':scope > div[aria-hidden="true"]')).find(Boolean);
    const count = document.querySelector('section[data-shelf="new-patients"] [aria-label^="Počet"]');
    const primary = document.querySelector('header a[href="/planovani"]');
    return {
      rail: rail ? getComputedStyle(rail).backgroundImage : null,
      count: count ? getComputedStyle(count).color : null,
      primary: primary ? `${getComputedStyle(primary).backgroundImage}|${getComputedStyle(primary).backgroundColor}` : null,
    };
  });

  await openPage(page, 'prehled');
  const before = await paint();
  await page.screenshot({ path: join(OUT, `prehled-accent-default-${vp.label}.jpg`), type: 'jpeg', quality: 82 });

  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const swatch = page.getByRole('button', { name: 'Fialová', exact: true });
  await swatch.scrollIntoViewIfNeeded();
  await swatch.click();
  await page.waitForTimeout(500);
  await openPage(page, 'prehled');
  const after = await paint();
  await page.screenshot({ path: join(OUT, `prehled-accent-purple-${vp.label}.jpg`), type: 'jpeg', quality: 82 });

  for (const key of ['rail', 'count', 'primary']) {
    if (before[key] === null || after[key] === null) fail(where, `could not measure ${key}`);
    else if (before[key] === after[key]) fail(where, `the accent swap did not change the shelf's ${key} (${before[key]})`);
    else ok(where, `the accent swap changed the shelf's ${key}`);
  }
  report.accent = { before, after };

  /* put it back */
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const back = page.getByRole('button', { name: 'Lesní zelená', exact: true });
  await back.scrollIntoViewIfNeeded();
  await back.click();
  if (problems.length > 0) fail(where, `errors: ${[...new Set(problems)].slice(0, 4).join(' | ')}`);
  await ctx.close();
}

if (SECTIONS.has('accent')) {
  console.log('== accent');
  await accentSwap();
}

/* ------------------------------ the Animace setting is honoured ------------------------------ */

async function motionModes() {
  const vp = VIEWPORTS.find((v) => v.width >= 1280) ?? VIEWPORTS[0];
  for (const [mode, attr] of [['vypnuto', 'off'], ['omezené', 'reduced'], ['plné', 'full']]) {
    const where = `${vp.label} motion ${mode}`;
    const ctx = await contextFor()(vp);
    await ctx.addInitScript((m) => localStorage.setItem('sm-motion', m), mode);
    const page = await ctx.newPage();
    const problems = [];
    watch(page, problems);
    await openPage(page, 'prehled');
    const seen = await page.evaluate(() => {
      const region = document.getElementById('fit-region');
      const styled = [];
      for (const el of region.querySelectorAll('*')) {
        const t = el.style.transform;
        const o = el.style.opacity;
        if ((t && t !== 'none') || (o && o !== '1')) styled.push(`${el.tagName.toLowerCase()} transform="${t}" opacity="${o}"`);
      }
      return { attr: document.documentElement.getAttribute('data-motion'), styled: styled.slice(0, 5), count: styled.length };
    });
    if (seen.attr !== attr) fail(where, `<html data-motion> is "${seen.attr}", expected "${attr}"`);
    if (mode === 'vypnuto' && seen.count > 0) fail(where, `${seen.count} element(s) still carry an inline transform or opacity: ${seen.styled.join(' | ')}`);
    else if (mode === 'omezené' && seen.styled.some((s) => /transform="(?!none)[^"]+"/.test(s))) fail(where, `a transform is written under omezené: ${seen.styled.join(' | ')}`);
    else ok(where, mode === 'plné' ? 'full motion settles (no leftover inline style)' : 'the setting is honoured');
    report.motion[mode] = seen;
    if (mode === 'plné' && seen.count > 0) fail(where, `the cascade left inline styles behind: ${seen.styled.join(' | ')}`);
    if (problems.length > 0) fail(where, `errors: ${[...new Set(problems)].slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
}

if (SECTIONS.has('motion')) {
  console.log('== motion');
  await motionModes();
}

/* ------------------------------ populated, from MOCKS in a private context ------------------------------ */

async function populatedPass() {
  const where = 'populated';
  /* Real patient ids, read through the real API, so the mocked rows name real people. */
  const probe = await (await contextFor()({ width: 1440, height: 900, label: 'probe' })).newPage();
  await probe.goto(`${BASE}/prehled`);
  const people = await probe.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/patients?pageSize=4', { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    const items = body?.data?.items ?? body?.items ?? [];
    return items.map((p) => p.id);
  });
  await probe.context().close();
  if (people.length < 2) {
    notes.push('populated pass skipped: fewer than two patients to name');
    return;
  }
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
  const at = (id, hourUtc, status, patientId, missing, extra = {}) => ({
    id, calendarId: 'mock-cal', patientId, activityId: 'mock-act', activityName: 'Sportovní prohlídka',
    startUtc: `${todayKey}T${String(hourUtc).padStart(2, '0')}:00:00Z`, endUtc: `${todayKey}T${String(hourUtc).padStart(2, '0')}:45:00Z`,
    status, isRunningLate: false, checkedInUtc: null, paperwork: { ready: missing.length === 0, missing }, agreedPriceCzk: null, listPriceCzk: 1600, ...extra,
  });
  const day = [
    at('m1', 6, 2, people[0], []), at('m2', 7, 1, people[1], ['questionnaire_missing']), at('m3', 8, 0, people[0], ['consent_missing', 'questionnaire_missing']),
    at('m4', 9, 0, people[1], []), at('m5', 10, 0, people[0], ['report_missing']), at('m6', 11, 3, people[1], []),
  ];
  const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: '', data: body, isSuccess: true }) });
  const mocks = async (ctx) => {
    await ctx.route('**/api/day?**', (route) => route.fulfill(json(day)));
    await ctx.route('**/api/v1/club-orders?**', (route) => route.fulfill(json([
      { id: 'o1', clubId: 'c1', clubName: 'FC Slavia', serviceId: null, serviceName: 'Sportovní prohlídky', status: 'Requested', activitySeats: [], totalSeats: 18, registered: 0, requestedRanges: [], blocks: [], history: [], addenda: [], note: '', createdBy: 'Club', createdAtUtc: new Date(Date.now() - 6 * 864e5).toISOString(), submittedAtUtc: new Date(Date.now() - 6 * 864e5).toISOString(), groupId: 'o1', parentOrderId: null, groupTotals: {}, invoiceId: null },
    ])));
    await ctx.route('**/api/patients/intake-review', (route) => route.fulfill(json([
      { intakeId: 'i1', referenceNumber: 'REG-2026-014', givenName: 'Eva', familyName: 'Nováková', dateOfBirth: '1991-02-03', sex: 'Female', outcome: 1, topScore: 0.8, suppliedBirthNumber: false, hasCzechPublicHealthInsurance: true, submittedAtUtc: new Date(Date.now() - 2 * 864e5).toISOString() },
      { intakeId: 'i2', referenceNumber: 'REG-2026-015', givenName: 'Tomáš', familyName: 'Krejčí', dateOfBirth: '1988-07-09', sex: 'Male', outcome: 1, topScore: 0.7, suppliedBirthNumber: false, hasCzechPublicHealthInsurance: true, submittedAtUtc: new Date(Date.now() - 864e5).toISOString() },
    ])));
    await ctx.route('**/api/system/health', (route) => route.fulfill(json({ status: 'warning', database: { reachable: true, latencyMs: 4 }, outbox: { pending: 2, failed: 3 } })));
  };
  for (const vp of VIEWPORTS) {
    const ctx = await contextFor()(vp);
    await mocks(ctx);
    const page = await ctx.newPage();
    const problems = [];
    watch(page, problems);
    await openPage(page, 'prehled');
    await page.screenshot({ path: join(OUT, `prehled-populated-${vp.label}.jpg`), type: 'jpeg', quality: 82 });
    const m = await page.evaluate(measurePage);
    if (m.docScrollY > 1) fail(`${vp.label} ${where}`, `the document scrolls by ${m.docScrollY}px`);
    if (m.clipped.length > 0) fail(`${vp.label} ${where}`, `content is clipped: ${m.clipped.join(' | ')}`);
    const cards = await page.locator('[data-card="attention"]').count();
    const first = await page.locator('[data-card="attention"]').first().getAttribute('data-severity');
    const scrolled = await page.evaluate(() => document.querySelector('[data-shelf="attention"] [role="list"]')?.scrollLeft ?? -1);
    if (first !== 'high') fail(`${vp.label} ${where}`, `the first attention card is "${first}", the most urgent should come first`);
    if (scrolled > 1) fail(`${vp.label} ${where}`, `the attention row is scrolled ${Math.round(scrolled)}px: the most urgent card is off to the left`);
    if (cards < 4) fail(`${vp.label} ${where}`, `the attention shelf shows ${cards} cards, expected at least 4`);
    else ok(`${vp.label} ${where}`, `${cards} attention cards, ${await page.locator('[data-row="appointment"]').count()} rows of today's work`);
    if (vp.width < 1280) {
      const small = await page.evaluate(smallTargets, 44);
      if (small.length > 0) fail(`${vp.label} ${where}`, `${small.length} target(s) under 44 px: ${small.slice(0, 6).join(' | ')}`);
    }
    const real = problems.filter((p) => !/mock/.test(p));
    if (real.length > 0) fail(`${vp.label} ${where}`, `errors: ${[...new Set(real)].slice(0, 4).join(' | ')}`);
    await ctx.unrouteAll({ behavior: 'ignoreErrors' });
    await ctx.close();
  }
}

if (POPULATED && SECTIONS.has('populated')) {
  console.log('== populated (mocked answers, private context)');
  await populatedPass();
}

/* ------------------------------ report ------------------------------ */

writeFileSync(join(OUT, 'report.json'), `${JSON.stringify({ ...report, failures, notes }, null, 2)}\n`);
await browser.close();
if (notes.length > 0) console.log(`\nNOTES\n  ${notes.join('\n  ')}`);
console.log(failures.length === 0 ? '\nOK: the shelf system holds in every measured viewport.' : `\n${failures.length} FAILURE(S)`);
process.exit(failures.length === 0 ? 0 : 1);
