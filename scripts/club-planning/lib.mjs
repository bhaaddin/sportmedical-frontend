/*
 * Shared helpers for the club-planning checks: our OWN headless Chromium (never the shared browser pane), the dev login
 * read from the file (never printed), an authenticated fetch inside the page, and the request waterfall.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { loadPlaywright, findChrome } from '../pw-env.mjs';

export const BASE = process.env.BASE ?? 'http://localhost:3000';
export const OUT = process.env.OUT ?? 'design/club-planning';
mkdirSync(OUT, { recursive: true });

export const SIZES = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
};

export async function launch() {
  const pw = await loadPlaywright();
  return pw.chromium.launch({ executablePath: findChrome(), headless: true });
}

export async function newPage(browser, size = 'desktop', extra = {}) {
  const s = SIZES[size] ?? size;
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    isMobile: s.isMobile, hasTouch: s.hasTouch,
    locale: 'cs-CZ', timezoneId: 'Europe/Prague', ...extra,
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + String(e.message).slice(0, 300)));
  return page;
}

export async function login(page) {
  const txt = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
  const email = /E-mail:\s*(\S+)/.exec(txt)[1];
  const pass = /Password:\s*(\S+)/.exec(txt)[1];
  await page.goto(BASE + '/login');
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', pass);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

/** Authenticated fetch against the API from inside the page (same token the app uses). */
export async function api(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json, text: json ? undefined : text.slice(0, 300) };
  }, { method, path, body });
}

export const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

/** The planner stage is drawn (the dev server compiles modules on first use, so this can take a while). */
export async function waitPlanner(page, timeout = 90000) {
  await page.waitForSelector('.sm-planner', { timeout });
  await page.waitForSelector('[data-testid=club-planner-loading]', { state: 'detached', timeout }).catch(() => {});
  await page.waitForTimeout(1200);
}
export const buttons = (page) =>
  page.$$eval('button, a[role=button], [role=button]', (els) =>
    els.filter((e) => e.getClientRects().length).map((e) => (e.getAttribute('data-testid') || e.id || '') + '|' + ((e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 40))));
export const controlsIn = (page, sel) =>
  page.$$eval(`${sel} input, ${sel} select, ${sel} textarea, ${sel} button, ${sel} [role=combobox], ${sel} [role=checkbox]`, (els) => els.filter((e) => e.getClientRects().length).map((e) => e.tagName + '|' + (e.getAttribute('data-testid') || e.id || e.name || '') + '|' + (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60)));

export async function findOrMakeClub(page, name = 'ZZ test plánování') {
  let clubs = (await api(page, 'GET', '/api/clubs')).json;
  let club = clubs.find((c) => c.name === name);
  if (!club) {
    await api(page, 'POST', '/api/clubs', { name, ico: '27082440', paymentTermsDays: 14, contactPerson: 'Test Test', contactEmail: 'zz-test@example.invalid', contactPhone: '+420777000111' });
    clubs = (await api(page, 'GET', '/api/clubs')).json;
    club = clubs.find((c) => c.name === name);
  }
  return club;
}

/** Club page -> "Nová objednávka klubu" -> "Vyplním sám" -> service 1 -> seats by činnost name -> "Vybrat termíny v kalendáři". */
export async function startClubOrder(page, clubId, seats /* { 'Základní sportovní prohlídka': 7, ... } */) {
  await page.goto(`${BASE}/clubs/${clubId}`);
  await waitPlanner(page);
  await page.click('[data-testid=ov-new-order], [data-testid=deck-empty-new]');
  await page.click('[data-testid=entry-phone]');
  await page.locator('[role=dialog] [role=combobox]').nth(1).click();
  await page.locator('[role=option]').first().click();
  for (const [name, n] of Object.entries(seats)) {
    const row = page.locator('[data-testid=order-activity]').filter({ hasText: name }).first();
    await row.locator('input[type=checkbox]').check();
    await page.getByLabel(`Počet hráčů, ${name}`).fill(String(n));
  }
  await page.getByRole('button', { name: 'Vybrat termíny v kalendáři' }).click();
  await page.waitForTimeout(2500);
}

/** Board geometry: rect of #day-board; the planning window comes from the hour labels. */
export async function boardRect(page) {
  return page.evaluate(() => {
    const r = document.querySelector('#day-board').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

export const minuteY = (r, m) => r.y + ((m - 420) / 720) * r.h;
export const dayX = (r, i) => r.x + ((i + 0.5) * r.w) / 7;

/** Mouse drag on the week board from (day, minute) to (day2, minute2) with intermediate moves. */
export async function dragBoard(page, from, to, steps = 8) {
  const r = await boardRect(page);
  const x1 = dayX(r, from.day), y1 = minuteY(r, from.min);
  const x2 = dayX(r, to.day ?? from.day), y2 = minuteY(r, to.min);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
  return {
    up: async () => { await page.mouse.up(); await page.waitForTimeout(500); },
    page,
  };
}
export async function dragAndDrop(page, from, to) {
  const d = await dragBoard(page, from, to);
  await d.up();
}
export const clickCard = (page, name) => page.locator('.plan-card').filter({ hasText: name }).first().click();

/** Drop and, when the činnosti bubble opens, confirm it as it stands. */
export async function dropConfirm(page, from, to) {
  await dragAndDrop(page, from, to);
  const ok = page.locator('[data-testid=pick-ask] button', { hasText: 'Potvrdit' });
  if (await ok.count()) { await ok.first().click(); await page.waitForTimeout(500); }
}
export const toasts = async (page) => (await page.locator('[role=status], .sm-toast, .planner-toast, .toast').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).filter(Boolean);
