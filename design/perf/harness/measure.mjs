// usage: node measure.mjs <base> <out.json> <throttled|unthrottled> <runs> [scenario,scenario]
import fs from 'node:fs';
import { pw, CHROME, login } from './lib.mjs';
const [base, out, profile, runsArg, only] = process.argv.slice(2);
const RUNS = Number(runsArg || 3);
const FK = '942e2676-d730-4a13-8016-17f95abd26e2';
const S = [
  { id: 'home', path: '/', sel: 'h1', auth: false },
  { id: 'login', path: '/login', sel: 'form button[type=submit]', auth: false },
  { id: 'signin', path: '/login', sel: 'h1', auth: false, flow: 'signin', after: 'h1|Dobr' },
  { id: 'prehled', path: '/prehled', sel: 'h1|Dobr', auth: true },
  { id: 'planovani', path: '/planovani', sel: '[data-testid="board-body"]', auth: true },
  { id: 'clubs', path: '/clubs', sel: '[data-testid="club-card-billable"]', auth: true },
  { id: 'club-slany', path: `/clubs/${FK}`, sel: '[data-testid="board-body"]', auth: true },
  { id: 'patients', path: '/patients', sel: 'table tbody tr, [role=row] + [role=row]', auth: true },
  { id: 'objednat', path: '/objednat', sel: 'h1', auth: false },
  { id: 'prehled-warm', path: '/prehled', sel: 'h1|Dobr', auth: true, warm: true },
  { id: 'planovani-warm', path: '/planovani', sel: '[data-testid="board-body"]', auth: true, warm: true },
];
const wanted = only ? only.split(',') : S.map((s) => s.id);
const { chromium } = await pw();
const sess = await login(base);
const browser = await chromium.launch({ executablePath: CHROME });

function cat(url, type, mime) {
  const u = new URL(url);
  if (/^\/(api|hubs|health)/.test(u.pathname)) return 'api';
  if (type === 'Script' || /\.m?js$/.test(u.pathname)) return 'js';
  if (type === 'Stylesheet' || /\.css$/.test(u.pathname)) return 'css';
  if (type === 'Font' || /\.(woff2?|ttf)$/.test(u.pathname)) return 'font';
  if (type === 'Image' || /\.(png|jpe?g|webp|avif|svg|gif|ico)$/.test(u.pathname) || (u.hostname !== new URL(base).hostname && /image/.test(mime || ''))) return 'img';
  if (type === 'Document') return 'doc';
  return 'other';
}

async function setup(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (profile === 'throttled') {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 170, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (9 * 1024 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => { reqs.set(e.requestId, { url: e.request.url, type: e.type, t0: e.timestamp, raw: 0, enc: 0, status: 0, done: false }); });
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.fromCache = e.response.fromDiskCache || e.response.fromServiceWorker; } });
  cdp.on('Network.dataReceived', (e) => { const r = reqs.get(e.requestId); if (r) r.raw += e.dataLength; });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.enc = e.encodedDataLength; r.done = true; r.t1 = e.timestamp; } });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) { r.done = true; r.failed = true; r.t1 = e.timestamp; } });
  return { cdp, reqs };
}

const INIT = `(() => {
  const m = window.__m = { fcp: null, lcp: null, lcpEl: null, usable: null, long: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.lcp = e.startTime; m.lcpEl = e.element ? e.element.tagName + (e.element.className && typeof e.element.className === 'string' ? '.' + e.element.className.slice(0, 30) : '') : null; } }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) m.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  const busy = () => !!document.querySelector('.MuiSkeleton-root, .MuiCircularProgress-root, [aria-busy="true"]');
  const has = (sel) => { const [css, text] = sel.split('|'); const els = document.querySelectorAll(css); if (!text) return els.length > 0; return [...els].some((e) => e.textContent.includes(text)); };
  const check = () => { if (m.usable === null && window.__SEL__ && has(window.__SEL__) && !busy()) { m.usable = performance.now(); return true; } return false; };
  const start = () => { if (check()) return; const mo = new MutationObserver(() => { if (check()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); };
  if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once: true });
})()`;

