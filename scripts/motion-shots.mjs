/*
 * Scrolls the public home like a visitor and photographs it. Own headless Chromium (never the shared browser pane).
 *
 *     node scripts/motion-shots.mjs
 *     env: BASE=http://localhost:4300   PATHS=/            OUT_DIR=design/motion   VP=390x844,1440x900
 *          STOPS=8 (scroll positions per viewport)         MODE=plné|omezené|vypnuto (stored motion setting)
 *          NAME=home (file prefix)                          STRIP=1 (frame strip of the first second)
 *
 * Per viewport it saves   <NAME>-<w>x<h>-s00.png ... sNN.png   (scroll positions, evenly spaced over the page),
 *                          <NAME>-<w>x<h>-strip.png            (hero frames from the first navigation, STRIP=1),
 * and asserts for every position: no horizontal overflow, and for the whole visit: no console error / page error,
 * CLS below 0.1. It exits 1 when one of those fails. The hero sequence is also recorded as a .webm in OUT_DIR/video.
 */
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRICS_INIT, findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:4300';
const PATHS = (process.env.PATHS ?? '/').split(',');
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'motion'));
const VPS = (process.env.VP ?? '390x844,1440x900').split(',').map((v) => v.split('x').map(Number));
const STOPS = Number(process.env.STOPS ?? 8);
const MODE = process.env.MODE ?? '';
const NAME = process.env.NAME ?? 'home';
const STRIP = process.env.STRIP !== '0';
mkdirSync(join(OUT, 'video'), { recursive: true });

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const failures = [];
const log = (message) => console.log(message);

for (const path of PATHS) {
  const slug = path === '/' ? NAME : `${NAME}-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`;
  for (const [width, height] of VPS) {
    const phone = width < 768;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: phone,
      hasTouch: phone,
      recordVideo: { dir: join(OUT, 'video', 'tmp'), size: { width, height } },
    });
    await context.addInitScript(METRICS_INIT);
    if (MODE) await context.addInitScript(`try{localStorage.setItem('sm-motion', ${JSON.stringify(MODE)})}catch(e){}`);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    // Frame strip: a CDP screencast delivers a frame whenever the page repaints, so the first second of the hero is caught
    // at the browser's own rate (a screenshot loop managed two frames a second on this machine).
    const frames = [];
    const started = Date.now();
    const cdp = await context.newCDPSession(page);
    if (STRIP) {
      cdp.on('Page.screencastFrame', (event) => {
        frames.push({ t: Date.now() - started, data: event.data });
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined);
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
    }
    await page.goto(`${BASE}${path}`, { waitUntil: 'commit' });
    if (STRIP) {
      await page.waitForTimeout(2600);
      await cdp.send('Page.stopScreencast').catch(() => undefined);
    }
    await page.waitForLoadState('load');
    await page.waitForTimeout(3200); // idle: scenes, Lenis and the shader arrive

    if (frames.length > 0) {
      // up to 8 frames spread over the first 2.4 s, always including the last one
      const early = frames.filter((f) => f.t <= 2400);
      const picked = early.length <= 8 ? early : Array.from({ length: 8 }, (_, i) => early[Math.round((i * (early.length - 1)) / 7)]);
      frames.length = 0;
      frames.push(...picked);
      const sheet = await context.newPage();
      const cell = Math.round(Math.min(360, width / 2));
      await sheet.setViewportSize({ width: cell * Math.min(4, frames.length), height: Math.ceil(frames.length / 4) * Math.round((cell * height) / width) + 8 });
      await sheet.setContent(
        `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,${cell}px);gap:2px">${frames
          .map((f) => `<div style="position:relative"><img style="width:${cell}px;display:block" src="data:image/jpeg;base64,${f.data}"><span style="position:absolute;left:6px;top:6px;font:12px sans-serif;color:#fff;background:#0009;padding:2px 5px">${f.t} ms</span></div>`)
          .join('')}</body>`,
      );
      await sheet.screenshot({ path: join(OUT, `${slug}-${width}x${height}-strip.png`) });
      await sheet.close();
    }

    const atLoad = await page.evaluate(() => ({ lcp: window.__m.lcp, cls: window.__m.cls }));
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const lenis = await page.evaluate(() => document.documentElement.classList.contains('lenis'));
    const scene = await page.evaluate(() => Array.from(document.querySelectorAll('[data-scene]')).map((e) => e.getAttribute('data-scene')));
    log(`${path} ${width}x${height}: document ${total}px, lenis ${lenis}, scenes ${JSON.stringify(scene)}, data-motion ${await page.evaluate(() => document.documentElement.dataset.motion)}`);
    // A visitor's scroll: wheel notches (touch: swipes) down the whole page and back to the top; this is the CLS measurement.
    await page.mouse.move(width / 2, height / 2);
    for (let y = 0; y < total; y += 380) {
      if (phone) await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), 380);
      else await page.mouse.wheel(0, 380);
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(700);
    const afterScroll = await page.evaluate(() => window.__m.cls);
    const maxScroll = Math.max(1, total - height);
    for (let i = 0; i < STOPS; i += 1) {
      const y = Math.round((maxScroll * i) / (STOPS - 1));
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: 'instant' }), y);
      await page.waitForTimeout(1100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) failures.push(`${path} ${width}x${height} s${i}: horizontal overflow ${overflow}px`);
      await page.screenshot({ path: join(OUT, `${slug}-${width}x${height}-s${String(i).padStart(2, '0')}.png`) });
    }
    // A visitor's click on a link of the header: the curtain between two public pages (View Transitions), mid-way and done.
    if (path === '/' && !phone && process.env.NAV !== '0') {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(500);
      await page.locator('header nav a[href="/cenik"]').first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `${slug}-${width}x${height}-nav-mid.png`) });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: join(OUT, `${slug}-${width}x${height}-nav-end.png`) });
      if (!page.url().endsWith('/cenik')) failures.push(`${path} ${width}x${height}: the click on Ceník ended at ${page.url()}`);
    }
    const m = await page.evaluate(() => window.__m);
    log(`   CLS at load ${atLoad.cls.toFixed(4)}, after a wheel scroll of the whole page ${afterScroll.toFixed(4)}, after the jumps ${m.cls.toFixed(4)}  LCP ${Math.round(atLoad.lcp)} ms  errors ${errors.length}`);
    if (afterScroll >= 0.1) failures.push(`${path} ${width}x${height}: CLS ${afterScroll} after scrolling like a visitor`);
    for (const e of errors) failures.push(`${path} ${width}x${height}: console error: ${e.slice(0, 200)}`);
    const video = page.video();
    await context.close();
    try {
      const file = await video.path();
      renameSync(file, join(OUT, 'video', `${slug}-${width}x${height}.webm`));
    } catch { /* no video */ }
  }
}
await browser.close();
writeFileSync(join(OUT, `${NAME}-check.json`), JSON.stringify({ at: new Date().toISOString(), base: BASE, failures }, null, 2));
if (failures.length > 0) {
  console.error('\nFAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
log('motion-shots: ok');
