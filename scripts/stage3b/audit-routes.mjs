/*
 * Contrast audit over the main staff routes in both modes (R15e): for each route, in dark and light, the text / icon /
 * control contrast of everything in the viewport, plus "the document never scrolls" and "no horizontal overflow".
 *
 *   node scripts/stage3b/audit-routes.mjs [--accents] [--sizes=desktop,phone] [--out=file.json]
 *
 * Default: dark + light with the default accent at desktop. --accents repeats light and dark for the six accents.
 */
import { writeFileSync } from 'node:fs';
import { launch, newPage, login, setTheme, ACCENTS, api, jpg, waitPlanner, BASE } from './lib.mjs';
import { auditRegion, summarise } from './audit-lib.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const sizes = (flag('sizes') ?? 'desktop').split(',');
const withAccents = args.includes('--accents');
const shots = args.includes('--shots');
const out = flag('out');

const browser = await launch();
const results = [];
for (const size of sizes) {
  const page = await newPage(browser, size);
  if (args.includes('--baseline')) await page.route(/planner\.light/, (r) => r.abort()); /* the state before the light layer existed */
  await login(page);
  const clubs = (await api(page, 'GET', '/api/clubs')).json ?? [];
  const club = clubs[0];
  const routes = [
    ['planovani', '/planovani', true],
    ['prehled', '/prehled', false],
    ['pacienti', '/patients', false],
    ['kluby', '/clubs', false],
    ...(club ? [['klub', `/clubs/${club.id}`, false], ['klub-kalendar', `/clubs/${club.id}/kalendar`, true]] : []),
    ['nastaveni', '/settings', false],
    ['barvy-sluzeb', '/nastaveni/barvy-sluzeb', false],
    ['vzhled-kalendare', '/nastaveni/vzhled-kalendare', false],
    ['pokladna', '/cashier', false],
  ];
  const combos = [];
  for (const mode of ['dark', 'light']) {
    if (withAccents) for (const [k, hex] of ACCENTS) combos.push([mode, k, hex]);
    else combos.push([mode, 'forest', '#0D5C52']);
  }
  for (const [mode, accentKey, hex] of combos) {
    for (const [name, path, planner] of routes) {
      await setTheme(page, mode, hex);
      await page.goto(BASE + path);
      if (planner) await waitPlanner(page).catch(() => {});
      else await page.waitForTimeout(1800);
      await page.waitForTimeout(400);
      const items = await auditRegion(page, 'body', { viewportOnly: true });
      const s = summarise(items);
      const layout = await page.evaluate(() => ({ docScroll: document.documentElement.scrollHeight > innerHeight + 1, hOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      results.push({ size, mode, accent: accentKey, route: name, ...layout, counts: { text: s.text, icon: s.icon, control: s.control, total: s.total, failed: s.failed }, fails: s.fails.slice(0, 40) });
      if (shots) await jpg(page, `route-${size}-${mode}-${accentKey}-${name}`, 45);
      console.log(`${size} ${mode} ${accentKey} ${name}: text ${s.text.failed}/${s.text.checked}  icon ${s.icon.failed}/${s.icon.checked}  control ${s.control.failed}/${s.control.checked}${layout.docScroll ? '  DOC-SCROLL' : ''}${layout.hOverflow ? '  H-OVERFLOW' : ''}`);
    }
  }
  await page.context().close();
}
const totals = results.reduce((a, r) => ({ text: a.text + r.counts.text.failed, icon: a.icon + r.counts.icon.failed, control: a.control + r.counts.control.failed }), { text: 0, icon: 0, control: 0 });
console.log('TOTAL failures', totals);
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
await browser.close();
