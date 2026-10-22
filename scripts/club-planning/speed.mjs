/*
 * How fast the club calendar (`/clubs/:clubId/kalendar`) gets ready, and what it asks the API on the way.
 *
 *   BASE=http://localhost:3132 LABEL=before node scripts/club-planning/speed.mjs
 *
 * Our OWN headless Chromium (never the shared browser pane), 1440x900, signed in once with the dev login (read from the
 * file, never printed). Every `/api/` request is held back DELAY ms (default 80) before it leaves the browser - a
 * live-like round trip, applied the same way before and after a change - so a serial request chain shows as the sum it
 * is on the live system. The network is read from CDP events (Network.requestWillBeSent / loadingFinished).
 *
 * Variants (RUNS times each, default 5, after one discarded warm-up run that lets the dev server compile):
 *   cold       a deep link: a new browser context opens /clubs/:id
 *   nav        in-app: /clubs is loaded and idle, the card is clicked at once (no resting pointer)
 *   nav-hover  in-app: the pointer rests on the card for HOVER_MS (default 600) first, then the click
 *
 * Marks (wall clock, from the goto / the click):
 *   skeleton   the club screen's loading state is on screen
 *   shell      `.sm-planner` is present and `[data-testid=club-planner-loading]` is gone (the task's definition)
 *   ready      the stage is drawn with its data: `.sm-planner #day-board`, and neither the club screen's nor the
 *              planner's loading state is on screen
 *   settled    the last API answer of the opening burst arrived (the API is then idle for IDLE_MS)
 * API waves as in NETWORK-ANALYSIS.md section 3.3 (a new wave when a call starts > 120 ms after the previous one) and
 * the chain depth (a call is one level deeper than the deepest call that had answered before it started).
 *
 * Nothing is written to the API: the script only reads (GET) and clicks a card. Raw numbers -> OUT/speed-<LABEL>.json.
 */
import { writeFileSync } from 'node:fs';
import { launch, login, api, BASE, OUT } from './lib.mjs';

const LABEL = process.env.LABEL ?? 'after';
const DELAY = Number(process.env.DELAY ?? 80);
const RUNS = Number(process.env.RUNS ?? 5);
const HOVER_MS = Number(process.env.HOVER_MS ?? 600);
const IDLE_MS = Number(process.env.IDLE_MS ?? 1500);
const CLUB = process.env.CLUB ?? 'FK Slaný';
const VARIANTS = (process.env.VARIANTS ?? 'cold,nav,nav-hover').split(',');
const VIEWPORT = { width: 1440, height: 900 };

