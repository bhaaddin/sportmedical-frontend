/*
 * Public-site load performance under mobile throttling, measured in our own headless Chromium
 * (CDP: CPU x4, Slow 4G = 1.6 Mbit/s, 150 ms RTT - Lighthouse's "mobile" preset).
 *
 *     node scripts/motion-perf.mjs                       # BASE=http://localhost:4300 PATHS=/ RUNS=5
 *     env: BASE  PATHS=/,/sluzby  RUNS=5  OUT=design/motion/perf-after.json  DESKTOP=1 (no throttling, 1440x900)
 *
 * Reports the median of RUNS cold loads: FCP, LCP, CLS, total blocking time (long tasks - 50 ms, after FCP),
 * the bytes of JS fetched until the load event, and the number of JS files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRICS_INIT, findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:4300';
const PATHS = (process.env.PATHS ?? '/').split(',');
const RUNS = Number(process.env.RUNS ?? 5);
const DESKTOP = process.env.DESKTOP === '1';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
};

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true });
const report = { base: BASE, mode: DESKTOP ? 'desktop' : 'mobile-slow4g-cpu4x', runs: RUNS, pages: {} };

for (const path of PATHS) {
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const context = await browser.newContext(
      DESKTOP
        ? { viewport: { width: 1440, height: 900 } }
        : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    );
    await context.addInitScript(METRICS_INIT);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (!DESKTOP) {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    let jsBytes = 0;
    let jsFiles = 0;
    const scripts = new Set();
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived', (e) => { if (e.type === 'Script') { scripts.add(e.requestId); jsFiles += 1; } });
    cdp.on('Network.loadingFinished', (e) => { if (scripts.has(e.requestId)) jsBytes += e.encodedDataLength; });
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => window.__m);
    const tbt = m.longTasks.filter(([start]) => start >= m.fcp).reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0);
    samples.push({ fcp: m.fcp, lcp: m.lcp, cls: m.cls, tbt, jsBytes, jsFiles });
    await context.close();
  }
  report.pages[path] = {
    fcp: Math.round(median(samples.map((s) => s.fcp))),
    lcp: Math.round(median(samples.map((s) => s.lcp))),
    cls: Number(median(samples.map((s) => s.cls)).toFixed(4)),
    tbt: Math.round(median(samples.map((s) => s.tbt))),
    jsBytes: Math.round(median(samples.map((s) => s.jsBytes))),
    jsFiles: Math.round(median(samples.map((s) => s.jsFiles))),
    samples,
  };
  const p = report.pages[path];
  console.log(`${path.padEnd(12)} FCP ${p.fcp} ms  LCP ${p.lcp} ms  CLS ${p.cls}  TBT ${p.tbt} ms  JS ${(p.jsBytes / 1024).toFixed(0)} kB / ${p.jsFiles} files`);
}
await browser.close();
if (process.env.OUT) {
  const out = resolve(root, process.env.OUT);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`wrote ${out}`);
}