function summarize(reqs, tStart, maxStartMs = Infinity) {
  const rows = [...reqs.values()].filter((r) => r.url.startsWith('http') && (r.t0 - tStart) * 1000 <= maxStartMs);
  const agg = {};
  for (const r of rows) {
    const c = cat(r.url, r.type, r.mime);
    const a = (agg[c] ??= { n: 0, raw: 0, enc: 0 });
    a.n += 1; a.raw += r.raw; a.enc += r.fromCache ? 0 : r.enc;
  }
  return {
    agg,
    list: rows.map((r) => {
      const u = new URL(r.url);
      return { url: u.pathname + u.search.slice(0, 40), cat: cat(r.url, r.type, r.mime), start: Math.round((r.t0 - tStart) * 1000), end: r.t1 ? Math.round((r.t1 - tStart) * 1000) : null, enc: r.enc, raw: r.raw, status: r.status, cache: !!r.fromCache };
    }),
  };
}

async function once(scenario) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', ignoreHTTPSErrors: true });
  if (scenario.auth) await ctx.addInitScript((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', s.user); localStorage.setItem('permissions', s.permissions); }, sess);
  const page = await ctx.newPage();
  if (process.env.SHOWERR) page.on('console', (m) => { if (m.type() === 'error') console.log('  [console error]', m.text().slice(0, 160)); });
  const { cdp, reqs } = await setup(ctx, page);
  await page.addInitScript(`window.__SEL__ = ${JSON.stringify(scenario.sel)};` + INIT);
  if (scenario.warm) {
    await page.goto(base + scenario.path, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__m && window.__m.usable !== null, null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    reqs.clear();
  }
  if (scenario.flow === 'signin') {
    await page.goto(base + scenario.path, { waitUntil: 'load' });
    await page.waitForSelector('input[type=password]');
    await page.waitForTimeout(6000);
    reqs.clear();
    await page.fill('input[type=email], input[name=email]', 'admin@sportmedical.cz');
    await page.fill('input[type=password]', process.env.SM_PW);
    await page.evaluate((after) => {
      const has = (sel) => { const [css, text] = sel.split('|'); const els = document.querySelectorAll(css); if (!text) return els.length > 0; return [...els].some((e) => e.textContent.includes(text)); };
      window.__f = { t0: performance.now(), usable: null, long: [] };
      const m = window.__f;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) m.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask' });
      const mo = new MutationObserver(() => { if (location.pathname === '/prehled' && has(after) && !document.querySelector('.MuiSkeleton-root, .MuiCircularProgress-root, [aria-busy="true"]') && m.usable === null) { m.usable = performance.now(); mo.disconnect(); } });
      mo.observe(document, { childList: true, subtree: true });
    }, scenario.after);
    await page.click('form button[type=submit]');
    await page.waitForFunction(() => window.__f.usable !== null, null, { timeout: 90000 });
    await page.waitForTimeout(3000);
    const f = await page.evaluate(() => window.__f);
    const firstReq = Math.min(...[...reqs.values()].map((r) => r.t0));
    const { agg, list } = summarize(reqs, firstReq);
    await ctx.close();
    const tbt = f.long.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return { fcp: null, lcp: null, usable: f.usable - f.t0, tbt, tbtAll: tbt, longCount: f.long.length, agg, crit: agg, list };
  }
  await page.goto(base + scenario.path, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__m && window.__m.usable !== null, null, { timeout: 90000 }).catch(() => {});
  let idleSince = null; const dead = Date.now() + 25000;
  while (Date.now() < dead) {
    const pending = [...reqs.values()].filter((r) => !r.done && !/hubs/.test(r.url)).length;
    if (pending === 0) { idleSince ??= Date.now(); if (Date.now() - idleSince > 1000) break; } else idleSince = null;
    await page.waitForTimeout(100);
  }
  const m = await page.evaluate(() => window.__m).catch(() => null);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { load: n.loadEventEnd } : null; }).catch(() => null);
  const firstReq = Math.min(...[...reqs.values()].map((r) => r.t0));
  const { agg, list } = summarize(reqs, firstReq);
  const crit = summarize(reqs, firstReq, (m?.usable ?? 1e9)).agg;
  await ctx.close();
  const usable = m?.usable ?? null;
  const tbtTo = (end) => m.long.filter(([s]) => m.fcp !== null && s >= m.fcp - 1 && s < end).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
  return { fcp: m?.fcp, lcp: m?.lcp, lcpEl: m?.lcpEl, usable, tbt: usable && m ? tbtTo(usable) : null, tbtAll: m ? tbtTo(1e9) : null, longCount: m?.long.length, load: nav?.load, agg, crit, list };
}

