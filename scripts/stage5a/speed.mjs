/*
 * How fast the club PAGE (`/clubs/:clubId`) is ready, and what it asks the API on the way - and what the Kalendář button's
 * warm-up buys the calendar behind it.
 *
 *   BASE=http://localhost:3009 node scripts/stage5a/speed.mjs        (env: RUNS=5 DELAY=80 HOVER_MS=600 CLUB="FK Slaný" ONLY=cold,nav,...)
 *
 * Own headless Chromium, 1440x900, dev login read from the file (never printed), every `/api/` call held back DELAY ms (a
 * live-like round trip). Reads only. Variants (RUNS each after one discarded warm-up, medians):
 *   cold          a new context opens /clubs/:id
 *   nav           /clubs idle, the card is clicked at once
 *   nav-hover     the pointer rests on the card first
 *   calendar      from the page: a click on Kalendář at once -> the stage is drawn
 *   calendar-hover  from the page: the pointer rests on Kalendář first (the button warms the calendar), then the click
 * "page ready" = the statistics shelf has its six figures and nothing is aria-busy; "depth" = the longest chain of API calls where
 * each starts only after the previous answered. Raw numbers -> design/stage5a/speed.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findChrome, loadPlaywright } from '../pw-env.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3009';
const DELAY = Number(process.env.DELAY ?? 80);
const RUNS = Number(process.env.RUNS ?? 5);
const HOVER_MS = Number(process.env.HOVER_MS ?? 600);
const CLUB = process.env.CLUB ?? 'FK Slaný';
mkdirSync('design/stage5a', { recursive: true });

const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const STATE = join(tmpdir(), `sm-stage5a-speed-${process.pid}.json`);
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', /E-mail:\s*(\S+)/.exec(login)[1]);
  await page.fill('input[type=password]', /Password:\s*(\S+)/.exec(login)[1]);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  await page.waitForTimeout(1200);
  await ctx.storageState({ path: STATE });
  await ctx.close();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const shape = (path) => path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}');

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ', timezoneId: 'Europe/Prague', storageState: STATE });
  await ctx.route('**/api/**', async (route) => { await sleep(DELAY); await route.continue(); });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) reqs.push({ id: r, path: shape(new URL(r.url()).pathname), start: Date.now(), end: null, level: 0 }); });
  const finish = (r) => { const e = reqs.find((x) => x.id === r); if (e && e.end === null) e.end = Date.now(); };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  return { ctx, page, reqs };
}

/** The chain depth of the API calls that started before `until` (a call is one level below the deepest call answered before it began). */
function depthOf(reqs, until) {
  const sorted = reqs.filter((r) => r.start <= until).sort((a, b) => a.start - b.start);
  for (const r of sorted) r.level = 1 + Math.max(0, ...sorted.filter((p) => p.end !== null && p.end <= r.start).map((p) => p.level));
  return Math.max(0, ...sorted.map((r) => r.level));
}

const pageReady = (page) =>
  page.waitForFunction(() => document.querySelectorAll('[data-shelf="club-stats"] [data-card="metric"]').length === 6 && document.querySelectorAll('[aria-busy="true"]').length === 0, null, { timeout: 90000 });
const stageReady = (page) =>
  page.waitForFunction(() => document.querySelector('.sm-planner #day-board') && !document.querySelector('[data-testid=club-planner-loading],[data-testid=planner-loading]'), null, { timeout: 90000 });

async function clubIdOf(page) {
  return page.evaluate(async (name) => {
    const token = localStorage.getItem('token');
    const r = await fetch('/api/clubs', { headers: { Authorization: `Bearer ${token}` } });
    const b = await r.json();
    return ((b?.data ?? b?.value ?? b) || []).find((c) => c.name === name)?.id ?? null;
  }, CLUB);
}

let clubId = null;
{
  const { ctx, page } = await open();
  await page.goto(`${BASE}/prehled`);
  await page.waitForTimeout(600);
  clubId = await clubIdOf(page);
  await ctx.close();
}
if (clubId === null) throw new Error(`club "${CLUB}" not found`);

async function runVariant(name) {
  const { ctx, page, reqs } = await open();
  try {
    if (name === 'cold') {
      const t0 = Date.now();
      await page.goto(`${BASE}/clubs/${clubId}`);
      await pageReady(page);
      const ms = Date.now() - t0;
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return { readyMs: ms, requests: reqs.length, depth: depthOf(reqs, t0 + ms), duplicates: reqs.length - new Set(reqs.map((r) => r.path)).size };
    }
    await page.goto(`${BASE}/clubs`);
    const card = page.locator('[role=listitem]').filter({ hasText: CLUB }).first();
    await card.waitFor({ timeout: 90000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await sleep(500);
    if (name === 'nav' || name === 'nav-hover') {
      reqs.length = 0;
      if (name === 'nav-hover') { await card.hover(); await sleep(HOVER_MS); }
      const t0 = Date.now();
      await card.click();
      await page.waitForURL((u) => u.pathname === `/clubs/${clubId}`);
      await pageReady(page);
      const ms = Date.now() - t0;
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return { readyMs: ms, requests: reqs.length, depth: depthOf(reqs, t0 + ms) };
    }
    /* calendar variants: land on the page first, then Kalendář */
    await card.click();
    await page.waitForURL((u) => u.pathname === `/clubs/${clubId}`);
    await pageReady(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await sleep(400);
    reqs.length = 0;
    const button = page.locator('a[href$="/kalendar"]').first();
    if (name === 'calendar-hover') { await button.hover(); await sleep(HOVER_MS); }
    const t0 = Date.now();
    await button.click();
    await stageReady(page);
    const ms = Date.now() - t0;
    await page.waitForLoadState('networkidle').catch(() => undefined);
    return { readyMs: ms, requestsAfterClick: reqs.filter((r) => r.start >= t0).length, depth: depthOf(reqs.filter((r) => r.start >= t0), t0 + ms) };
  } finally {
    await ctx.close();
  }
}

const result = { base: BASE, delayMs: DELAY, club: CLUB, runs: RUNS, variants: {} };
for (const name of (process.env.ONLY ?? 'cold,nav,nav-hover,calendar,calendar-hover').split(',')) {
  await runVariant(name).catch(() => undefined); /* warm-up: the dev server compiles on first use */
  const all = [];
  for (let i = 0; i < RUNS; i += 1) all.push(await runVariant(name));
  result.variants[name] = {
    median: { readyMs: median(all.map((r) => r.readyMs)), requests: median(all.map((r) => r.requests ?? r.requestsAfterClick)), depth: median(all.map((r) => r.depth)) },
    runs: all,
  };
  const m = result.variants[name].median;
  console.log(`${name.padEnd(15)} ready ${String(m.readyMs).padStart(5)} ms   API requests ${m.requests}   depth ${m.depth}`);
}
writeFileSync('design/stage5a/speed.json', JSON.stringify(result, null, 2));
await browser.close();
