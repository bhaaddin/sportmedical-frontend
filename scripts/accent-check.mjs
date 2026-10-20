/*
 * Does a click on every colour swatch really recolour the staff app? Run against the dev stack (frontend :3000, API :5092):
 *
 *     node scripts/accent-check.mjs
 *     env: BASE=http://localhost:3000   DEV_LOGIN=<file with "E-mail:" / "Password:" lines>
 *          PLAYWRIGHT_CORE=<folder of playwright-core>   CHROME_PATH=<chrome.exe>   OUT_DIR=design/accent
 *          VP=390x844,1440x900   MODES=dark,light   ONLY=<substring of an accent label>
 *
 * It uses its OWN headless Chromium (never the shared browser pane), signs in once, then for each viewport x mode:
 *   - opens Nastaveni, clicks each of the six swatches (and the Svetly / Tmavy buttons) like a person,
 *   - measures the COMPUTED colour of a contained button, the active menu entry, a keyboard focus ring and - after a
 *     full page load of /planovani - the planner's header panel border and its selected "Tyden" segment,
 *   - saves a screenshot of both pages under design/accent/,
 *   and asserts that
 *     - each of those measurements is different for each of the six accents (a swatch that changes nothing fails),
 *     - the default accent paints the prototype's own colours in dark (nothing changes for people who never choose),
 *     - the planner's `--cyan` in the browser equals what src/accent.ts computes (the CSS and the TypeScript agree),
 *     - the accent survives a reload and does not leak onto the public booking page,
 *     - no document scroll sideways, no console errors, swatches are 44 px.
 * Credentials are read from the file and typed into the form; they are never printed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CYAN, deriveShift, shiftColor } from '../src/accent.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'accent'));
const VIEWPORTS = (process.env.VP ?? '390x844,1440x900').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});
const MODES = (process.env.MODES ?? 'dark,light').split(',');

/* the swatches, in the order of THEME_ACCENTS (src/theme.ts) */
const ACCENTS = [
  { key: 'forest', label: 'Lesní zelená', color: '#0D5C52' },
  { key: 'slate', label: 'Břidlicová', color: '#2B3440' },
  { key: 'teal', label: 'Tyrkysová', color: '#0D9488' },
  { key: 'blue', label: 'Modrá', color: '#2563EB' },
  { key: 'purple', label: 'Fialová', color: '#7C3AED' },
  { key: 'orange', label: 'Oranžová', color: '#EA580C' },
].filter((a) => (process.env.ONLY ? a.label.includes(process.env.ONLY) : true));

/* ------------------------------ environment ------------------------------ */

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

/* ------------------------------ measuring ------------------------------ */

const failures = [];
const rows = [];
const fail = (where, what) => {
  failures.push(`${where}: ${what}`);
  console.log(`  FAIL ${where}: ${what}`);
};

/** What the browser computes for the pieces of the look that the swatches must change. Runs inside the page. */
function measureSettings() {
  const px = (el, p) => (el ? getComputedStyle(el)[p] : null);
  const contained = [...document.querySelectorAll('button')].find((b) => /Mui(Button)?-contained|MuiButton-contained/.test(b.className) && /Světlý|Tmavý/.test(b.textContent ?? ''));
  const focused = document.activeElement;
  return {
    button: contained ? `${px(contained, 'backgroundImage')} | ${px(contained, 'backgroundColor')} | ${px(contained, 'borderTopColor')}` : null,
    focus: focused && focused.matches(':focus-visible') ? `${px(focused, 'outlineColor')} | ${px(focused, 'outlineStyle')} | ${px(focused, 'outlineWidth')} | ${px(focused, 'boxShadow')}` : null,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  };
}

/** The staff navigation's active entry (sidebar on the desktop, bottom bar on the phone). Runs inside the page. */
function measureMenu() {
  const active = document.querySelector('a[aria-current="page"]');
  if (!active) return null;
  const s = getComputedStyle(active);
  return { menu: `${s.color} | ${s.backgroundColor} | ${s.boxShadow} | ${s.borderLeftColor}` };
}

