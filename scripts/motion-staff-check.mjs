/*
 * The staff application under the motion kit - measured in our own headless Chromium against a running stack
 * (a `vite preview` of a build, or the dev server; /api is proxied to the API on :5092).
 *
 *     node scripts/motion-staff-check.mjs
 *     env: BASE=http://localhost:4300   LABEL=after   OUT=design/motion/staff-after.json
 *          DEV_LOGIN=<file with "E-mail:" / "Password:" lines>    CPU=4 (CPU throttling for the planner timing)
 *          RUNS=5 (planner interaction repeats)                    LAYOUT=1 (also run the three-layout checks)
 *
 * What it measures / asserts
 *   planner      zoom 1x -> 6x with Ctrl + wheel and 40 wheel scrolls of the board, repeated RUNS times: total time,
 *                mean / p95 frame time, frames over 50 ms, long-task time (the median of the runs). Run it against the
 *                build BEFORE the kit and the one after: this is the "planner performance must not regress" number.
 *   layouts      (LAYOUT=1) phone 390x844 / tablet 820x1180 / desktop 1440x900 on /prehled, /patients, /planovani,
 *                /settings: the document never scrolls, no horizontal overflow, no console error, and on /settings the
 *                three motion buttons are at least 44 px high. Needs the kit (the Pohyb setting) - skipped for LABEL=before.
 *   dialog       (LAYOUT=1, kit only) a MUI dialog opened by a click gets the spring pop about the pressed point under 'plné',
 *                the plain fade under 'omezené' and nothing under 'vypnuto'; no transform is left behind once it has opened.
 * Credentials are read from the file and typed into the form; they are never printed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:4300';
const LABEL = process.env.LABEL ?? 'after';
const RUNS = Number(process.env.RUNS ?? 5);
const CPU = Number(process.env.CPU ?? 4);
const LAYOUT = process.env.LAYOUT === '1';
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const failures = [];
const report = { label: LABEL, base: BASE, cpu: CPU, planner: null, layouts: [], dialog: [] };

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Heslo', { exact: true }).fill(PASS);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
}

/* ---------------------------- the planner's timing ---------------------------- */
async function plannerRun(context, page) {
  await page.goto(`${BASE}/planovani`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="board-body"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() => {
    window.__s = { frames: [], tasks: [] };
    let last = performance.now();
    const loop = (t) => { window.__s.frames.push(t - last); last = t; window.__raf = requestAnimationFrame(loop); };
    window.__raf = requestAnimationFrame(loop);
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__s.tasks.push(e.duration); }).observe({ type: 'longtask', buffered: false });
  });
  const box = await page.locator('[data-testid="board-body"]').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  const started = Date.now();
  await page.keyboard.down('Control');
  for (let i = 0; i < 22; i += 1) { await page.mouse.wheel(0, -160); await page.waitForTimeout(30); }
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 140); await page.waitForTimeout(24); }
  for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, -140); await page.waitForTimeout(24); }
  const total = Date.now() - started;
  const s = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__s; });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const frames = s.frames.slice(2).sort((a, b) => a - b);
  return {
    totalMs: total,
    frames: frames.length,
    meanFrameMs: frames.reduce((a, b) => a + b, 0) / frames.length,
    p95FrameMs: frames[Math.floor(frames.length * 0.95)],
    over50: frames.filter((f) => f > 50).length,
    longTaskMs: s.tasks.reduce((a, b) => a + b, 0),
  };
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await signIn(context);
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) runs.push(await plannerRun(context, page));
  const pick = (k) => Number(median(runs.map((r) => r[k])).toFixed(2));
  report.planner = { runs: RUNS, totalMs: pick('totalMs'), frames: pick('frames'), meanFrameMs: pick('meanFrameMs'), p95FrameMs: pick('p95FrameMs'), over50: pick('over50'), longTaskMs: pick('longTaskMs'), samples: runs };
  console.log(`planner (${LABEL}, CPU x${CPU}): total ${report.planner.totalMs} ms, mean frame ${report.planner.meanFrameMs} ms, p95 ${report.planner.p95FrameMs} ms, >50 ms frames ${report.planner.over50}, long tasks ${report.planner.longTaskMs} ms`);
  await context.close();
}

/* ------------------------------ layouts, dialog ------------------------------ */
if (LAYOUT) {
  const VIEWS = [['phone', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]];
  const PAGES = ['/prehled', '/patients', '/planovani', '/settings'];
  for (const [name, width, height] of VIEWS) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: name === 'phone', hasTouch: name !== 'desktop' });
    const page = await signIn(context);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
    for (const path of PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(1600);
      const m = await page.evaluate(() => ({
        docScroll: document.documentElement.scrollHeight - window.innerHeight,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        motion: document.documentElement.dataset.motion,
      }));
      const row = { view: name, path, ...m };
      if (m.docScroll > 1) failures.push(`${name} ${path}: the document scrolls (${m.docScroll}px)`);
      if (m.overflowX > 0) failures.push(`${name} ${path}: horizontal overflow ${m.overflowX}px`);
      if (path === '/settings') {
        const heights = await page.getByRole('group', { name: 'Pohyb v aplikaci' }).getByRole('button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
        row.motionButtons = heights;
        if (heights.length !== 3 || heights.some((h) => h < 44)) failures.push(`${name} /settings: motion buttons ${JSON.stringify(heights)} (need 3 at >= 44 px)`);
        await page.screenshot({ path: resolve(root, 'design', 'motion', `staff-settings-${name}.png`) });
      }
      report.layouts.push(row);
    }
    for (const e of errors) failures.push(`${name}: console error: ${e}`);
    await context.close();
  }

  // The dialog's pop, in the lab (a MUI Dialog opened by a click on a known button), under each state.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const [mode, expectAnimation, expectScale] of [['plné', true, true], ['omezené', false, false], ['vypnuto', false, false]]) {
    await context.addInitScript(`try{localStorage.setItem('sm-motion', ${JSON.stringify(mode)})}catch(e){}`);
    await page.goto(`${BASE}/motion-lab`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const button = page.getByRole('button', { name: 'Otevřít dialog' });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('.MuiDialog-container', { timeout: 5000 });
    const mid = await page.evaluate(() => {
      const c = document.querySelector('.MuiDialog-container');
      const s = getComputedStyle(c);
      return { animationName: s.animationName, origin: s.transformOrigin, transform: s.transform };
    });
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.MuiDialog-container')).transform);
    const popped = mid.animationName === 'sm-pop-in';
    const row = { mode, popped, origin: mid.origin, transformAfter: after };
    report.dialog.push(row);
    if (popped !== expectAnimation) failures.push(`dialog under '${mode}': spring pop ${popped ? 'ran' : 'did not run'}`);
    if (after !== 'none' && after !== 'matrix(1, 0, 0, 1, 0, 0)') failures.push(`dialog under '${mode}': a transform is left behind (${after})`);
    if (expectScale) {
      const [ox, oy] = mid.origin.split(' ').map(parseFloat);
      if (Math.abs(ox - (box.x + box.width / 2)) > 6 || Math.abs(oy - (box.y + box.height / 2)) > 6) failures.push(`dialog under '${mode}': pops about ${mid.origin}, the pressed point was ${Math.round(box.x + box.width / 2)} ${Math.round(box.y + box.height / 2)}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  await context.close();
}
await browser.close();

const out = resolve(root, process.env.OUT ?? `design/motion/staff-${LABEL}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...report, failures }, null, 2));
if (failures.length > 0) {
  console.error('\nFAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('motion-staff-check: ok');