const isApi = (url) => {
  try {
    const p = new URL(url).pathname;
    return p.startsWith('/api/') || p.startsWith('/hubs/');
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
/** /api/v1/club-orders/3f2a...-... -> /api/v1/club-orders/{id}; the query string is kept apart. */
const shape = (path) => path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}');

const MARKS_INIT = `
(() => {
  const marks = { skeleton: null, shell: null, ready: null };
  window.__clubMarks = marks;
  const tick = () => {
    const loading = document.querySelector('[data-testid=club-planner-loading]');
    const planner = document.querySelector('.sm-planner');
    if (marks.skeleton === null && loading) marks.skeleton = Date.now();
    if (marks.shell === null && planner && !loading) marks.shell = Date.now();
    if (marks.ready === null && planner && !loading && document.querySelector('.sm-planner #day-board') && !document.querySelector('[data-testid=planner-loading]')) marks.ready = Date.now();
  };
  const reset = () => { marks.skeleton = null; marks.shell = null; marks.ready = null; };
  window.__clubMarksReset = reset;
  setInterval(tick, 8);
  try { new MutationObserver(tick).observe(document, { subtree: true, childList: true, attributes: true }); } catch (e) {}
  let shifts = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) shifts += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  window.__cls = () => shifts;
})();
`;

/** Records every API request of a page through CDP, with wall-clock start / end. */
async function recordNetwork(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const byId = new Map();
  cdp.on('Network.requestWillBeSent', (e) => {
    if (!isApi(e.request.url)) return;
    const u = new URL(e.request.url);
    byId.set(e.requestId, {
      method: e.request.method,
      path: u.pathname + u.search,
      start: e.wallTime * 1000,
      ts: e.timestamp,
      end: null,
      status: null,
    });
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = byId.get(e.requestId);
    if (r) r.status = e.response.status;
  });
  const finish = (e) => {
    const r = byId.get(e.requestId);
    if (r && r.end === null) r.end = r.start + (e.timestamp - r.ts) * 1000;
  };
  cdp.on('Network.loadingFinished', finish);
  cdp.on('Network.loadingFailed', (e) => {
    finish(e);
    const r = byId.get(e.requestId);
    if (r && r.status === null) r.status = 'failed';
  });
  return {
    all: () => [...byId.values()],
    inFlight: () => [...byId.values()].filter((r) => r.end === null).length,
    clear: () => byId.clear(),
  };
}

/** Waits until no API request has been in flight or started for IDLE_MS (max `max` ms). */
async function apiIdle(net, max = 20000) {
  const until = Date.now() + max;
  let quietSince = Date.now();
  let lastCount = net.all().length;
  while (Date.now() < until) {
    await sleep(50);
    const count = net.all().length;
    if (net.inFlight() > 0 || count !== lastCount) {
      quietSince = Date.now();
      lastCount = count;
    } else if (Date.now() - quietSince >= IDLE_MS) return true;
  }
  return false;
}

function analyse(requests, t0, marks) {
  const rel = requests
    .map((r) => ({
      method: r.method,
      path: r.path,
      shape: shape(r.path.split('?')[0]),
      status: r.status,
      start: Math.round(r.start - t0),
      end: r.end === null ? null : Math.round(r.end - t0),
    }))
    .sort((a, b) => a.start - b.start);
  /* chain depth: one level deeper than the deepest call that had answered when this one started */
  for (const r of rel) {
    let level = 1;
    for (const q of rel) if (q !== r && q.end !== null && q.end <= r.start + 2) level = Math.max(level, (q.level ?? 1) + 1);
    r.level = level;
  }
  const waves = [];
  for (const r of rel) {
    const w = waves.at(-1);
    if (w && r.start - w.lastStart <= 120) {
      w.calls.push(r);
      w.lastStart = r.start;
    } else waves.push({ lastStart: r.start, calls: [r] });
  }
  const ready = marks.ready === null ? null : marks.ready - t0;
  const beforeReady = ready === null ? rel : rel.filter((r) => r.start <= ready);
  const counts = new Map();
  for (const r of rel) counts.set(`${r.method} ${r.path}`, (counts.get(`${r.method} ${r.path}`) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).map(([k, n]) => ({ request: k, times: n }));
  return {
    skeletonMs: marks.skeleton === null ? null : marks.skeleton - t0,
    shellMs: marks.shell === null ? null : marks.shell - t0,
    readyMs: ready,
    settledMs: rel.reduce((m, r) => Math.max(m, r.end ?? 0), 0),
    requests: rel.length,
    requestsBeforeReady: beforeReady.length,
    depth: rel.reduce((m, r) => Math.max(m, r.level), 0),
    depthBeforeReady: beforeReady.reduce((m, r) => Math.max(m, r.level), 0),
    duplicates,
    waves: waves.map((w) => ({
      start: w.calls[0].start,
      end: w.calls.reduce((m, c) => Math.max(m, c.end ?? 0), 0),
      calls: w.calls.length,
      slowest: w.calls.reduce((s, c) => ((c.end ?? 0) - c.start > (s.end ?? 0) - s.start ? c : s)).shape,
    })),
    waterfall: rel.map((r) => ({ start: r.start, end: r.end, level: r.level, status: r.status, method: r.method, path: shape(r.path) })),
  };
}

async function newContext(browser, storageState) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'cs-CZ', timezoneId: 'Europe/Prague', storageState });
  await context.addInitScript(MARKS_INIT);
  /* the live-like round trip: every API request waits DELAY ms before it leaves */
  await context.route((url) => isApi(url.href), async (route) => {
    await sleep(DELAY);
    await route.continue().catch(() => undefined);
  });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e.message).slice(0, 200)));
  const net = await recordNetwork(context, page);
  return { context, page, net };
}

