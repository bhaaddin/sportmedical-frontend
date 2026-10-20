/*
 * The standard calendar's slim top bar in a real browser. Run against the dev stack (frontend :3000, API :5092):
 *
 *     node scripts/slim-header-check.mjs
 *     env: BASE=http://localhost:3000   DEV_LOGIN=<file with "E-mail:" / "Password:" lines>
 *          PLAYWRIGHT_CORE=<folder of playwright-core>   CHROME_PATH=<chrome.exe>
 *          OUT_DIR=design/slim-header   PREFIX=<file name prefix, e.g. "before-">   VP=390x844,820x1180,...
 *
 * It uses its OWN headless Chromium (never the shared browser pane), signs in once and, per viewport:
 *   - opens /planovani and saves a screenshot,
 *   - measures the document (no scroll in either direction), the bar, the sidebar and the board (top, bottom, gaps in the
 *     stage's logical pixels on the desktop, client px elsewhere), the 44 px targets of the touch layouts,
 *   - checks that none of the removed pieces is on the page (logo slot, KLINIKA tag, Nastaveni firmy, IČO / DIČ / Adresa ...),
 *   - clicks the bell and the profile chip and checks that their dialogs open,
 *   - changes the accent swatch and checks that the bar's border colour follows.
 * Credentials are read from the file and typed into the form; they are never printed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'slim-header'));
const PREFIX = process.env.PREFIX ?? '';
const VIEWPORTS = (process.env.VP ?? '390x844,820x1180,1280x720,1440x900,1920x1080,2560x1440').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright', 'C:/Users/Matko/Jarvis-WorkOS/frontend/node_modules/playwright-core'].filter(Boolean);
  for (const c of candidates) {
    try {
      const spec = c.includes('/') || c.includes('\\') ? pathToFileURL(join(resolve(c), 'index.js')).href : c;
      const mod = await import(spec);
      const pw = mod.default ?? mod;
      if (pw.chromium) return pw;
    } catch { /* next */ }
  }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE=<path to the playwright-core folder>.');
}

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const p = join(base, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found. Set CHROME_PATH.');
}

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];

const failures = [];
const fail = (where, what) => {
  failures.push(`${where}: ${what}`);
  console.log(`  FAIL ${where}: ${what}`);
};

/** Everything measured inside the page. Distances are in the stage's logical px (client px / scale). */
function measure() {
  const root = document.querySelector('.sm-planner');
  const q = (s) => document.querySelector(s);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  };
  const layout = root?.getAttribute('data-layout');
  const scale = layout === 'desktop' ? Number(root.getAttribute('data-scale')) || 1 : 1;
  const frame = rect(q('#screen-frame'));
  const host = rect(root);
  const header = rect(q('#club-unified-header'));
  const sidebar = rect(q('#live-ui .sidebar, #live-ui .compact-sidebar'));
  const planner = rect(q('.planner'));
  const boardBody = rect(q('.board-body'));
  const hourLabels = document.querySelectorAll('.hour-label').length;
  const mainContent = q('#main-content');
  const touch = [...document.querySelectorAll('#club-unified-header button')].map((b) => {
    const r = b.getBoundingClientRect();
    return { id: b.getAttribute('aria-label') ?? b.id, w: Math.round(r.width), h: Math.round(r.height) };
  });
  const text = q('#club-unified-header')?.innerText ?? '';
  const removed = ['KLINIKA', 'Nastavení firmy', 'IDENTIFIKAČNÍ', 'VEDENÍ KLINIKY', 'KONTAKTNÍ OSOBA', 'IČO', 'DIČ', 'Adresa'].filter((t) => document.body.innerText.includes(t) && (q('#club-unified-header')?.innerText ?? '').includes(t));
  return {
    layout,
    scale,
    stage: { w: Number(root?.getAttribute('data-stage-w')), h: Number(root?.getAttribute('data-stage-h')) },
    docScrollY: document.documentElement.scrollHeight - window.innerHeight,
    docScrollX: document.documentElement.scrollWidth - window.innerWidth,
    bodyScrollY: document.body.scrollHeight - window.innerHeight,
    mainScrollY: mainContent ? mainContent.scrollHeight - mainContent.clientHeight : null,
    hostScrollY: root ? root.scrollHeight - root.clientHeight : null,
    frame,
    host,
    header,
    sidebar,
    planner,
    boardBody,
    hourLabels,
    touch,
    headerText: text.replace(/\s+/g, ' ').trim(),
    removed,
    logoSlot: !!q('#club-logo-slot'),
    detailsStrip: !!q('#club-details-strip'),
    toggle: !!q('[data-testid="compact-header-toggle"]'),
    headerBorder: header ? getComputedStyle(q('#club-unified-header')).borderTopColor : null,
    headerRadius: header ? getComputedStyle(q('#club-unified-header')).borderTopLeftRadius : null,
  };
}

const px = (n) => `${Math.round(n * 10) / 10}`;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
mkdirSync(OUT, { recursive: true });
const STATE = join(tmpdir(), `sm-slim-header-${process.pid}.json`);

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 });
  await page.waitForTimeout(1500);
  await ctx.storageState({ path: STATE });
  await ctx.close();
}