const med = (a) => { const v = a.filter((x) => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
const result = {};
for (const sc of S.filter((s) => wanted.includes(s.id))) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    try { runs.push(await once(sc)); } catch (e) { console.log(sc.id, 'run failed', String(e).slice(0, 200)); }
  }
  if (!runs.length) continue;
  const mid = runs[Math.floor(runs.length / 2)];
  const cats = ['js', 'css', 'font', 'img', 'doc', 'api', 'other'];
  const agg = {};
  for (const c of cats) agg[c] = { n: med(runs.map((r) => r.agg[c]?.n ?? 0)), raw: med(runs.map((r) => r.agg[c]?.raw ?? 0)), enc: med(runs.map((r) => r.agg[c]?.enc ?? 0)) };
  const critAgg = {};
  for (const c of cats) critAgg[c] = { n: med(runs.map((r) => r.crit[c]?.n ?? 0)), raw: med(runs.map((r) => r.crit[c]?.raw ?? 0)), enc: med(runs.map((r) => r.crit[c]?.enc ?? 0)) };
  const critTotal = { n: med(runs.map((r) => Object.values(r.crit).reduce((a, x) => a + x.n, 0))), raw: med(runs.map((r) => Object.values(r.crit).reduce((a, x) => a + x.raw, 0))), enc: med(runs.map((r) => Object.values(r.crit).reduce((a, x) => a + x.enc, 0))) };
  const total = { n: med(runs.map((r) => r.list.length)), raw: med(runs.map((r) => Object.values(r.agg).reduce((a, x) => a + x.raw, 0))), enc: med(runs.map((r) => Object.values(r.agg).reduce((a, x) => a + x.enc, 0))) };
  result[sc.id] = { crit: { agg: critAgg, total: critTotal }, fcp: med(runs.map((r) => r.fcp)), lcp: med(runs.map((r) => r.lcp)), usable: med(runs.map((r) => r.usable)), tbt: med(runs.map((r) => r.tbt)), tbtAll: med(runs.map((r) => r.tbtAll)), longCount: med(runs.map((r) => r.longCount)), load: med(runs.map((r) => r.load)), agg, total, lcpEl: mid.lcpEl, sample: mid.list, all: runs.map((r) => ({ fcp: r.fcp, lcp: r.lcp, usable: r.usable, tbt: r.tbt })) };
  const f = (x) => (x == null ? '  -  ' : String(Math.round(x)).padStart(5));
  const r = result[sc.id];
  console.log(`${sc.id.padEnd(15)} [${profile}] fcp ${f(r.fcp)} lcp ${f(r.lcp)} usable ${f(r.usable)} tbt ${f(r.tbt)} | req ${total.n} js ${(agg.js.enc / 1024).toFixed(0)}kB(br) raw ${(agg.js.raw / 1024).toFixed(0)}kB css ${(agg.css.enc / 1024).toFixed(0)} font ${(agg.font.enc / 1024).toFixed(0)} img ${(agg.img.enc / 1024).toFixed(0)} api ${agg.api.n} total ${(total.enc / 1024).toFixed(0)}kB`);
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
