/* Stage 3a real-app check of the main calendar (/planovani): R20 a/b/c + the legend, at 390 / 820 / 1100 / 1440 / 1920. Prints PASS/FAIL lines. */
import { launch, login, OUT } from './lib.mjs';
const SIZES = [[320, 640], [360, 780], [390, 844], [820, 1180], [1100, 800], [1440, 900], [1920, 1080]];
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
const browser = await launch();
for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 1280, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await login(page);
  await page.goto(process.env.BASE + '/planovani');
  await page.waitForSelector('[data-testid="calendar-strip"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const tag = `${width}`;
  // R20c: chips
  const chips = await page.$$eval('[data-testid="calendar-strip"] .calendar-chip', (els) => els.map((e) => ({ t: e.textContent.trim(), icon: !!e.querySelector('svg use'), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width, pressed: e.getAttribute('aria-pressed') })));
  check(chips.length >= 3 && chips.every((c) => c.icon), `${tag} c: every calendar chip has an icon (${chips.map((c) => c.t).join(' / ')})`);
  check(await page.$eval('.calendar-strip-label', (e) => e.textContent.trim()) === 'Kalendáře', `${tag} c: the row is called Kalendáře`);
  check((await page.$('#activity-filter')) === null, `${tag} c: no Všechny služby dropdown (#activity-filter)`);
  if (width < 1280) check(chips.every((c) => c.h >= 44 && c.w >= 44), `${tag} c: chips >= 44 px (${chips.map((c) => Math.round(c.h) + 'x' + Math.round(c.w)).join(' ')})`);
  const first = page.locator('[data-testid="calendar-strip"] .calendar-chip').first();
  await first.click();
  const afterOne = await page.$$eval('[data-testid="calendar-strip"] .calendar-chip', (els) => els.map((e) => e.getAttribute('aria-pressed')));
  check(afterOne[0] === 'true' && afterOne.slice(1).every((p) => p === 'false'), `${tag} c: one click selects only that calendar (${afterOne.join(',')})`);
  await page.locator('[data-testid="calendar-strip"] .calendar-chip').nth(1).click();
  const afterTwo = await page.$$eval('[data-testid="calendar-strip"] .calendar-chip', (els) => els.map((e) => e.getAttribute('aria-pressed')));
  check(afterTwo[0] === 'true' && afterTwo[1] === 'true', `${tag} c: a second click adds a calendar (${afterTwo.join(',')})`);
  await page.screenshot({ path: `${OUT}/r20c-${tag}.png` });
  await page.locator('[data-testid="calendar-chip-all"]').click();
  const all = await page.$eval('[data-testid="calendar-chip-all"]', (e) => e.getAttribute('aria-pressed'));
  check(all === 'true', `${tag} c: "Všechny" selects everything again`);
  // R20b: nothing under the mini calendar
  if (width >= 1000) {
    // the sidebar is visible (desktop stage, or the pinned tablet column)
    check((await page.$('#agenda-panel')) === null, `${tag} b: no agenda panel (Činnosti pills / card / term list) under the mini calendar`);
  } else {
    const open = page.locator('button:has-text("Kalendář a termíny")').first();
    await open.click();
    await page.waitForTimeout(700);
    check((await page.$('#agenda-panel')) === null, `${tag} b: no agenda panel in the sheet / drawer`);
  }
  // legend not clipped, mini calendar fills its column
  const geo = await page.evaluate(() => {
    const mc = document.querySelector('.mini-calendar'); const sb = document.querySelector('.sidebar');
    if (!mc || !sb) return null;
    const mr = mc.getBoundingClientRect(); const sr = sb.getBoundingClientRect();
    const leg = [...document.querySelectorAll('.spectrum-legend span')].map((s) => s.getBoundingClientRect());
    const legBox = document.querySelector('.spectrum-legend').getBoundingClientRect();
    return { mcBottom: mr.bottom, sbBottom: sr.bottom, sbTop: sr.top, legRight: Math.max(...leg.map((r) => r.right)), boxRight: legBox.right, mcRight: mr.right, legBottom: Math.max(...leg.map((r) => r.bottom)),
      sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight };
  });
  check(geo && geo.legRight <= geo.mcRight + 0.5, `${tag}: legend inside the calendar's right edge (${geo && Math.round(geo.legRight)} <= ${geo && Math.round(geo.mcRight)})`);
  check(geo && geo.sw <= geo.iw && geo.sh <= geo.ih + 1, `${tag}: document does not scroll (${geo && geo.sw}x${geo && geo.sh} in ${width}x${height})`);
  if (width >= 1280 || (width >= 1000)) check(geo && geo.sbBottom - geo.legBottom < 40, `${tag} b: no empty band under the legend (${geo && Math.round(geo.sbBottom - geo.legBottom)} px)`);
  await page.screenshot({ path: `${OUT}/r20b-${tag}.png` });
  // R20a: the liquid moves (only checked where the sidebar is on screen)
  if (width >= 1000) {
    const info = await page.evaluate(async () => {
      const layers = [...document.querySelectorAll('#mini-days .liquid-layer')];
      const crest = (l) => getComputedStyle(l, '::before').transform;
      const a = layers.slice(0, 6).map(crest);
      await new Promise((r) => setTimeout(r, 500));
      const b = layers.slice(0, 6).map(crest);
      return { n: layers.length, moved: a.some((v, i) => v !== b[i]), running: document.getAnimations().filter((x) => x.playState === 'running').length, live: document.querySelector('#mini-days').dataset.liquid };
    });
    check(info.n > 0 && info.moved && info.live === 'live', `${tag} a: liquid bands (${info.n}) animate (crest transform changes in 500 ms, ${info.running} animations running)`);
    // motion settings
    for (const mode of ['off', 'reduced']) {
      await page.evaluate((m) => document.documentElement.setAttribute('data-motion', m), mode);
      const still = await page.evaluate(async () => {
        const layers = [...document.querySelectorAll('#mini-days .liquid-layer')].slice(0, 6);
        const a = layers.map((l) => getComputedStyle(l, '::before').transform);
        await new Promise((r) => setTimeout(r, 400));
        return layers.every((l, i) => getComputedStyle(l, '::before').transform === a[i]) && document.getAnimations().filter((x) => x.playState === 'running' && x.effect?.target?.closest?.('#mini-days')).length === 0;
      });
      check(still, `${tag} a: motion "${mode}" -> the liquid is still`);
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'full'));
  } else {
    const live = await page.$eval('#mini-days', (e) => e.dataset.liquid);
    console.log(`INFO  ${tag} a: sheet is open, liquid=${live}`);
  }
  check(errors.length === 0, `${tag}: no page errors ${errors.join('|')}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
