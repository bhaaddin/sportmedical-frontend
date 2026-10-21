/*
 * 2.2 - the day by činnost. Needs the seeded week (node seed.mjs): Thursday 10. 12. 2026 has six komplexní prohlídky, Monday 7. 12.
 * four základní + two komplexní + one spiroergometrie. For each place that SUMMARISES a day it prints how many lines it takes:
 * before the fix one per booking, after one per činnost with the count.
 * Usage: node r22.mjs [desktop|tablet|phone] [tag]      BASE=http://localhost:3000 for the "before" run on the unchanged app
 */
import { launch, newPage, shot } from './lib.mjs';
import { setTheme, openPlanner, seedDay, weeksToSeed } from './flows.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const THU = seedDay(3), MON = seedDay(0);
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, 'dark', 'forest');
await openPlanner(page, weeksToSeed());
const out = (label, value) => console.log(`[${size}] ${label}: ${value}`);
const text = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()), sel);

if (size !== 'phone') {
  /* 1. the left mini calendar's day flyout */
  if (size === 'desktop') {
    await page.hover(`[data-testid=mini-day-${THU}]`); await page.waitForTimeout(900);
    out('mini flyout, Thu 10. 12.', JSON.stringify(await text('.tday-event')));
    out('mini flyout height px', await page.evaluate(() => Math.round(document.getElementById('mini-day-tooltip').getBoundingClientRect().height)));
    await shot(page, `${tag}-2.2-${size}-1-mini-flyout`);
    await page.mouse.move(700, 700); await page.waitForTimeout(500);
  }
  /* 2. the agenda lists of the left panel */
  await page.click(`[data-testid=mini-day-${THU}]`).catch(() => {});
  await page.waitForTimeout(500);
  const chips = await page.locator('.agenda-chip').count();
  out('agenda činnost chips', chips);
  await page.locator('.agenda-chip', { hasText: 'Komplexní sportovní' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  out('agenda rows of the činnost', JSON.stringify((await text('.agenda-term')).slice(0, 8)));
  await shot(page, `${tag}-2.2-${size}-2-agenda`);
  /* 3. the day list */
  await page.getByRole('button', { name: 'Den', exact: true }).first().click(); await page.waitForTimeout(900);
  out('Den list lines', (await text('#alternate-view .alt-row')).length + ' -> ' + JSON.stringify((await text('#alternate-view .alt-row')).slice(0, 6)));
  await shot(page, `${tag}-2.2-${size}-3-day-list`);
  /* 4. the month */
  await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(900);
  out('month tile Thu', JSON.stringify(await page.evaluate((d) => document.querySelector(`.month-tile[data-day="${d}"]`)?.innerText.replace(/\s+/g, ' '), THU)));
  out('month tile Mon', JSON.stringify(await page.evaluate((d) => document.querySelector(`.month-tile[data-day="${d}"]`)?.innerText.replace(/\s+/g, ' '), MON)));
  await shot(page, `${tag}-2.2-${size}-4-month`);
  /* 5. the day panel (Rezervační centrum): the mini calendar is only on the desktop stage */
  if (size === 'desktop') {
  await page.getByRole('button', { name: 'Týden', exact: true }).first().click(); await page.waitForTimeout(500);
  await page.click(`[data-testid=mini-day-${THU}]`); await page.waitForTimeout(700);
  const obs = page.locator('[data-tooltip-reservations]').first();
  if (await obs.count()) { await obs.click(); await page.waitForTimeout(900); await page.locator('[data-drawer-tab=bookings]').first().click().catch(() => {}); await page.waitForTimeout(500);
    out('day panel cards', JSON.stringify(await text('[data-testid=rd-event-card]')));
    out('day panel record lines', (await text('[data-testid=rd-record], [data-testid=rd-fold]')).length);
    await shot(page, `${tag}-2.2-${size}-5-day-panel`); } }
} else {
  await page.getByRole('button', { name: 'Den', exact: true }).first().click(); await page.waitForTimeout(500);
  await page.click(`[data-testid=phone-strip-${THU}]`).catch(async () => { /* the strip shows the selected week */ });
  await page.waitForTimeout(700);
  out('phone agenda entries', JSON.stringify((await text('.phone-entry')).slice(0, 6)));
  await shot(page, `${tag}-2.2-${size}-1-agenda`);
  await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(700);
  out('phone month Thu', JSON.stringify(await page.evaluate((d) => document.querySelector(`[data-testid=phone-month-day-${d}]`)?.innerText.replace(/\s+/g, ' '), THU)));
  await shot(page, `${tag}-2.2-${size}-2-month`);
}
await b.close();
