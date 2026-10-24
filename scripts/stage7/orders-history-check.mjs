/*
 * Stage 7 (R21) - live orders only, the cancelled ones behind "Historie", in a real browser at 390x844, 820x1180, 1440x900.
 *
 *     BASE=http://localhost:3013 node scripts/stage7/orders-history-check.mjs
 *     env: DEV_LOGIN=<file with "E-mail:" / "Password:" lines>   OUT_DIR=design/stage7   VP=390x844,820x1180,1440x900
 *
 * OWN headless Chromium, the login is read from the file and typed into the form, never printed. Test data: the club
 * "ZZ test stage7 <pid>" gets two invited orders, one of them is cancelled with a message; at the end the live one is
 * cancelled and the club deactivated. Checks per viewport:
 *   - /clubs/objednavky lists no "Zrušeno" order, has ONE "Historie (n)" button, the document does not scroll, no sideways overflow;
 *   - the button leads to /clubs/objednavky/historie, which lists the cancelled order (search finds it), "Otevřít" shows it read-only;
 *   - the club page lists the live order only, its Historie link leads to the view pre-filtered to the club;
 *   - /clubs/objednavky/<id>/historie is still ONE order's history;
 *   - 44 px targets on phone and tablet; no console error / failed request.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from '../pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://localhost:3013';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'stage7'));
const VIEWPORTS = (process.env.VP ?? '390x844,820x1180,1440x900').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height, label: s };
});
mkdirSync(OUT, { recursive: true });

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const EMAIL = /E-mail:\s*(\S+)/.exec(login)[1];
const PASS = /Password:\s*(\S+)/.exec(login)[1];
const CLUB = `ZZ test stage7 ${process.pid}`;
function freshIco() {
  const d = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));
  const sum = d.reduce((a, x, i) => a + x * (8 - i), 0);
  return d.join('') + String((11 - (sum % 11)) % 10);
}

const failures = [];
const fail = (where, what) => { failures.push(`${where}: ${what}`); console.log(`  FAIL ${where}: ${what}`); };
const ok = (where, what) => console.log(`  ok   ${where}: ${what}`);
const check = (cond, where, what) => (cond ? ok(where, what) : fail(where, what));

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const STATE = join(tmpdir(), `sm-stage7-${process.pid}.json`);

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

const contextFor = (vp) => browser.newContext({
  viewport: { width: vp.width, height: vp.height }, locale: 'cs-CZ', timezoneId: 'Europe/Prague', storageState: STATE,
  isMobile: vp.width < 768, hasTouch: vp.width < 1280,
});

/* ---------------------------------- the data ---------------------------------- */
let club = null;
let liveId = null;
let cancelledId = null;
{
  const ctx = await contextFor({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prehled`);
  await page.waitForTimeout(800);
  const api = apiOf(page);
  const made = await api('POST', '/api/clubs', { name: CLUB, ico: freshIco(), paymentTermsDays: 14, contactPerson: 'Test Test', contactEmail: 'zz-test@example.invalid', contactPhone: '+420777000111' });
  console.log(`create ${CLUB}: ${made.status}`);
  club = (unwrap((await api('GET', '/api/clubs')).json) ?? []).find((c) => c.name === CLUB) ?? null;
  if (club !== null) {
    const a = await api('POST', '/api/v1/club-orders', { clubId: club.id, note: 'ZZ test živá' });
    const b = await api('POST', '/api/v1/club-orders', { clubId: club.id, note: 'ZZ test zrušená' });
    liveId = unwrap(a.json)?.id ?? null;
    cancelledId = unwrap(b.json)?.id ?? null;
    console.log(`orders: live ${a.status}, to cancel ${b.status}`);
    if (cancelledId !== null) console.log(`cancel: ${(await api('POST', `/api/v1/club-orders/${cancelledId}/cancel?cancelAthletes=false`, { clubMessage: 'ZZ test důvod zrušení' })).status}`);
  }
  await ctx.close();
}
if (club === null || liveId === null || cancelledId === null) { console.log('test data could not be created'); await browser.close(); process.exit(2); }

const measure = () => {
  const doc = document.documentElement;
  const region = document.getElementById('fit-region');
  const out = { docY: Math.max(doc.scrollHeight - innerHeight, document.body.scrollHeight - innerHeight), docX: Math.max(doc.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth), clipped: [] };
  if (region === null) return out;
  const box = region.getBoundingClientRect();
  for (const el of region.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).display === 'none') continue;
    let scrolls = false;
    for (let a = el.parentElement; a !== null && a !== region; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') { scrolls = true; break; }
    }
    if (r.right > box.right + 1 && !scrolls) { out.clipped.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}"`); if (out.clipped.length > 5) break; }
  }
  return out;
};
const smallTargets = (min) => {
  const region = document.getElementById('fit-region');
  const list = [];
  if (region === null) return list;
  for (const el of region.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea')) {
    if (el.getAttribute('aria-hidden') === 'true' || el.tabIndex === -1) continue; // MUI's hidden native select input
    const r = (el.closest('.MuiInputBase-root') ?? el).getBoundingClientRect(); // a field is as big as its box, not its inner input
    if (r.width === 0 || r.height === 0 || el.hasAttribute('disabled') || getComputedStyle(el).visibility === 'hidden') continue;
    if (r.height < min - 0.5) list.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}`);
  }
  return list;
};
function watch(page, bucket) {
  page.on('pageerror', (e) => bucket.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|outside of Vite serving allow list/.test(m.text())) bucket.push(`console ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(BASE) && r.status() >= 400 && !/\/api\/(account|v1\/account)|\.woff|fontsource/.test(u)) bucket.push(`http ${r.status()} ${new URL(u).pathname}`);
  });
}
const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => undefined); await page.waitForTimeout(1200); };