const report = [];
for (const vp of VIEWPORTS) {
  const where = vp.label;
  console.log(`== ${where}`);
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: vp.width, height: vp.height }, locale: 'cs-CZ', hasTouch: vp.width < 1280 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error' && !/favicon|Failed to load resource/.test(msg.text())) errors.push(`console ${msg.text()}`); });
  await page.goto(`${BASE}/planovani`);
  await page.waitForSelector('#club-unified-header', { timeout: 30000 });
  await page.waitForTimeout(2200);
  const m = await page.evaluate(measure);
  await page.screenshot({ path: join(OUT, `${PREFIX}${vp.label}-planovani.png`) });

  const s = m.scale || 1;
  const L = (n) => (n === null || n === undefined ? null : n / s);
  const row = {
    vp: vp.label,
    layout: m.layout,
    stage: m.layout === 'desktop' ? `${px(m.stage.w)}x${px(m.stage.h)} @${px(s * 1000) / 1000}` : '-',
    header: m.header ? `top ${px(L(m.header.t - m.frame.t))} h ${px(L(m.header.h))} w ${px(L(m.header.w))}` : 'none',
    sidebar: m.sidebar ? `top ${px(L(m.sidebar.t - m.frame.t))} h ${px(L(m.sidebar.h))}` : 'none',
    board: m.planner ? `top ${px(L(m.planner.t - m.frame.t))} h ${px(L(m.planner.h))}` : 'none',
    boardBody: m.boardBody ? `h ${px(L(m.boardBody.h))}` : 'none',
    gapSidebar: m.header && m.sidebar ? px(L(m.sidebar.t - m.header.b)) : null,
    gapBoard: m.header && m.planner ? px(L(m.planner.t - m.header.b)) : null,
    bottomSidebar: m.sidebar && m.frame ? px(L(m.frame.b - m.sidebar.b)) : null,
    bottomBoard: m.planner && m.frame ? px(L(m.frame.b - m.planner.b)) : null,
    rightHeader: m.header && m.frame ? px(L(m.frame.r - m.header.r)) : null,
    leftHeader: m.header && m.frame ? px(L(m.header.l - m.frame.l)) : null,
    scroll: `doc ${m.docScrollY}/${m.docScrollX} main ${m.mainScrollY} host ${m.hostScrollY}`,
    hours: m.hourLabels,
    removed: m.removed.join(',') || 'none',
    logo: m.logoSlot,
    strip: m.detailsStrip,
    toggle: m.toggle,
    text: m.headerText,
    touch: m.touch.map((t) => `${t.w}x${t.h}`).join(' '),
  };
  report.push(row);
  console.log(JSON.stringify(row, null, 1));

  if (m.docScrollY > 0 || m.bodyScrollY > 0) fail(where, `the document scrolls vertically (${m.docScrollY}px)`);
  if (m.docScrollX > 0) fail(where, `the document scrolls sideways (${m.docScrollX}px)`);
  if (process.env.EXPECT === 'slim') {
    if (m.removed.length > 0 || m.logoSlot || m.detailsStrip || m.toggle) fail(where, `removed pieces are still there: ${m.removed.join(',')} logo=${m.logoSlot} strip=${m.detailsStrip} toggle=${m.toggle}`);
    if (m.layout === 'desktop') {
      const h = L(m.header.h);
      if (h < 46 || h > 54) fail(where, `the bar is ${px(h)} logical px tall, not 48-52`);
      for (const [name, g] of [['sidebar', row.gapSidebar], ['board', row.gapBoard]]) {
        if (Math.abs(Number(g) - 7) > 0.6) fail(where, `${name} starts ${g} logical px under the bar, not 7`);
      }
      for (const [name, g] of [['sidebar', row.bottomSidebar], ['board', row.bottomBoard]]) {
        if (Math.abs(Number(g) - 35) > 1.5 && Math.abs(Number(g) - 36) > 1.5) fail(where, `${name} ends ${g} logical px above the frame's bottom (file: 35/36)`);
      }
      if (Math.abs(Number(row.rightHeader) - 48) > 1 || Math.abs(Number(row.leftHeader) - 25) > 1) fail(where, `the bar sits ${row.leftHeader} from the left / ${row.rightHeader} from the right, not 25 / 48`);
    } else {
      for (const t of m.touch) if (t.w < 43.5 || t.h < 43.5) fail(where, `touch target "${t.id}" is ${t.w}x${t.h}, not 44 px`);
      if (m.header.h > 60) fail(where, `the bar is ${px(m.header.h)} px tall on a touch layout`);
    }
  }

  /* the bell and the profile chip open their dialogs */
  if (process.env.EXPECT === 'slim') {
    await page.click('.club-user-bell');
    await page.waitForTimeout(600);
    const bellOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"], .modal-card, #dialog-layer [data-dialog], #dialog-layer > *'));
    await page.screenshot({ path: join(OUT, `${PREFIX}${vp.label}-bell.png`) });
    if (!bellOpen) fail(where, 'the bell opened nothing');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.click('.club-user-chip');
    await page.waitForTimeout(600);
    const chipOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"], .modal-card, #dialog-layer [data-dialog], #dialog-layer > *'));
    if (!chipOpen) fail(where, 'the profile chip opened nothing');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  /* the accent follows */
  const before = m.headerBorder;
  await page.evaluate(() => localStorage.setItem('sm-theme-accent', '#EA580C'));
  await page.reload();
  await page.waitForSelector('#club-unified-header', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => getComputedStyle(document.querySelector('#club-unified-header')).borderTopColor);
  await page.screenshot({ path: join(OUT, `${PREFIX}${vp.label}-planovani-orange.png`) });
  console.log(`  accent border: ${before} -> ${after}`);
  if (before === after) fail(where, 'the bar did not change colour with the accent');
  await page.evaluate(() => localStorage.removeItem('sm-theme-accent'));

  if (errors.length > 0) fail(where, `console/page errors: ${[...new Set(errors)].slice(0, 3).join(' || ')}`);
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, `${PREFIX}report.json`), JSON.stringify({ at: new Date().toISOString(), report, failures }, null, 1));
console.log(failures.length === 0 ? '\nOK' : `\n${failures.length} FAILURE(S)`);
process.exit(failures.length === 0 ? 0 : 1);
