/*
 * Nastavení / Administrace in a real browser (own headless Chromium, the API MOCKED in a private context - nothing is written,
 * no sign-in file is read):
 *
 *     node scripts/settings-split-check.mjs
 *     env: BASE=http://localhost:3197   OUT_DIR=design/settings-split   VP=390x844,820x1180,1440x900
 *          PLAYWRIGHT_CORE=<folder>   CHROME_PATH=<chrome.exe>
 *
 * For an administrator and for a receptionist, in light and dark, it photographs /nastaveni (closed and with "Další
 * nastavení" open), /administrace, the Bezpečnostní pravidla screen, Můj účet a zabezpečení (sessions), and the gate in front
 * of the Administrace (reconfirm up front, the two-factor notice, the idle lock). It asserts, per page:
 *   - the document never scrolls (#fit-region is the one scroller) and nothing overflows sideways,
 *   - one h1, no page error,
 *   - 44 px touch targets in the main area under 1280,
 *   - the receptionist's /administrace is the ordinary "no access" and says nothing about the Administrace anywhere.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3197';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'settings-split'));
const VIEWPORTS = (process.env.VP ?? '390x844,820x1180,1440x900').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});
mkdirSync(OUT, { recursive: true });

const ADMIN = ['patients.view', 'patients.register', 'patients.edit', 'settings.clinic.manage', 'users.manage', 'roles.manage', 'bookings.create', 'bookings.edit', 'bookings.cancel', 'questionnaires.manage', 'communication.manage', 'billing.manage'];
const RECEPTION = ['patients.view', 'patients.register', 'patients.edit', 'bookings.create', 'bookings.edit', 'bookings.cancel'];
const POLICY_OFF = { reconfirmForAdmin: false, reconfirmMinutes: 15, requireTwoFactorForAdmins: false, adminIdleLock: false, adminIdleLockMinutes: 10 };
const SESSIONS = [
  { id: 's1', createdAt: '2026-11-01T07:50:00Z', lastSeenAt: '2026-11-01T09:30:00Z', device: 'Chrome · Windows', current: true },
  { id: 's2', createdAt: '2026-10-30T08:00:00Z', lastSeenAt: '2026-10-31T17:12:00Z', device: 'Safari · iPhone', current: false },
  { id: 's3', createdAt: '2026-10-28T08:00:00Z', lastSeenAt: null, device: null, current: false },
];

const failures = [];
const fail = (where, what) => { failures.push(`${where}: ${what}`); console.log(`  FAIL ${where}: ${what}`); };

/** The API of one scenario: what the page asks, answered from here. */
function api({ permissions, policy = POLICY_OFF, reconfirm = { confirmedAt: null, validUntil: null }, twoFactorRequired = false }) {
  return (url, method) => {
    const path = new URL(url).pathname;
    if (method === 'GET') {
      if (path === '/api/v1/account') return { account: { firstName: 'Jana', lastName: 'Nová', email: 'jana@example.invalid', role: 'Owner' }, permissions };
      if (path === '/api/v1/settings/security-policy') return policy;
      if (path === '/api/v1/session/reconfirm') return reconfirm;
      if (path === '/api/v1/account/sessions') return SESSIONS;
      if (path === '/api/v1/account/two-factor') return { enabled: false, setupPending: false };
      if (path === '/api/system/security/lights') {
        if (twoFactorRequired) return { __status: 403, code: 'two_factor_required' };
        return { backups: 'amber', accounts: 'green', environment: 'green', activity: 'green', overall: 'amber' };
      }
      if (path === '/api/v1/settings/changes') return { items: [], total: 0 };
    }
    return { __status: 404 };
  };
}

async function newPage(browser, vp, theme, permissions, answer) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  await context.addInitScript(({ theme: mode, permissions: held }) => {
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'jana@example.invalid', role: 'Owner' }));
    localStorage.setItem('permissions', JSON.stringify(held));
    localStorage.setItem('sm-theme-mode-v2', mode);
  }, { theme, permissions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const body = answer(req.url(), req.method());
    const status = body && body.__status ? body.__status : 200;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? body : { code: body.code }) });
  });
  return { context, page, errors };
}

