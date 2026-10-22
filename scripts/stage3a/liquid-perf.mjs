/*
 * Cost of the moving liquid, in our own headless Chromium on /planovani: the same 4 s interaction (board zoom steps + wheel scroll
 * over the board) with the motion setting "plné" (waves) against "vypnuto" (still). CPU x4 throttled. Reports frame time
 * percentiles, frames over 50 ms and long tasks from the rAF loop and a PerformanceObserver.
 *   node scripts/stage3a/liquid-perf.mjs [width height]
 */
import { launch, login } from './lib.mjs';

const width = Number(process.argv[2] ?? 1440);
const height = Number(process.argv[3] ?? 900);
const browser = await launch();

async function run(mode) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(process.env.BASE + '/planovani');
  await page.waitForSelector('#mini-days .liquid-layer', { timeout: 30000 });
  await page.evaluate((m) => document.documentElement.setAttribute('data-motion', m), mode);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1000);
  const board = (await page.locator('.planner, #week-board').first().boundingBox()) ?? { x: width / 2, y: height / 2, width: 10, height: 10 };
  await page.evaluate(() => {
    window.__frames = [];
    window.__long = 0;
    try { new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask', buffered: false }); } catch { /* unsupported */ }
    let last = performance.now();
    const loop = (t) => { window.__frames.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
    await page.mouse.wheel(0, -240);
    await page.keyboard.press(Date.now() % 2 ? '+' : '-');
    await page.waitForTimeout(120);
  }
  const out = await page.evaluate(() => {
    window.__stop = true;
    const f = window.__frames.slice(5).sort((a, b) => a - b);
    const q = (p) => Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 10) / 10;
    return { frames: f.length, p50: q(0.5), p95: q(0.95), max: Math.round(f[f.length - 1]), over50: f.filter((x) => x > 50).length, longTasks: window.__long, anims: document.getAnimations().filter((a) => a.playState === 'running').length };
  });
  await ctx.close();
  return out;
}

for (const mode of ['off', 'full', 'off', 'full']) console.log(mode.padEnd(5), JSON.stringify(await run(mode)));
await browser.close();