/** The planner: its header panel's lit border, its selected segment, and `var(--cyan)` read as a colour. */
function measurePlanner() {
  const stage = document.querySelector('.sm-planner');
  if (!stage) return null;
  const panel = stage.querySelector('.glass-panel');
  const segment = [...stage.querySelectorAll('button')].find((b) => /^(Týden|Týd)$/.test((b.textContent ?? '').trim()) && /is-active|active|selected/.test(b.className)) ?? stage.querySelector('button.is-active, .view-tab.active, [aria-pressed="true"]');
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;width:1px;height:1px;color:var(--cyan)';
  stage.appendChild(probe);
  const cyan = getComputedStyle(probe).color;
  probe.remove();
  return {
    header: panel ? `${getComputedStyle(panel).borderTopColor} | ${getComputedStyle(panel).boxShadow}` : null,
    segment: segment ? `${getComputedStyle(segment).backgroundImage} | ${getComputedStyle(segment).backgroundColor} | ${getComputedStyle(segment).borderTopColor}` : null,
    cyan,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  };
}

/** "color(srgb 0 0.9 0.89)" / "rgb(0, 230, 228)" -> [0..255, 0..255, 0..255] */
function channels(css) {
  const m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(css);
  if (m) return [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
  const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return r ? [r[1], r[2], r[3]].map(Number) : null;
}
const hexChannels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/* ------------------------------ run ------------------------------ */

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
mkdirSync(OUT, { recursive: true });
const STATE = join(tmpdir(), `sm-accent-check-${process.pid}.json`);

const signIn = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
{
  const page = await signIn.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 });
  await page.waitForTimeout(1500);
  await signIn.storageState({ path: STATE });
  await signIn.close();
}

