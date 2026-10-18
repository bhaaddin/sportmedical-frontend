/*
 * Geometry audit of the planner's tablet / phone layouts in a real Chromium (jsdom has no layout engine).
 *
 *   PLAYWRIGHT_CORE=<path to playwright-core/index.js> CHROME=<chrome.exe> node scripts/planner-compact-audit.mjs
 *
 * Needs the dev stack (frontend :3000, API :5092) and the dev login in `.dev-login.txt` (override: DEV_LOGIN).
 * For each viewport (390 / 834 / 1024) and each state (closed, calendar sheet open, header expanded, day list, month,
 * summary) on `/planner-lab` and `/planovani` it reports: horizontal overflow, and every visible interactive control
 * smaller than 44 x 44 px. Exit code 1 when anything is found.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE ?? 'playwright-core/index.js').href);
const chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://localhost:3000';
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const email = /E-mail:\s*(\S+)/.exec(login)[1];
const pass = /Password:\s*(\S+)/.exec(login)[1];

const VIEWPORTS = [[390, 844], [834, 1112], [1024, 768]];
const PAGES = [
  ['/planner-lab?today=2026-11-10', 'lab (club, demo data)'],
  ['/planovani', 'standard calendar (dev API)'],
];
const STATES = [
  ['closed', []],
  ['header open', ['click:[data-testid=compact-header-toggle]']],
  ['calendar sheet', ['click:[data-testid=compact-calendar-button]', 'wait:500']],
  ['day list', ['click:[data-view=day]', 'wait:300']],
  ['month', ['click:[data-view=month]', 'wait:300']],
  ['summary', ['click:[data-testid=compact-summary-button]', 'wait:600']],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
let failures = 0;
for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 1280, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', pass);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  for (const [url, label] of PAGES) {
    for (const [state, steps] of STATES) {
      /* a dev server that is hot-reloading under someone's hands shows its error page once in a while: try again */
      for (let attempt = 0; ; attempt++) {
        await page.goto(BASE + url);
        try {
          await page.waitForSelector('#day-board', { timeout: 15000 });
          break;
        } catch (error) {
          if (attempt >= 2) throw error;
        }
      }
      await page.waitForTimeout(1500);
      let skipped = false;
      for (const st of steps) {
        const i = st.indexOf(':'); const k = st.slice(0, i), v = st.slice(i + 1);
        try {
          if (k === 'click') await page.locator(v).first().click({ timeout: 2500 });
          else if (k === 'wait') await page.waitForTimeout(Number(v));
        } catch { skipped = true; }
      }
      if (skipped) { console.log(`${w}  ${label}  [${state}]  (not available here)`); continue; }
      const res = await page.evaluate(() => {
        const root = document.querySelector('.sm-planner');
        const out = { win: innerWidth, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, rootRight: root ? Math.round(root.getBoundingClientRect().right) : null, small: [], wide: [] };
        const sel = 'button,a[href],select,input:not([type=hidden]),textarea,[role=button],[role=tab],[tabindex="0"],summary';
        const visible = (el) => {
          if (!el.getClientRects().length) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || cs.pointerEvents === 'none') return false;
          if (el.closest('[inert],[hidden],.sr-only,.svg-sprite')) return false;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // off the visible window on the main axis (inside a horizontal scroller / below the fold is fine, but fully left/right offscreen is not tappable now)
          if (r.right < 0 || r.left > innerWidth) return false;
          return true;
        };
        const describe = (el) => {
          const r = el.getBoundingClientRect();
          const cls = (el.className && el.className.baseVal === undefined ? String(el.className) : '').trim().split(/\s+/).slice(0, 3).join('.');
          return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}"`;
        };
        const scopes = [...document.querySelectorAll('.sm-planner, [role=dialog], .MuiPopover-root, .MuiDrawer-root')];
        const seen = new Set();
        for (const scope of scopes) {
          for (const el of scope.querySelectorAll(sel)) {
            if (seen.has(el) || !visible(el)) continue;
            seen.add(el);
            if (el.closest('.schedule-event, .board-window, .board-chip, .term-resize-handle')) continue; // board cards: sized by time, not by a target rule
            if (el.type === 'checkbox' || el.type === 'radio') { const lab = el.closest('label'); if (lab) { const lr = lab.getBoundingClientRect(); if (lr.height >= 44 || lr.width >= 44 && lr.height >= 36) continue; } }
            const r = el.getBoundingClientRect();
            if (r.height < 43.5 || r.width < 43.5) {
              // a control whose width is long but height short still fails: the rule is min 44 on both axes unless it spans a full row
              out.small.push(describe(el));
            }
          }
        }
        for (const el of root ? root.querySelectorAll('*') : []) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.right > innerWidth + 1 && !el.closest('#board-body, .adaptive-card-viewport, .compact-days, .agenda-chips, .s41-flow, .adaptive-card-track, .day-board')) out.wide.push(describe(el) + ' right=' + Math.round(r.right));
        }
        out.wide = out.wide.slice(0, 12);
        return out;
      });
            const bad = res.docW > res.win + 1 || res.small.length > 0 || res.wide.length > 0;
            if (bad) failures++;
            console.log(`${w}  ${label}  [${state}]  ${bad ? 'FAIL' : 'ok'}${res.docW > res.win + 1 ? `  horizontal scroll ${res.docW} > ${res.win}` : ''}`);
            for (const s of res.small) console.log('     small: ' + s);
            for (const s of res.wide) console.log('     wide:  ' + s);
          }
        }
        await ctx.close();
      }
      await browser.close();
      process.exit(failures ? 1 : 0);
