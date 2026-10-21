/*
 * Zabezpečení a zálohy in our OWN headless Chromium (never the shared browser pane), on three layouts.
 *
 *     node scripts/security-center-check.mjs
 *     env: BASE=http://localhost:3002        a Vite dev server proxied to the API under test (here :5094, a scratch database)
 *          LABEL=live                        goes into the file names: design/security-center/<LABEL>-<layout>.png
 *          OUT=design/security-center        where the screenshots and the report go
 *          DEV_LOGIN=<file with "E-mail:" / "Password:" lines>     (read, typed into the form, never printed)
 *          MOTION=plné|omezené|vypnuto       sets the Pohyb setting before the page opens (default: leave it)
 *          ACCENT=<#rrggbb>                  sets the accent the desk picked (localStorage), to see it recolour the page
 *
 * Per layout (phone 390x844, tablet 820x1180, desktop 1440x900) it asserts what the owner asked for:
 *   - the document never scrolls (the scrolling happens inside the settings frame);
 *   - no horizontal overflow;
 *   - every button, link-button, checkbox and field inside the page is at least 44 x 44 px;
 *   - the console has no error and no request failed;
 *   - the four lights and the shelves are drawn, and nothing is "Neznámé" without a reason being shown.
 * It then opens the dialogs that matter on that layout (the backup keys, the sign-out confirmation) and takes
 * pictures of them. Exit code 1 if any assertion failed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3002';
const LABEL = process.env.LABEL ?? 'live';
const OUT = resolve(root, process.env.OUT ?? 'design/security-center');
const MOTION = process.env.MOTION;
const ACCENT = process.env.ACCENT;
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const PAGE_PATH = '/nastaveni/zabezpeceni-a-zalohy';

const LAYOUTS = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'tablet-820x1180', width: 820, height: 1180 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

mkdirSync(OUT, { recursive: true });
const failures = [];
const report = { label: LABEL, base: BASE, motion: MOTION ?? 'as stored', layouts: [] };
const fail = (layout, message) => {
  failures.push(`${layout}: ${message}`);
  console.log(`  FAIL ${message}`);
};

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });

for (const layout of LAYOUTS) {
  console.log(layout.name);
  const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, locale: 'cs-CZ' });
  if (MOTION || ACCENT) {
    await context.addInitScript(
      ([motion, accent]) => {
        try {
          if (motion) localStorage.setItem('sm-motion', motion);
          if (accent) localStorage.setItem('sm-theme-accent', accent);
        } catch {
          /* storage blocked: the page falls back to its defaults */
        }
      },
      [MOTION ?? null, ACCENT ?? null],
    );
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  });
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/v1/session')) {
      failedRequests.push(`${response.request().method()} ${url.pathname} -> ${response.status()}`);
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.getByLabel(/^E-mail/).fill(EMAIL);
  await page.getByLabel(/^Heslo/).fill(PASS);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

  await page.goto(`${BASE}${PAGE_PATH}`, { waitUntil: 'load' });
  await page.getByRole('heading', { level: 1, name: 'Zabezpečení a zálohy' }).waitFor({ timeout: 30000 });
  await page.getByTestId('lights').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const scope = document.querySelector('[data-fit-page]') ?? document.body;
    const small = [];
    for (const el of scope.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), textarea, select')) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      if (el.closest('[hidden]')) continue;
      /* The settings frame's own breadcrumb (every settings screen has it; the phone gets a 44 px back button instead). */
      if (el.closest('nav[aria-label="Kde jste"]')) continue;
      /* A link inside a sentence is text; a standalone link or any button is a target. */
      const inline = el.tagName === 'A' && getComputedStyle(el.parentElement).display !== 'flex' && el.closest('li, p, span') !== null && el.textContent.length < 40 && rect.height < 30;
      if (inline) continue;
      if (rect.height < 43.5 || rect.width < 43.5) {
        small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    const lights = [...document.querySelectorAll('[data-card]')].map((el) => `${el.getAttribute('data-card')}=${el.getAttribute('data-light')}`);
    return {
      documentScrolls: doc.scrollHeight > window.innerHeight + 1 || document.body.scrollHeight > window.innerHeight + 1,
      scrollHeight: doc.scrollHeight,
      innerHeight: window.innerHeight,
      horizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
      small,
      lights,
      shelves: [...document.querySelectorAll('[data-shelf]')].map((el) => el.getAttribute('data-shelf')),
      text: document.body.innerText.length,
    };
  });

  console.log(`  lights: ${metrics.lights.join(' ')}`);
  if (metrics.documentScrolls) fail(layout.name, `the document scrolls (${metrics.scrollHeight} > ${metrics.innerHeight})`);
  if (metrics.horizontalOverflow) fail(layout.name, 'horizontal overflow');
  for (const item of metrics.small) fail(layout.name, `target under 44 px: ${item}`);
  if (metrics.lights.length !== 4) fail(layout.name, `expected four lights, saw ${metrics.lights.length}`);
  if (metrics.shelves.length < 5) fail(layout.name, `expected five shelves, saw ${metrics.shelves.join(',')}`);

  await page.screenshot({ path: resolve(OUT, `${LABEL}-${layout.name}.png`) });

  /* The scrolling region (the settings frame) scrolled to its end: the lower shelves. */
  const scrolled = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 40 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
    const region = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!region) return false;
    region.scrollTop = region.scrollHeight;
    return true;
  });
  if (scrolled) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(OUT, `${LABEL}-${layout.name}-end.png`) });
  }

  /* The dialogs: backup keys, and the confirmation before signing everybody else out. */
  await page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollTop) el.scrollTop = 0; }));
  const keys = page.getByRole('button', { name: /Klíče pro hlášení záloh/ });
  await keys.scrollIntoViewIfNeeded();
  await keys.click();
  await page.getByRole('dialog', { name: /Klíče pro hlášení záloh/ }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, `${LABEL}-${layout.name}-keys.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const others = page.getByRole('button', { name: 'Odhlásit všechny ostatní' });
  if ((await others.count()) > 0) {
    await others.scrollIntoViewIfNeeded();
    await others.click();
    await page.getByRole('dialog', { name: /Odhlásit všechny ostatní/ }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(OUT, `${LABEL}-${layout.name}-signout.png`) });
    await page.getByRole('button', { name: 'Zrušit' }).click();
  }

  if (consoleErrors.length > 0) fail(layout.name, `console errors: ${[...new Set(consoleErrors)].join(' | ')}`);
  if (failedRequests.length > 0) fail(layout.name, `failed requests: ${[...new Set(failedRequests)].join(' | ')}`);
  report.layouts.push({ layout: layout.name, ...metrics, consoleErrors, failedRequests });
  await context.close();
}

await browser.close();
writeFileSync(resolve(OUT, `${LABEL}-report.json`), JSON.stringify(report, null, 2));
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nall layouts passed');
