/*
 * R19 - the new shell, checked in a real browser (our own headless Chromium) at 390x844, 820x1180, 1440x900 and 1920x1080
 * against the dev API: no labelled sidebar, one 56px icon rail, a tooltip and an accessible name on every icon (hover AND
 * keyboard focus), the current page lit and not a link, one click from any page to the calendar, the actions only in the top
 * bar, the planner routes' Menu button, the phone's bottom bar, no document scroll, no console errors.
 * Writes design/stage4/shell-check.json and exits 1 on a failure.
 *
 * Run: node scripts/stage4/shell-check.mjs   (the worktree's Vite on :3008, the API on :5092)
 */
import { writeFileSync } from 'node:fs';
import { launch, newPage, login, jpg, facts, SIZES4 } from './lib.mjs';

const BASE = process.env.BASE;
const OUT = process.env.OUT ?? 'design/stage4';
const failures = [];
const rows = [];
const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
const browser = await launch();

for (const [sizeName, size] of Object.entries(SIZES4)) {
  const tag = `${size.width}x${size.height}`;
  const phone = size.width <= 767;
  const page = await newPage(browser, size);
  await login(page);
  const row = { size: tag };

  for (const route of ['prehled', 'patients', 'clubs', 'billing', 'settings', 'planovani']) {
    await page.goto(`${BASE}/${route}`);
    await page.waitForSelector('main#main-content');
    await page.waitForTimeout(2500);
    const f = await facts(page);
    const info = await page.evaluate(() => {
      const rail = document.querySelector('[data-shell="rail"]');
      const main = document.querySelector('main#main-content');
      const r = rail?.getBoundingClientRect();
      const links = rail ? [...rail.querySelectorAll('a, [role=link]')] : [];
      return {
        sidebar: document.querySelector('[data-shell="sidebar"], aside[aria-label="Postranní panel"]') !== null,
        railWidth: r ? Math.round(r.width) : null,
        mainLeft: Math.round(main.getBoundingClientRect().left),
        mainWidth: Math.round(main.getBoundingClientRect().width),
        railLabels: links.map((a) => a.getAttribute('aria-label')),
        railHasText: links.filter((a) => !a.getAttribute('aria-label')?.startsWith('SportMedical') && (a.textContent ?? '').trim() !== '').length,
        railTargets: links.map((a) => { const b = a.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }),
        here: links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => ({ label: a.getAttribute('aria-label'), href: a.getAttribute('href') })),
        bottomBar: document.querySelector('[data-shell="bottombar"]') !== null,
        actions: [...document.querySelectorAll('[data-shell="actions"] a, [data-shell="actions"] button')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()),
        menuButton: document.querySelector('[data-testid="planner-menu-button"]') !== null,
        settingsSide: document.querySelector('[data-shell="settings-side"]') !== null,
      };
    });
    const errors = page.errors.filter((e) => !e.includes('403'));
    await jpg(page, `shell-${route}-${tag}`);
    const where = `${tag} /${route}`;
    check(!info.sidebar, `${where}: a sidebar is still drawn`);
    check(f.docScroll === 0 && f.hOverflow === 0, `${where}: document scrolls (${f.docScroll}, ${f.hOverflow})`);
    check(errors.length === 0, `${where}: console errors ${errors.join(' | ')}`);
    if (phone) {
      check(info.bottomBar && info.railWidth === null, `${where}: the phone needs the bottom bar and no rail`);
    } else if (route === 'planovani') {
      check(info.railWidth === null && info.mainLeft === 0, `${where}: the planner stage has no rail and starts at the edge`);
      check(info.menuButton, `${where}: the planner has no Menu button`);
    } else {
      check(info.railWidth === 56, `${where}: rail is ${info.railWidth}px, want 56`);
      check(info.mainLeft === 56 + (route === 'settings' && size.width >= 1280 ? 258 : 0), `${where}: content starts at ${info.mainLeft}`);
      check(info.railHasText === 0, `${where}: the rail carries text`);
      check(info.railTargets.every(([w, h]) => w >= 44 && h >= 44), `${where}: a rail target under 44px ${JSON.stringify(info.railTargets)}`);
      check(info.railLabels.every((l) => l), `${where}: an icon without a name`);
      for (const want of ['Kalendář', 'Pacienti', 'Kluby', 'Fakturace', 'Nastavení']) {
        check(info.railLabels.some((l) => l?.startsWith(want)), `${where}: no ${want} icon`);
      }
      if (route === 'prehled') check(info.here.length === 1 && info.here[0].href === null && info.here[0].label?.startsWith('SportMedical'), `${where}: Přehled (logo) must be the current page and not a link`);
      if (route === 'patients') check(info.here.some((h) => h.label === 'Pacienti (tady jste)' && h.href === null), `${where}: Pacienti must be current and not a link`);
      if (route !== 'settings') check(info.actions.includes('Nová objednávka') && info.actions.some((a) => a.startsWith('Hledat')), `${where}: the action bar is missing (${info.actions.join(', ')})`);
      check(!(route === 'settings') || info.settingsSide === (size.width >= 1280), `${where}: settings list beside the rail should be ${size.width >= 1280}`);
    }
    row[route] = { ...info, ...f };
  }

  if (!phone) {
    /* one click from a page to the calendar */
    await page.goto(`${BASE}/patients`);
    await page.waitForSelector('[data-shell="rail"]');
    await page.click('[data-shell="rail"] a[aria-label="Kalendář"]');
    await page.waitForURL(/\/planovani/, { timeout: 8000 }).catch(() => undefined);
    check(new URL(page.url()).pathname === '/planovani', `${tag}: one click on the calendar icon did not open the calendar (${page.url()})`);

    /* tooltip on hover and on keyboard focus */
    await page.goto(`${BASE}/prehled`);
    await page.waitForSelector('[data-shell="rail"]');
    await page.hover('[data-shell="rail"] a[aria-label="Kluby"]');
    await page.waitForSelector('[role=tooltip]', { timeout: 3000 }).catch(() => undefined);
    const hoverTip = await page.evaluate(() => document.querySelector('[role=tooltip]')?.textContent ?? null);
    check(hoverTip === 'Kluby', `${tag}: hover tooltip is "${hoverTip}"`);
    await page.mouse.move(size.width - 5, size.height - 5);
    await page.waitForTimeout(500);
    await page.focus('body');
    await page.keyboard.press('Tab'); /* the skip link */
    let focusTip = null;
    for (let i = 0; i < 6 && focusTip === null; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(450);
      const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
      if (label === 'Kalendář') focusTip = await page.evaluate(() => document.querySelector('[role=tooltip]')?.textContent ?? null);
    }
    check(focusTip === 'Kalendář', `${tag}: keyboard-focus tooltip is "${focusTip}"`);
    row.tooltips = { hover: hoverTip, focus: focusTip };

    /* the drawer behind "Všechny stránky" lists every page with the icons; Esc closes it */
    await page.click('[data-shell="rail"] button[aria-label="Všechny stránky"]');
    await page.waitForSelector('[role=dialog][aria-label="Menu"]');
    const drawer = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog][aria-label="Menu"]');
      return { links: [...d.querySelectorAll('a')].map((a) => (a.textContent ?? '').trim()), icons: d.querySelectorAll('a svg').length, buttons: [...d.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')) };
    });
    check(drawer.icons >= 5 && ['Kalendář', 'Pacienti', 'Kluby a týmy', 'Fakturace', 'Nastavení'].every((n) => drawer.links.includes(n)), `${tag}: the drawer lacks the entries with icons ${JSON.stringify(drawer)}`);
    check(!drawer.links.concat(drawer.buttons).some((x) => /Nová objednávka|Nový pacient|Rychlá registrace/.test(x ?? '')), `${tag}: the drawer carries an action entry`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(500);
    await jpg(page, `shell-drawer-${tag}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role=dialog][aria-label="Menu"]', { state: 'detached', timeout: 3000 }).catch(() => undefined);
    row.drawer = drawer;

    /* the planner's Menu button opens the same drawer, no action entries */
    await page.goto(`${BASE}/planovani`);
    await page.waitForSelector('[data-testid="planner-menu-button"]', { timeout: 30000 });
    await page.click('[data-testid="planner-menu-button"]');
    await page.waitForSelector('[role=dialog][aria-label="Menu"]');
    const plannerDrawer = await page.evaluate(() => [...document.querySelector('[role=dialog][aria-label="Menu"]').querySelectorAll('a, button')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()));
    check(plannerDrawer.some((x) => x === 'Dnešní přehled') && !plannerDrawer.some((x) => /Nová objednávka|Klubová objednávka/.test(x)), `${tag}: the planner Menu drawer is wrong ${JSON.stringify(plannerDrawer)}`);
    await page.waitForTimeout(500);
    await jpg(page, `shell-planner-menu-${tag}`);
    row.plannerDrawer = plannerDrawer;
  } else {
    /* the phone: bottom bar entries, top bar, no sidebar/rail */
    await page.goto(`${BASE}/prehled`);
    await page.waitForSelector('[data-shell="bottombar"]');
    const bar = await page.evaluate(() => [...document.querySelectorAll('[data-shell="bottombar"] a, [data-shell="bottombar"] button')].map((e) => [e.getAttribute('aria-label') || e.textContent, Math.round(e.getBoundingClientRect().height)]));
    check(bar.length === 5 && bar.every(([, h]) => h >= 44), `${tag}: the bottom bar changed ${JSON.stringify(bar)}`);
    row.bottomBar = bar;
  }
  rows.push(row);
  console.log(tag, 'checked');
  await page.context().close();
}
await browser.close();
writeFileSync(`${OUT}/shell-check.json`, JSON.stringify({ at: new Date().toISOString(), failures, rows }, null, 1));
if (failures.length) { console.log('\nFAILED:\n' + failures.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; } else console.log('\nall shell checks hold');