const marksOf = (page) => page.evaluate(() => ({ ...window.__clubMarks }));

async function waitReady(page) {
  await page.waitForFunction(() => window.__clubMarks && window.__clubMarks.ready !== null, null, { timeout: 90000, polling: 50 });
}

async function runCold(browser, storageState, clubId) {
  const { context, page, net } = await newContext(browser, storageState);
  try {
    const t0 = Date.now();
    await page.goto(`${BASE}/clubs/${clubId}/kalendar`);
    await waitReady(page);
    await apiIdle(net);
    const marks = await marksOf(page);
    const cls = await page.evaluate(() => window.__cls());
    return { ...analyse(net.all(), t0, marks), cls: Math.round(cls * 1000) / 1000, errors: page.errors };
  } finally {
    await context.close();
  }
}

async function runNav(browser, storageState, clubId, hover) {
  const { context, page, net } = await newContext(browser, storageState);
  try {
    await page.goto(`${BASE}/clubs`);
    const card = page.locator('[role=listitem]').filter({ hasText: CLUB }).first();
    await card.waitFor({ timeout: 90000 });
    await apiIdle(net);
    await sleep(500);
    await apiIdle(net);
    net.clear();
    await page.evaluate(() => window.__clubMarksReset());
    let hoverAt = null;
    if (hover) {
      hoverAt = Date.now();
      await card.hover();
      await sleep(HOVER_MS);
    }
    const t0 = Date.now();
    await card.click();
    /* Stage 5a: the card opens the club's PAGE; the calendar is one more click (the button warms it when the pointer rests) */
    await page.waitForURL((u) => u.pathname === `/clubs/${clubId}`);
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 90000 });
    const pageMs = Date.now() - t0;
    if (hover) { await page.getByRole('link', { name: 'Kalendář' }).hover(); await sleep(HOVER_MS); }
    const t1 = Date.now();
    await page.getByRole('link', { name: 'Kalendář' }).click();
    await page.waitForURL((u) => u.pathname === `/clubs/${clubId}/kalendar`);
    await waitReady(page);
    await apiIdle(net);
    const marks = await marksOf(page);
    const cls = await page.evaluate(() => window.__cls());
    return { ...analyse(net.all(), t0, marks), pageMs, calendarMs: Date.now() - t1, hoverLeadMs: hoverAt === null ? 0 : t0 - hoverAt, cls: Math.round(cls * 1000) / 1000, errors: page.errors };
  } finally {
    await context.close();
  }
}

const unwrap = (b) => (b && typeof b === 'object' && 'data' in b && !('id' in b) ? b.data : b);
const differing = (a, b) => [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]));

/**
 * What the screen could take from an answer it already has (raw JSON of the dev API, read-only):
 *   orders   does a row of `club-orders?clubId=` carry what `club-orders/{id}` returns? (fields that differ)
 *   filtered is `club-orders?clubId=` the unfiltered `club-orders` filtered by club? (same rows, same content)
 *   club     does the `/api/clubs` row carry what `/api/clubs/{id}` returns?
 */
