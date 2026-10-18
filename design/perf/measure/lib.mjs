import { createRequire } from 'module';
const require = createRequire('C:/Users/Matko/Jarvis-WorkOS/frontend/package.json');
export const { chromium } = require('playwright-core');
import fs from 'fs';

export const BASE = process.env.BASE || 'http://localhost:3000';
export const norm = (p) => p
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
  .replace(/\/\d{4}-\d{2}-\d{2}(T[^/?]*)?/g, '/{date}');

export async function launch() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1672, height: 941 } });
  const page = await ctx.newPage();
  const log = [];
  const pending = new Map();
  const t0 = Date.now();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    const e = { method: r.method(), path: norm(u.pathname), full: u.pathname + u.search, query: norm(u.search), start: Date.now() - t0, scen: log.scen, status: null, ms: null, bytes: null };
    pending.set(r, e); log.push(e);
  });
  page.on('response', async (resp) => {
    const r = resp.request(); const e = pending.get(r); if (!e) return;
    e.status = resp.status(); e.ms = Date.now() - t0 - e.start;
    try { const b = await resp.body(); e.bytes = b.length; } catch { e.bytes = 0; }
  });
  page.on('requestfailed', (r) => { const e = pending.get(r); if (e) { e.status = 'ABORT'; e.ms = Date.now() - t0 - e.start; e.bytes = 0; } });
  return { browser, ctx, page, log };
}

export async function login(page) {
  const pw = fs.readFileSync('C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8').match(/Password:\s*(\S+)/)[1];
  await page.goto(BASE + '/login');
  await page.fill('input[type="email"], input[name="email"]', 'admin@sportmedical.cz');
  await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]');
}
export async function settle(page, quiet = 700, max = 15000) {
  const t = Date.now(); let last = Date.now();
  const on = () => { last = Date.now(); };
  page.on('request', on);
  while (Date.now() - t < max && Date.now() - last < quiet) await page.waitForTimeout(100);
  page.off('request', on);
}
export async function spa(page, path) {
  await page.evaluate((p) => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
}
