/*
 * Real-browser pass over the movement module with the fixtures (no backend needed):
 *
 *     npx vite --config vite.local.config.mts --port 5199 --strictPort     # in another shell
 *     BASE=http://localhost:5199 node scripts/movement-check.mjs
 *     env: OUT_DIR=docs/movement   VP=390x844,820x1180,1440x900   PAGES=review,...   THEME=dark|light
 *
 * Own headless Chromium. The session is seeded in localStorage (token, permissions, the two feature flags) and every
 * /api call is answered by a stub, so nothing real is touched. Per viewport x theme x page it screenshots (JPEG), and
 * asserts: the document never scrolls, nothing overflows sideways, no console / page error, 44 px targets under 1280.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:5199';
const OUT = resolve(root, process.env.OUT_DIR ?? join('docs', 'movement'));
const VPS = (process.env.VP ?? '390x844,820x1180,1440x900').split(',').map((s) => s.split('x').map(Number));
const THEMES = (process.env.THEME ?? 'dark,light').split(',');
const PAGES = {
  review: '/pohyb/klip/fx-dropjump-front',
  running: '/pohyb/klip/fx-running-side',
  upload: '/pohyb/nahrat?patientId=ZZ-test',
  timeline: '/pohyb/pacient/ZZ-test',
  admin: '/pohyb/spravce',
  failed: '/pohyb/klip/fx-qa-rejected',
  home: '/pohyb',
};
const ONLY = (process.env.PAGES ?? 'review,running,upload,timeline,admin,failed,home').split(',');
mkdirSync(OUT, { recursive: true });

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const failures = [];
const fail = (where, what) => { failures.push(`${where}: ${what}`); console.log(`  FAIL ${where}: ${what}`); };
const ok = (where, what) => console.log(`  ok   ${where}: ${what}`);

const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const PERMS = ['patients.view', 'patients.edit', 'movement.view', 'movement.capture', 'movement.review', 'movement.admin', 'exports.download'];

for (const [w, h] of VPS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'cs-CZ', deviceScaleFactor: 1 });
    await ctx.addInitScript(({ theme, perms }) => {
      localStorage.setItem('token', 'stub');
      localStorage.setItem('user', JSON.stringify({ firstName: 'Zkušební', lastName: 'Klinik', role: 'Admin' }));
      localStorage.setItem('permissions', JSON.stringify(perms));
      localStorage.setItem('sm-theme-mode-v2', theme);
      localStorage.setItem('sm-flag:movement', '1');
      localStorage.setItem('sm-flag:movement-mock', '1');
    }, { theme, perms: PERMS });
    await ctx.route((u) => u.pathname.startsWith('/api/'), (route) => {
      const url = route.request().url();
      if (url.includes('/api/v1/account')) return route.fulfill(json({ account: { firstName: 'Zkušební', lastName: 'Klinik', role: 'Admin' }, permissions: PERMS }));
      if (/\/api\/patients\/[^/?]+$/.test(url)) return route.fulfill(json({ id: 'ZZ-test', firstName: 'ZZ', lastName: 'test', fullName: 'ZZ test', dateOfBirth: '1999-01-01', sex: 'M', createdAtUtc: '', updatedAtUtc: '' }));
      return route.fulfill(json([]));
    });
    for (const name of ONLY) {
      const where = `${w}x${h} ${theme} ${name}`;
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|status of 4|net::ERR|negotiation|start the connection/.test(m.text())) errors.push(m.text().slice(0, 700)); });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      await page.goto(`${BASE}${PAGES[name]}`, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForSelector('h1', { timeout: 20000 });
        if (name === 'review' || name === 'running') {
          await page.waitForSelector('[data-testid="overlay-canvas"]', { timeout: 20000 });
          await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2; }, null, { timeout: 20000 }).catch(() => fail(where, 'video did not load'));
          // jump to the first finding, as a click on it does
          await page.locator('[data-flag]').first().click();
          await page.waitForTimeout(700);
        } else {
          await page.waitForTimeout(900);
        }
      } catch (e) {
        fail(where, `did not render: ${String(e).slice(0, 120)}`);
      }
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const bad = [];
        if (innerWidth < 1280) {
          for (const el of document.querySelectorAll('button, a[href], [role="slider"], input, [role="switch"], select, [role="button"]')) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"]')) continue;
            if (el.tagName === 'INPUT' && (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio')) continue;
            if (r.height < 43.5 && r.width < 43.5) bad.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        return {
          docY: Math.max(doc.scrollHeight - innerHeight, document.body.scrollHeight - innerHeight),
          docX: Math.max(doc.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth),
          region: (() => { const r = document.getElementById('fit-region'); return r ? r.scrollHeight - r.clientHeight : -1; })(),
          h1: document.querySelectorAll('h1').length,
          bad,
        };
      });
      if (m.docY > 1) fail(where, `document scrolls by ${m.docY}px`); else ok(where, `document does not scroll (region scrolls ${m.region}px)`);
      if (m.docX > 1) fail(where, `sideways overflow ${m.docX}px`);
      if (m.h1 !== 1) fail(where, `${m.h1} h1`);
      if (m.bad.length) fail(where, `targets under 44 px: ${m.bad.slice(0, 6).join('; ')}`);
      if (errors.length) fail(where, `console: ${errors.slice(0, 3).join(' | ')}`);
      await page.screenshot({ path: join(OUT, `${name}-${w}-${theme}.jpg`), type: 'jpeg', quality: 55 });
      if ((name === 'review') && !process.env.NO_SCROLL) {
        await page.evaluate(() => { const r = document.getElementById('fit-region'); if (r) r.scrollTop = r.scrollHeight * 0.55; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${name}-${w}-${theme}-scrolled.jpg`), type: 'jpeg', quality: 55 });
      }
      await page.close();
    }
    await ctx.unrouteAll();
    await ctx.close();
  }
}
await browser.close();
console.log(failures.length === 0 ? '\nALL OK' : `\n${failures.length} FAILURE(S)`);
process.exit(failures.length === 0 ? 0 : 1);