async function compareAnswers(page, clubId) {
  const rows = unwrap((await api(page, 'GET', `/api/v1/club-orders?clubId=${clubId}`)).json) ?? [];
  const orders = [];
  for (const row of rows) {
    const single = unwrap((await api(page, 'GET', `/api/v1/club-orders/${row.id}`)).json);
    orders.push({ id: row.id.slice(0, 8), status: row.status, differs: differing(row, single), listHistory: Array.isArray(row.history) ? row.history.length : null, singleHistory: Array.isArray(single?.history) ? single.history.length : null });
  }
  const all = unwrap((await api(page, 'GET', '/api/v1/club-orders')).json) ?? [];
  const mine = all.filter((o) => o.clubId === clubId);
  const filtered = {
    sameIds: JSON.stringify(mine.map((o) => o.id)) === JSON.stringify(rows.map((o) => o.id)),
    sameContent: JSON.stringify(mine) === JSON.stringify(rows),
    rowsFiltered: rows.length,
    rowsOfUnfiltered: mine.length,
  };
  const clubs = unwrap((await api(page, 'GET', '/api/clubs?activeOnly=false')).json);
  const listed = (Array.isArray(clubs) ? clubs : (clubs?.value ?? clubs?.items ?? [])).find((c) => c.id === clubId);
  const one = (await api(page, 'GET', `/api/clubs/${clubId}`)).json;
  return { orders, filtered, club: { differs: differing(listed, one) } };
}

const browser = await launch();
try {
  const boot = await browser.newContext({ viewport: VIEWPORT, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
  const bootPage = await boot.newPage();
  await login(bootPage);
  const clubs = (await api(bootPage, 'GET', '/api/clubs')).json;
  const club = (Array.isArray(clubs) ? clubs : clubs.data).find((c) => c.name === CLUB);
  if (!club) throw new Error(`club "${CLUB}" not found`);
  const listVsSingle = await compareAnswers(bootPage, club.id);
  console.log('answers:', JSON.stringify({ orderFieldsDiffer: [...new Set(listVsSingle.orders.flatMap((o) => o.differs))], filtered: listVsSingle.filtered, club: listVsSingle.club }));
  if (process.env.COMPARE_ONLY) process.exit(0);
  const storageState = await boot.storageState();
  await boot.close();

  const result = { label: LABEL, base: BASE, delayMs: DELAY, runs: RUNS, viewport: VIEWPORT, club: CLUB, at: new Date().toISOString(), listVsSingle, variants: {} };
  for (const variant of VARIANTS) {
    const run = () => (variant === 'cold' ? runCold(browser, storageState, club.id) : runNav(browser, storageState, club.id, variant === 'nav-hover'));
    await run(); /* warm-up: the dev server compiles what the screen needs */
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      runs.push(await run());
      await sleep(800);
    }
    const pick = (k) => median(runs.map((r) => r[k]));
    const summary = {
      readyMs: pick('readyMs'),
      shellMs: pick('shellMs'),
      skeletonMs: pick('skeletonMs'),
      settledMs: pick('settledMs'),
      requests: pick('requests'),
      requestsBeforeReady: pick('requestsBeforeReady'),
      depth: pick('depth'),
      depthBeforeReady: pick('depthBeforeReady'),
      waves: median(runs.map((r) => r.waves.length)),
      duplicateRuns: runs.filter((r) => r.duplicates.length > 0).length,
      cls: median(runs.map((r) => Math.round(r.cls * 1000))) / 1000,
    };
    result.variants[variant] = { summary, runs };
    console.log(`${LABEL} ${variant}: ready ${summary.readyMs} ms (shell ${summary.shellMs}, settled ${summary.settledMs}), ${summary.requests} API (${summary.requestsBeforeReady} before ready), depth ${summary.depth} (${summary.depthBeforeReady} before ready), waves ${summary.waves}, runs with duplicates ${summary.duplicateRuns}/${RUNS}`);
    const dups = runs.flatMap((r) => r.duplicates.map((d) => shape(d.request)));
    if (dups.length) console.log('  duplicates:', [...new Set(dups)].join(' | '));
  }
  const file = `${OUT}/speed-${LABEL}.json`;
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log('written', file);
} finally {
  await browser.close();
}
