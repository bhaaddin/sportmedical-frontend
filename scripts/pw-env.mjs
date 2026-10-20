/*
 * Finds a playwright-core and a Chromium on this machine, for the scripts that drive their OWN headless browser
 * (never the shared browser pane). Same lookup as scripts/accent-check.mjs; set PLAYWRIGHT_CORE / CHROME_PATH to override.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    'playwright-core',
    'playwright',
    'C:/Users/Matko/Jarvis-WorkOS/frontend/node_modules/playwright-core',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const spec = c.includes('/') || c.includes('\\') ? pathToFileURL(join(resolve(c), 'index.js')).href : c;
      const mod = await import(spec);
      const pw = mod.default ?? mod;
      if (pw.chromium) return pw;
    } catch {
      /* next candidate */
    }
  }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE=<path to the playwright-core folder>.');
}

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const p = join(base, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found. Set CHROME_PATH.');
}

/** Metrics collected inside the page: LCP, CLS (without input), long tasks. Installed with addInitScript. */
export const METRICS_INIT = `
(() => {
  const m = { lcp: 0, cls: 0, longTasks: [], fcp: 0 };
  window.__m = m;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) m.longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  } catch (e) {}
})();
`;
