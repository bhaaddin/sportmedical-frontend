/*
 * R18 - the hard limits of the new Přehled, measured in a real browser (our own headless Chromium) at 390x844, 820x1180,
 * 1440x900 and 1920x1080, on a busy week (the two lists answered in the page, see mock.mjs), a quiet one and a failing one,
 * dark and light. Writes design/stage4/overview-check.json and exits 1 when a limit is broken.
 *
 *   limits (the owner's rule R18):  desktop <= 7 elements above the fold, phone <= 5; no document scroll; <= 1 chart;
 *   <= 3 colours besides text; AA contrast; 44px targets. The fit region may scroll on a phone only if the content is taller
 *   than the window - reported, and the busy-week phone run is required not to.
 *
 * Run: BASE=http://localhost:3008 node scripts/stage4/overview-check.mjs      (BASE=http://localhost:3009 TAG=before for the old one)
 */
import { writeFileSync } from 'node:fs';
import { launch, newPage, login, api, jpg, SIZES4 } from './lib.mjs';
import { MEASURE } from './metrics.mjs';
import { mockOverview } from './mock.mjs';

const OUT = process.env.OUT ?? 'design/stage4';
const TAG = process.env.TAG ?? 'after';
const before = TAG === 'before';
const results = [];
const failures = [];
const browser = await launch();

for (const mode of before ? ['real'] : ['full', 'quiet', 'fail', 'light']) {
  for (const [sizeName, size] of Object.entries(SIZES4)) {
    const page = await newPage(browser, size);
    await login(page);
    if (mode === 'light') await page.evaluate(() => localStorage.setItem('sm-theme-mode-v2', 'light'));
    if (!before) {
      const j = (await api(page, 'GET', '/api/patients?pageSize=8&page=1')).json;
      await mockOverview(page, Array.isArray(j) ? j : (j?.data?.items ?? j?.items ?? []), mode === 'light' ? 'full' : mode);
    }
    await page.goto(`${process.env.BASE}/prehled`);
    await page.waitForSelector(before ? '[data-shelf-page]' : '[data-overview]');
    await page.waitForTimeout(3500);
    const m = await page.evaluate(MEASURE);
    await jpg(page, `${TAG}-prehled-${mode}-${size.width}x${size.height}`);
    const errors = page.errors.filter((e) => !e.includes('403') && !(mode === 'fail' && e.includes('500')));
    const row = { mode, size: `${size.width}x${size.height}`, ...m, consoleErrors: errors.slice(0, 3) };
    results.push(row);
    console.log(mode.padEnd(6), row.size.padEnd(9), `elements=${m.elements}`, JSON.stringify(m.parts), `chrome=${m.chrome}`, `charts=${m.charts}`, `colours=${m.colours.length}`, `docScroll=${m.docScroll}`, `region=${m.fitRegionScroll}`, `contrast=${m.contrastWorst.ratio}/${m.contrastWorst.need}`, `small=${m.smallTargets.length}`);

    if (!before) {
      const phone = size.width <= 767;
      const limit = phone ? 5 : 7;
      const check = (ok, what) => { if (!ok) failures.push(`${mode} ${row.size}: ${what}`); };
      check(m.elements <= limit, `${m.elements} elements above the fold (limit ${limit})`);
      check(m.docScroll === 0 && m.hOverflow === 0, `document scrolls (${m.docScroll}, ${m.hOverflow})`);
      check(m.charts <= 1, `${m.charts} charts`);
      check(m.colours.length <= 3, `${m.colours.length} colours: ${m.colours.join(', ')}`);
      check(m.contrastWorst.adj >= 1, `contrast ${m.contrastWorst.ratio} < ${m.contrastWorst.need} on "${m.contrastWorst.text}"`);
      check(m.smallTargets.length === 0, `targets under 44px: ${m.smallTargets.join('; ')}`);
      check(errors.length === 0, `console errors: ${errors.join(' | ')}`);
      if (phone && mode === 'full') check((m.fitRegionScroll ?? 0) <= 0, `the busy phone screen scrolls inside its region by ${m.fitRegionScroll}px`);
    }
    await page.context().close();
  }
}
await browser.close();

writeFileSync(`${OUT}/overview-check${before ? '-before' : ''}.json`, JSON.stringify({ tag: TAG, at: new Date().toISOString(), failures, results }, null, 1));
if (failures.length > 0) {
  console.log('\nLIMITS BROKEN:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exitCode = 1;
} else if (!before) {
  console.log('\nall limits hold');
}