async function audit(page, where, vp, expectations = {}) {
  const m = await page.evaluate((narrow) => {
    const doc = document.documentElement;
    const region = document.getElementById('fit-region');
    const small = [];
    if (narrow) {
      for (const el of document.querySelectorAll('main a[href], main button, main [role="switch"], main input:not([type="hidden"])')) {
        /* A switch or checkbox is pressed through its label: that is the target. */
        const r = (el.closest('label') ?? el).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.getAttribute('aria-hidden') === 'true') continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden') continue;
        if (r.height < 43.5 && !(el instanceof HTMLInputElement && el.type === 'checkbox')) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.height)}px`);
      }
    }
    return {
      docScrolls: doc.scrollHeight > window.innerHeight + 1,
      overflowX: doc.scrollWidth > window.innerWidth + 1 || (region ? region.scrollWidth > region.clientWidth + 1 : false),
      h1: document.querySelectorAll('main h1').length,
      small,
    };
  }, vp.width < 1280);
  if (m.docScrolls) fail(where, 'the document scrolls');
  if (m.overflowX) fail(where, 'something overflows sideways');
  if (expectations.h1 !== undefined && m.h1 !== expectations.h1) fail(where, `${m.h1} h1 (expected ${expectations.h1})`);
  if (m.small.length > 0) fail(where, `targets under 44px: ${m.small.slice(0, 4).join('; ')}`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 50 });
}

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, executablePath: findChrome() });

try {
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      const tag = `${vp.width}-${theme}`;
      console.log(`\n${tag}`);

      /* ── an administrator ── */
      {
        const { context, page, errors } = await newPage(browser, vp, theme, ADMIN, api({ permissions: ADMIN }));
        await page.goto(`${BASE}/nastaveni`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1, name: 'Nastavení' }).waitFor();
        await audit(page, `${tag} admin /nastaveni`, vp, { h1: 1 });
        const headings = await page.locator('main h2').allTextContents();
        if (headings.join('|') !== 'Provoz|Služby a ceny|Komunikace a dokumenty|Kluby') fail(`${tag} /nastaveni`, `headings were ${headings.join('|')}`);
        await shot(page, `${tag}-nastaveni`);

        await page.getByRole('button', { name: /Další nastavení/ }).click();
        await audit(page, `${tag} admin /nastaveni (more)`, vp);
        if (theme === 'light') {
          await page.locator('#more-panel').scrollIntoViewIfNeeded();
          await shot(page, `${tag}-nastaveni-dalsi`);
        }

        await page.goto(`${BASE}/administrace`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1, name: 'Administrace' }).waitFor();
        await audit(page, `${tag} admin /administrace`, vp, { h1: 1 });
        await shot(page, `${tag}-administrace`);

        await page.goto(`${BASE}/nastaveni/bezpecnostni-pravidla`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1, name: 'Bezpečnostní pravidla' }).waitFor();
        await page.getByRole('switch', { name: /Při vstupu do Administrace/ }).click();
        await audit(page, `${tag} admin /bezpecnostni-pravidla`, vp, { h1: 1 });
        await shot(page, `${tag}-bezpecnostni-pravidla`);

        if (theme === 'light') {
          await page.goto(`${BASE}/nastaveni/zabezpeceni`, { waitUntil: 'networkidle' });
          await page.getByRole('heading', { level: 1, name: 'Můj účet a zabezpečení' }).waitFor();
          await page.getByRole('list', { name: 'Přihlášená zařízení' }).waitFor();
          await audit(page, `${tag} /zabezpeceni`, vp, { h1: 1 });
          await page.getByRole('list', { name: 'Přihlášená zařízení' }).scrollIntoViewIfNeeded();
          await shot(page, `${tag}-moje-relace`);

          /* The old addresses. */
          await page.goto(`${BASE}/settings/system`, { waitUntil: 'networkidle' });
          await page.waitForURL((u) => u.pathname === '/administrace', { timeout: 10000 }).catch(() => fail(tag, '/settings/system went to ' + page.url()));
          await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
          await page.waitForURL((u) => u.pathname === '/nastaveni', { timeout: 10000 }).catch(() => fail(tag, '/settings went to ' + page.url()));
          await page.goto(`${BASE}/settings/dokumenty`, { waitUntil: 'networkidle' });
          await page.waitForURL((u) => u.pathname === '/nastaveni', { timeout: 10000 }).catch(() => fail(tag, '/settings/dokumenty went to ' + page.url()));
        }
        if (errors.length) fail(`${tag} admin`, `page errors: ${errors.slice(0, 2).join(' | ')}`);
        await context.close();
      }

      /* ── the gate in front of the Administrace ── */
      {
        const { context, page, errors } = await newPage(browser, vp, theme, ADMIN, api({ permissions: ADMIN, policy: { ...POLICY_OFF, reconfirmForAdmin: true } }));
        await page.goto(`${BASE}/administrace`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Potvrďte, že jste to vy' }).waitFor();
        await audit(page, `${tag} gate reconfirm`, vp);
        await shot(page, `${tag}-brana-potvrzeni`);
        await page.getByRole('button', { name: 'Potvrdit' }).click();
        await page.getByRole('dialog').waitFor();
        await page.waitForTimeout(250);
        await shot(page, `${tag}-okno-potvrzeni`);
        if (errors.length) fail(`${tag} gate`, `page errors: ${errors.slice(0, 2).join(' | ')}`);
        await context.close();
      }
      if (theme === 'light') {
        const { context, page } = await newPage(browser, vp, theme, ADMIN, api({ permissions: ADMIN, twoFactorRequired: true }));
        await page.goto(`${BASE}/administrace`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Pro administraci zapněte dvoufázové ověření' }).waitFor();
        await audit(page, `${tag} gate two-factor`, vp);
        await shot(page, `${tag}-brana-2fa`);
        await context.close();
      }

      /* ── a receptionist ── */
      {
        const { context, page, errors } = await newPage(browser, vp, theme, RECEPTION, api({ permissions: RECEPTION }));
        await page.goto(`${BASE}/nastaveni`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1, name: 'Nastavení' }).waitFor();
        await audit(page, `${tag} reception /nastaveni`, vp, { h1: 1 });
        const text = await page.locator('body').innerText();
        if (/Administrace/i.test(text)) fail(`${tag} reception`, 'the word "Administrace" is on the page');
        if (await page.getByRole('link', { name: /Administrace/ }).count()) fail(`${tag} reception`, 'a link to the Administrace is offered');
        await page.getByLabel('Hledat v nastavení').fill('uživatel');
        if (await page.getByRole('link', { name: /Uživatelé a práva/ }).count()) fail(`${tag} reception`, 'search finds the team screen');
        await page.getByLabel('Hledat v nastavení').fill('');
        await shot(page, `${tag}-recepce-nastaveni`);

        await page.goto(`${BASE}/administrace`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        if (await page.getByRole('heading', { level: 1, name: 'Administrace' }).count()) fail(`${tag} reception`, '/administrace opened');
        if (/Administrace/i.test(await page.locator('body').innerText())) fail(`${tag} reception`, 'the word Administrace is on /administrace');
        await audit(page, `${tag} reception /administrace`, vp);
        if (theme === 'light') await shot(page, `${tag}-recepce-administrace`);
        if (errors.length) fail(`${tag} reception`, `page errors: ${errors.slice(0, 2).join(' | ')}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), failures }, null, 2));
console.log(failures.length === 0 ? '\nOK' : `\n${failures.length} failure(s)`);
process.exit(failures.length === 0 ? 0 : 1);