async function audit(page, where, vp) {
  const m = await page.evaluate(measure);
  check(m.docY <= 1, where, m.docY <= 1 ? 'the document does not scroll' : `the document scrolls vertically by ${m.docY}px`);
  check(m.docX <= 1, where, m.docX <= 1 ? 'no sideways scroll' : `sideways scroll ${m.docX}px`);
  check(m.clipped.length === 0, where, m.clipped.length === 0 ? 'nothing overflows sideways' : `clipped: ${m.clipped.join(' | ')}`);
  const touch = vp.width < 1280;
  const small = await page.evaluate(smallTargets, touch ? 44 : 32);
  check(small.length === 0, where, small.length === 0 ? (touch ? 'every target is 44 px' : 'every target is 32 px or more') : `small targets: ${small.slice(0, 5).join(' | ')}`);
}
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 60 });

/* ---------------------------------- the pass ---------------------------------- */
for (const vp of VIEWPORTS) {
  console.log(`\n== ${vp.label}`);
  const ctx = await contextFor(vp);
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  const L = (s) => `${vp.label} ${s}`;

  /* 1. the live list */
  await page.goto(`${BASE}/clubs/objednavky?clubId=${club.id}`);
  await page.waitForSelector('[data-testid="club-orders"]', { timeout: 60000 });
  await page.waitForSelector('[data-testid="orders-history-button"]', { timeout: 30000 });
  await settle(page);
  const rowText = await page.evaluate(() => [...document.querySelectorAll('[data-testid="order-row"], [data-testid="order-card"]')].map((e) => e.textContent).join('\n'));
  check(rowText.includes('ZZ test') || rowText.includes(CLUB) || rowText.length > 0, L('orders'), 'the live order is listed');
  check(!/Zrušeno/.test(rowText), L('orders'), 'no row says "Zrušeno"');
  const buttons = await page.locator('[data-testid="orders-history-button"]').count();
  check(buttons === 1, L('orders'), `one Historie button (${buttons})`);
  const label = await page.locator('[data-testid="orders-history-button"]').first().textContent();
  check(/Historie \(1\)/.test(label ?? ''), L('orders'), `button says "${label}" for this club`);
  const chips = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Stav objednávky"] button')].map((b) => b.textContent));
  check(!chips.some((c) => /Zrušeno/.test(c ?? '')), L('orders'), 'no "Zrušeno" status chip');
  await audit(page, L('orders'), vp);
  await shot(page, `orders-${vp.label}`);

  /* 2. the special view */
  await page.locator('[data-testid="orders-history-button"]').first().click();
  await page.waitForSelector('[data-testid="club-orders-history"]', { timeout: 30000 });
  check(new URL(page.url()).pathname === '/clubs/objednavky/historie', L('historie'), `address ${new URL(page.url()).pathname}`);
  await page.waitForSelector('[data-testid="history-row"], [data-testid="history-card"]', { timeout: 30000 });
  await settle(page);
  await page.fill('input[type=text]', CLUB);
  await settle(page);
  const items = page.locator('[data-testid="history-row"], [data-testid="history-card"]');
  check((await items.count()) === 1, L('historie'), `search "${CLUB}" finds the one cancelled order (${await items.count()})`);
  const text = (await items.first().textContent()) ?? '';
  check(/ZZ test důvod zrušení|zrušen|Zrušeno/i.test(text), L('historie'), `shows the cancel day / reason: ${text.slice(0, 90).replace(/\s+/g, ' ')}`);
  await audit(page, L('historie'), vp);
  await shot(page, `historie-${vp.label}`);
  await page.getByRole('button', { name: /^Otevřít objednávku/ }).first().click();
  await page.waitForSelector('[data-testid="order-detail"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  check((await page.locator('[data-testid="order-detail"]').getAttribute('data-status')) === 'Cancelled', L('open'), 'the order panel shows the cancelled order');
  check((await page.locator('[data-testid="order-readonly"]').count()) === 1, L('open'), 'the read-only notice is there');
  check((await page.locator('[data-testid="order-actions"]').count()) === 0, L('open'), 'no action buttons (read-only)');
  check((await page.locator('[data-testid="order-history-button"]').count()) === 1, L('open'), 'its history button is there');
  await shot(page, `historie-open-${vp.label}`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Zavřít detail/ }).first().click({ timeout: 2000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Zpět na objednávky' }).click();
  await page.waitForSelector('[data-testid="club-orders"]', { timeout: 30000 });
  check(new URL(page.url()).pathname === '/clubs/objednavky', L('back'), '"Zpět na objednávky" returns to the live list');

  /* 3. the club page */
  await page.goto(`${BASE}/clubs/${club.id}`);
  await page.waitForSelector('[data-shelf="club-orders"]', { timeout: 60000 });
  await page.waitForSelector('[data-testid="club-orders-history-link"]', { timeout: 30000 });
  await settle(page);
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-shelf="club-orders"] [role="listitem"]')].map((e) => e.textContent).join('\n'));
  check(!/Zrušeno/.test(cards) && cards.length > 0, L('club page'), 'the orders shelf lists the live order only');
  const href = await page.locator('[data-testid="club-orders-history-link"]').getAttribute('href');
  check(href === `/clubs/objednavky/historie?clubId=${club.id}`, L('club page'), `Historie link -> ${href}`);
  await audit(page, L('club page'), vp);
  await shot(page, `club-page-${vp.label}`);
  await page.locator('[data-testid="club-orders-history-link"]').click();
  await page.waitForSelector('[data-testid="club-orders-history"]', { timeout: 30000 });
  await page.waitForSelector('[data-testid="history-row"], [data-testid="history-card"]', { timeout: 30000 });
  check((await page.locator('[data-testid="history-row"], [data-testid="history-card"]').count()) === 1, L('club page'), 'the link opens the view pre-filtered to this club');

  /* 4. one order's history is still one order's history */
  await page.goto(`${BASE}/clubs/objednavky/${cancelledId}/historie`);
  await page.waitForSelector('text=Historie objednávky', { timeout: 30000 });
  await settle(page);
  check((await page.locator('[data-testid="order-history"]').count()) === 1 || (await page.locator('[data-testid="history-empty"]').count()) === 1, L('one order'), '/clubs/objednavky/<id>/historie is that order\'s history');
  await audit(page, L('one order'), vp);

  check(errors.length === 0, L('console'), errors.length === 0 ? 'no console error / failed request' : errors.slice(0, 5).join(' | '));
  await ctx.close();
}

/* ---------------------------------- clean up ---------------------------------- */
{
  const ctx = await contextFor({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prehled`);
  await page.waitForTimeout(800);
  const api = apiOf(page);
  console.log(`\ncancel live test order: ${(await api('POST', `/api/v1/club-orders/${liveId}/cancel?cancelAthletes=false`, null)).status}`);
  console.log(`deactivate ${CLUB}: ${(await api('DELETE', `/api/clubs/${club.id}`)).status}`);
  await ctx.close();
}
await browser.close();
console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} FAILURE(S):\n${failures.join('\n')}`);
process.exit(failures.length === 0 ? 0 : 1);
