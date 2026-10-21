/*
 * 2.3 - clicking a club in the clubs list: where does it land? Reproduces the reviewer's recording: the clubs list, a click on a
 * club card, then what is on the stage (planning mode or the club's overview) at the three layouts.
 * Usage: node r23.mjs [desktop|tablet|phone] [tag]    BASE=http://localhost:3000 for the unchanged app
 */
import { launch, newPage, login, shot, waitPlanner, BASE, buttons } from './lib.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const CLUB = process.argv[4] ?? 'FK Slaný';
const b = await launch();
const page = await newPage(b, size);
await login(page);
await page.goto(BASE + '/clubs');
await page.waitForTimeout(2500);
await shot(page, `${tag}-2.3-${size}-0-clubs-list`);
console.log('list buttons:', (await buttons(page)).filter((x) => /club|klub|FK|SK|ZZ/i.test(x)).slice(0, 12).join(' || '));
await page.getByText(CLUB, { exact: true }).first().click();
await waitPlanner(page);
await page.waitForTimeout(1500);
console.log('url:', new URL(page.url()).pathname + new URL(page.url()).search);
const state = await page.evaluate(() => ({
  mode: document.querySelector('[data-testid=planner-page]')?.getAttribute('data-mode'),
  deckEmpty: !!document.querySelector('[data-testid=deck-empty-new], [data-testid^=deck-empty]'),
  planningDeck: !!document.querySelector('.planning-carousel, [data-testid=planning-carousel], #planning-carousel'),
  overview: !!document.querySelector('[data-testid^=club-overview]'),
  ids: [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => /deck|plan|club|order|overview|switcher/i.test(t)).slice(0, 30),
}));
console.log(JSON.stringify(state));
await shot(page, `${tag}-2.3-${size}-1-after-click`);
const overview = await page.getByTestId('club-overview-deck').count();
console.log('no document scroll:', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), '| console errors:', page.errors.filter((e) => !/403/.test(e)).length);
console.log('overview deck:', overview ? 'YES (club interface first)' : 'no (planning opened at once)');
if (overview) {
  console.log('actions:', JSON.stringify(await page.getByTestId('club-overview-actions').locator('button').allInnerTexts()));
  console.log('planning chrome visible:', await page.evaluate(() => !!document.querySelector('[data-testid=summary-card]')));
  await page.getByTestId('ov-plan-terms').click();
  await page.waitForTimeout(2500);
  console.log('after "Plánovat termíny" url:', new URL(page.url()).search, '| planning deck:', await page.getByTestId('planning-carousel').count(), '| overview deck:', await page.getByTestId('club-overview-deck').count());
  await shot(page, `${tag}-2.3-${size}-2-planning`);
}
await b.close();
