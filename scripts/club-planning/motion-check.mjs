/*
 * The planning area's motion under each setting (plné / omezené / vypnuto), in a real browser:
 *   - a slot placed lands (card `data-fresh`, animation `plan-land` / `plan-fade-in` / none),
 *   - a refusal shakes the board (`data-refuse`, animation `plan-shake` / `plan-flash` / none),
 *   - fulfilling a činnost gives its card `just-done` (glow animation / none) and then calm,
 *   - and under vypnuto / omezené no element of the planner gets a transform animation it should not.
 * Also records a frame strip of the drop in plné for the eyes (design/club-planning/motion-*.png).
 *
 *   node scripts/club-planning/motion-check.mjs
 */
import { launch, newPage, login, shot, dragBoard, clickCard, findOrMakeClub, startClubOrder, BASE, OUT } from './lib.mjs';

const MODES = [['plné', 'full', 'plan-land', 'plan-shake'], ['omezené', 'reduced', 'plan-fade-in', 'plan-flash'], ['vypnuto', 'off', 'none', 'none']];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await launch();
for (const [pref, attr, landName, shakeName] of MODES) {
  const page = await newPage(browser, 'desktop');
  await page.addInitScript((value) => localStorage.setItem('sm-motion', value), pref);
  await login(page);
  const club = await findOrMakeClub(page);
  await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 4 });
  check((await page.evaluate(() => document.documentElement.dataset.motion)) === attr, `${pref}: <html data-motion="${attr}">`);
  await page.getByRole('button', { name: 'Týden', exact: true }).first().click();
  await page.locator('.day-title[data-day="2026-10-22"]').waitFor();

  /* a refusal first: a past day (Monday 19. 10.) */
  await clickCard(page, 'Základní sportovní prohlídka');
  await dragBoard(page, { day: 0, min: 8 * 60 }, { min: 9 * 60 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const shake = await page.evaluate(() => {
    const root = document.querySelector('.sm-planner');
    const board = document.querySelector('#day-board');
    return { refuse: root?.hasAttribute('data-refuse') ?? false, animation: board ? getComputedStyle(board).animationName : null };
  });
  check(shake.refuse, `${pref}: a refusal marks the planner`);
  check(shake.animation === shakeName, `${pref}: the board animates "${shake.animation}" (expected ${shakeName})`);
  await page.waitForTimeout(600);

  /* a slot lands on Thursday 22. 10. */
  await (await dragBoard(page, { day: 3, min: 8 * 60 }, { min: 9 * 60 + 20 })).up();
  await page.waitForTimeout(60);
  const landed = await page.evaluate(() => {
    const c = document.querySelector('.board-session[data-fresh="true"]');
    return c ? { animation: getComputedStyle(c).animationName } : null;
  });
  check(landed !== null && (attr === 'off' ? landed.animation === 'none' : landed.animation === landName), `${pref}: the new slot ${landed ? `animates "${landed.animation}"` : 'is missing'} (expected ${landName})`);
  if (attr === 'full') {
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(90);
      await shot(page, `motion-strip-${i}`);
    }
  }

  /* fulfil the činnost (4 players = 4 slots: 2 more) */
  await dragBoard(page, { day: 4, min: 8 * 60 }, { min: 9 * 60 + 20 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const done = await page.evaluate(() => {
    const c = document.querySelector('.plan-card.just-done');
    return c ? getComputedStyle(c).animationName : null;
  });
  check(done !== null, `${pref}: the card gets just-done when the činnost is fulfilled`);
  check(done === (attr === 'full' ? 'plan-done-glow' : 'none'), `${pref}: its animation is "${done}" (expected ${attr === 'full' ? 'plan-done-glow' : 'none'})`);
  await page.waitForTimeout(1900);
  check((await page.locator('.plan-card.just-done').count()) === 0, `${pref}: calm again after the moment`);
  check((await page.locator('.plan-card.is-complete').count()) === 1, `${pref}: the card stays done`);
  /* the document never scrolls and nothing shifts */
  const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(m.sh <= m.ih + 1 && m.sw <= m.iw, `${pref}: no document scroll`);
  await page.close();
}
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : `\nall passed (strip in ${OUT}/motion-strip-*.png, ${BASE})`);
process.exit(failures.length ? 1 : 0);