for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    const where = `${vp.label} ${mode}`;
    console.log(`== ${where}`);
    const ctx = await browser.newContext({ storageState: STATE, viewport: { width: vp.width, height: vp.height }, locale: 'cs-CZ' });
    /* start from a clean look: the default accent, the mode under test */
    await ctx.addInitScript(([m]) => {
      if (!sessionStorage.getItem('__accent_check_seeded')) {
        localStorage.removeItem('sm-theme-accent');
        localStorage.setItem('sm-theme-mode-v2', m);
        sessionStorage.setItem('__accent_check_seeded', '1');
      }
    }, [mode]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/favicon|Failed to load resource/.test(msg.text())) errors.push(`console ${msg.text()}`); });

    const seen = { settings: {}, planner: {} };
    for (const accent of ACCENTS) {
      /* --- Nastaveni: click like a person --- */
      await page.goto(`${BASE}/settings`);
      await page.waitForSelector('#main-content', { timeout: 20000 });
      const swatch = page.getByRole('button', { name: accent.label, exact: true });
      await swatch.scrollIntoViewIfNeeded();
      const box = await swatch.boundingBox();
      if (!box || box.width < 43.5 || box.height < 43.5) fail(where, `swatch "${accent.label}" is ${box?.width}x${box?.height}, not 44 px`);
      await swatch.click();
      await page.waitForTimeout(250);
      if ((await swatch.getAttribute('aria-pressed')) !== 'true') fail(where, `swatch "${accent.label}" is not pressed after the click`);
      const stored = await page.evaluate(() => localStorage.getItem('sm-theme-accent'));
      if (stored !== accent.color) fail(where, `stored accent after clicking "${accent.label}" is ${stored}`);
      /* the keyboard focus ring: Tab away and back so :focus-visible applies */
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const measured = await page.evaluate(measureSettings);
      await page.screenshot({ path: join(OUT, `${vp.label}-${mode}-${accent.key}-settings.jpg`), type: 'jpeg', quality: 72 });
      /* --- the active menu entry, on a page where one is lit --- */
      await page.goto(`${BASE}/patients`);
      await page.waitForSelector('#main-content', { timeout: 20000 });
      await page.waitForTimeout(600);
      Object.assign(measured, (await page.evaluate(measureMenu)) ?? {});
      seen.settings[accent.key] = measured;
      if (measured.overflow > 0) fail(where, `${accent.label}: the settings page scrolls sideways by ${measured.overflow}px`);

      /* --- Planovani: a full page load, the accent comes from storage --- */
      await page.goto(`${BASE}/planovani`);
      await page.waitForSelector('.sm-planner', { timeout: 30000 });
      await page.waitForTimeout(1800);
      const planner = await page.evaluate(measurePlanner);
      await page.screenshot({ path: join(OUT, `${vp.label}-${mode}-${accent.key}-planner.jpg`), type: 'jpeg', quality: 72 });
      seen.planner[accent.key] = planner;

      /* --- the CSS and the TypeScript agree on --cyan --- */
      if (planner?.cyan) {
        const got = channels(planner.cyan);
        const want = hexChannels(shiftColor(CYAN, deriveShift(accent.color)));
        const off = got ? Math.max(...got.map((v, i) => Math.abs(v - want[i]))) : 999;
        if (off > 2) fail(where, `${accent.label}: the planner's --cyan is ${got} in the browser but src/accent.ts says ${want}`);
      } else fail(where, `${accent.label}: could not read the planner's --cyan`);
      if (planner && planner.overflow > 0) fail(where, `${accent.label}: the planner scrolls sideways by ${planner.overflow}px`);
    }

    /* --- every measurement differs between the six accents --- */
    for (const [page_, keys] of [['settings', ['button', 'menu', 'focus']], ['planner', ['header', 'segment', 'cyan']]]) {
      for (const key of keys) {
        const values = ACCENTS.map((a) => seen[page_][a.key]?.[key] ?? null);
        if (values.some((v) => v === null)) {
          fail(where, `${page_}.${key}: not measurable for ${ACCENTS.filter((a, i) => values[i] === null).map((a) => a.label).join(', ')}`);
          continue;
        }
        const distinct = new Set(values).size;
        rows.push({ where, what: `${page_}.${key}`, distinct, of: ACCENTS.length });
        if (distinct !== ACCENTS.length) fail(where, `${page_}.${key} has only ${distinct} different values for ${ACCENTS.length} accents`);
      }
    }

    /* --- the default paints the prototype in dark --- */
    if (mode === 'dark' && seen.planner.forest) {
      const header = channels((seen.planner.forest.header ?? '').split(' | ')[0]);
      /* the stage's own border is the prototype's rgba(0,223,227,.79); the compact (phone/tablet) layout's is rgba(0,224,232,.7) */
      if (!header || !['0,223,227', '0,224,232'].includes(header.join())) fail(where, `default accent: the planner header border is ${header}, not the prototype's 0,223,227 / 0,224,232`);
      const ch = channels(seen.planner.forest.cyan);
      if (!ch || ch.join() !== '0,230,228') fail(where, `default accent: --cyan is ${ch}, not 0,230,228`);
    }

    /* --- reload keeps the choice; the public booking page never sees it --- */
    const last = ACCENTS[ACCENTS.length - 1];
    await page.goto(`${BASE}/settings`);
    await page.waitForSelector('#main-content');
    await page.reload();
    await page.waitForSelector('#main-content');
    const pressed = await page.getByRole('button', { name: last.label, exact: true }).getAttribute('aria-pressed');
    if (pressed !== 'true') fail(where, `after a reload "${last.label}" is no longer the chosen swatch`);
    await page.goto(`${BASE}/objednat`);
    await page.waitForTimeout(1200);
    const leaked = await page.evaluate(() => ['--sm-hsl', '--sm-accent', '--sm-tint-hover'].filter((n) => document.documentElement.style.getPropertyValue(n) !== ''));
    if (leaked.length > 0) fail(where, `the public booking page carries the staff accent: ${leaked.join(', ')}`);

    if (errors.length > 0) fail(where, `console/page errors: ${[...new Set(errors)].slice(0, 3).join(' || ')}`);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, 'accent-check.json'), JSON.stringify({ at: new Date().toISOString(), rows, failures }, null, 1));
console.log('\nmeasurement                         distinct values / accents');
for (const r of rows) console.log(`${r.where.padEnd(14)} ${r.what.padEnd(18)} ${r.distinct}/${r.of}`);
console.log(failures.length === 0 ? '\nOK: every swatch changes every measured thing, in every mode and viewport.' : `\n${failures.length} FAILURE(S)`);
process.exit(failures.length === 0 ? 0 : 1);
