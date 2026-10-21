/*
 * 2.4 - the two calendars as two columns of every day (Main Planner only). Unticks the calendars to the first two with the
 * calendar selector, looks at the week of the seeded bookings (7.-11. 12. 2026) and checks: a chip per column, a card inside the
 * column of its own calendar, a click / drag on a column books THAT calendar. Usage: node r24.mjs [desktop|tablet|phone] [tag]
 * (BASE=http://localhost:3000 for the unchanged app: there is no selector and no split.)
 */
import { launch, newPage, shot, boardRect, BASE } from './lib.mjs';
import { setTheme, openPlanner } from './flows.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, 'dark', 'forest');
await openPlanner(page, 7);
const out = (k, v) => console.log(`[${size}] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
out('calendar selector chips', await page.locator('.calendar-chip').allInnerTexts());
out('day-calendar chips in the heading', await page.locator('.day-calendars').count());
await shot(page, `${tag}-2.4-${size}-0-all-calendars`);
// keep two calendars: hide the others with the selector
const chips = page.locator('.calendar-chip:not(.is-all)');
const n = await chips.count();
for (let i = 2; i < n; i++) await chips.nth(i).click();
await page.waitForTimeout(900);
out('columns per day', await page.evaluate(() => document.querySelector('#day-board')?.getAttribute('data-subs')));
out('heading chips of Wed', await page.evaluate(() => [...document.querySelectorAll('.day-title[data-day="2026-12-09"] .day-calendar')].map((e) => e.textContent)));
await shot(page, `${tag}-2.4-${size}-1-two-columns`);
// the cards of Wed sit in their own calendar's column
const geo = await page.evaluate(() => {
  const board = document.querySelector('#day-board').getBoundingClientRect();
  const col = 2, subs = Number(document.querySelector('#day-board').getAttribute('data-subs') || 1);
  const dayW = board.width / 7, subW = dayW / subs;
  return [...document.querySelectorAll('[data-booking-id]')].map((c) => { const r = c.getBoundingClientRect(); return { cal: c.getAttribute('aria-label')?.slice(0, 30), day: Math.floor((r.left - board.left) / dayW), sub: Math.floor(((r.left - board.left) % dayW) / subW) }; }).filter((x) => x.day === col);
});
out('Wednesday cards (day, column)', geo);
await b.close();
