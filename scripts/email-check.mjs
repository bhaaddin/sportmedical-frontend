/*
 * Nastavení > Komunikace > E-mail in our OWN headless Chromium (never the shared browser pane), on three layouts.
 *
 *     node scripts/email-check.mjs
 *     env: BASE=http://localhost:3004   a front door that sends /api to the API under test (here :5097, a scratch database)
 *          OUT=design/stage9            screenshots (JPEG) and the report go here
 *          DEV_LOGIN=<file with "E-mail:" / "Password:" lines>   (read, typed into the form, never printed)
 *          MOTION=plné|omezené|vypnuto  sets the Pohyb setting before the page opens
 *
 * Per layout it asserts: the document never scrolls, no horizontal overflow, every control is at least 44 px, no
 * console error and no failed request, the real (unconfigured) status is shown, the test pop-out opens and the
 * real server answers "není nastaveno" (nothing is sent). A second pass with the status mocked as configured
 * (page.route, removed afterwards) draws the configured card. It then mocks an older server (404).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:3004';
const OUT = resolve(root, process.env.OUT ?? 'design/stage9');
const MOTION = process.env.MOTION;
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const PAGE_PATH = '/nastaveni/email';
const STATUS_URL = '**/api/v1/settings/email/status';

const LAYOUTS = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'tablet-820x1180', width: 820, height: 1180 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

mkdirSync(OUT, { recursive: true });
const failures = [];
const report = { base: BASE, motion: MOTION ?? 'as stored', layouts: [] };
const fail = (layout, message) => {
  failures.push(`${layout}: ${message}`);
  console.log(`  FAIL ${message}`);
};
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.jpg`), type: 'jpeg', quality: 70 });

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const small = [];
    for (const el of document.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), textarea, select')) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      if (el.closest('nav') || el.textContent.startsWith('Přeskočit')) continue;
      if (rect.height < 43.5 || rect.width < 43.5) {
        small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return {
      documentScrolls: doc.scrollHeight > window.innerHeight + 1 || document.body.scrollHeight > window.innerHeight + 1,
      horizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
      small,
    };
  });
}

for (const layout of LAYOUTS) {
  console.log(layout.name);
  const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, locale: 'cs-CZ' });
  if (MOTION) {
    await context.addInitScript((motion) => {
      try { localStorage.setItem('sm-motion', motion); } catch { /* storage blocked */ }
    }, MOTION);
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  let expectedMocks = false;
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => !r.url().includes('/@fs/') && failedRequests.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/v1/session')) {
      /* The deliberate 409 of the real test send and the mocked 404 of the old server are expected. */
      const expected = (url.pathname === '/api/v1/settings/email/test' && response.status() === 409)
        || (expectedMocks && url.pathname === '/api/v1/settings/email/status' && response.status() === 404);
      if (!expected) failedRequests.push(`${response.request().method()} ${url.pathname} -> ${response.status()}`);
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.getByLabel(/^E-mail/).fill(EMAIL);
  await page.getByLabel(/^Heslo/).fill(PASS);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

  /* 1. The real server, nothing configured. */
  await page.goto(`${BASE}${PAGE_PATH}`, { waitUntil: 'load' });
  await page.getByRole('heading', { level: 1, name: 'E-mail' }).waitFor({ timeout: 30000 });
  await page.getByRole('region', { name: 'Stav e-mailu' }).waitFor({ timeout: 30000 });
  const text = await page.getByRole('region', { name: 'Stav e-mailu' }).innerText();
  if (!/Nenastaveno/.test(text)) fail(layout.name, `real status should read Nenastaveno, got: ${text.slice(0, 80)}`);
  let metrics = await measure(page);
  if (metrics.documentScrolls) fail(layout.name, 'the document scrolls (unconfigured)');
  if (metrics.horizontalOverflow) fail(layout.name, 'horizontal overflow (unconfigured)');
  for (const item of metrics.small) fail(layout.name, `target under 44 px: ${item}`);
  await shot(page, `${layout.name}-unconfigured`);

  /* 2. The pop-out, against the real server: it answers "not configured" and sends nothing. */
  await page.getByRole('button', { name: 'Poslat zkušební e-mail' }).click();
  const dialog = page.getByRole('dialog', { name: 'Poslat zkušební e-mail' });
  await dialog.waitFor();
  await dialog.getByLabel('E-mailová adresa příjemce').fill('zkouska@example.invalid');
  await dialog.getByRole('button', { name: 'Odeslat' }).click();
  await dialog.getByRole('alert').waitFor();
  const answer = await dialog.getByRole('alert').innerText();
  if (!/není nastaven/.test(answer)) fail(layout.name, `expected the not-configured sentence, got: ${answer}`);
  const dialogMetrics = await measure(page);
  for (const item of dialogMetrics.small) fail(layout.name, `dialog target under 44 px: ${item}`);
  await shot(page, `${layout.name}-test-dialog`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  /* 3. Mocked: a configured sender (the real server has none). Mocks are removed straight after. */
  await page.route(STATUS_URL, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ provider: 'brevo', configured: true, fromAddress: 'ordinace@example.test', lastSuccessUtc: '2026-10-24T08:30:00Z', sentLast24Hours: 12, failedLast24Hours: 1, pending: 0 }),
  }));
  await page.reload({ waitUntil: 'load' });
  await page.getByRole('region', { name: 'Stav e-mailu' }).waitFor({ timeout: 30000 });
  if (!/Nastaveno/.test(await page.getByRole('region', { name: 'Stav e-mailu' }).innerText())) fail(layout.name, 'mocked configured card not drawn');
  metrics = await measure(page);
  if (metrics.documentScrolls) fail(layout.name, 'the document scrolls (configured)');
  if (metrics.horizontalOverflow) fail(layout.name, 'horizontal overflow (configured)');
  await shot(page, `${layout.name}-configured`);
  await page.context().unrouteAll();

  /* 4. Mocked: an older server. */
  expectedMocks = true;
  await page.route(STATUS_URL, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.reload({ waitUntil: 'load' });
  await page.getByText('Tato verze serveru ještě neumí e-mail přes API.').waitFor({ timeout: 30000 });
  await shot(page, `${layout.name}-old-server`);
  await page.context().unrouteAll();

  if (consoleErrors.length > 0) {
    const unexpected = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
    if (unexpected.length > 0) fail(layout.name, `console errors: ${[...new Set(unexpected)].join(' | ')}`);
  }
  if (failedRequests.length > 0) fail(layout.name, `failed requests: ${[...new Set(failedRequests)].join(' | ')}`);
  report.layouts.push({ layout: layout.name, ...metrics, consoleErrors, failedRequests });
  await context.close();
}

await browser.close();
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nall layouts passed');
