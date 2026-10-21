/* 2.4 - booking / marking targets the calendar of the column: click a free place in each column of an empty day and read the calendar the booking bubble names. */
import { launch, newPage, shot, boardRect, minuteY } from './lib.mjs';
import { setTheme, openPlanner, dayLabel, seedDay, weeksToSeed } from './flows.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, 'dark', 'forest');
await openPlanner(page, weeksToSeed());
const chips = page.locator('.calendar-chip:not(.is-all)');
for (let i = 2; i < (await chips.count()); i++) await chips.nth(i).click();
await page.waitForTimeout(900);
let r = await boardRect(page);
const FRI = 4;
if (size !== 'desktop') { await page.getByRole('button', { name: new RegExp(dayLabel(seedDay(4))) }).first().click(); await page.waitForTimeout(500); r = await boardRect(page); }
const subs = Number(await page.evaluate(() => document.querySelector('#day-board').getAttribute('data-subs')));
const dayW = r.w / 7;
for (const sub of [0, 1]) {
  const x = size === 'desktop' ? r.x + FRI * dayW + (sub + 0.5) * (dayW / subs) : (page.viewportSize().width * (sub === 0 ? 0.3 : 0.75));
  await page.mouse.click(x, minuteY(r, 600));
  await page.waitForTimeout(500);
  await page.getByText('Objednat pacienta', { exact: true }).first().click();
  await page.waitForTimeout(800);
  const text = await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby=new-appointment-title]')].map((d) => d.innerText.replace(/\s+/g, ' ')).join(' '));
  console.log(`[${size}] column ${sub}: dialog names`, /Ordinace 1/.test(text) ? 'Ordinace 1' : /Diagnostika/.test(text) ? 'Diagnostika' : '?', '|', (text.match(/(\d{2}:\d{2}) — (\d{2}:\d{2})/) ?? [])[0] ?? '');
  await shot(page, `${tag}-2.4-${size}-2-click-column-${sub}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const d = page.getByRole('button', { name: /Zahodit|Zavřít/ }); if (await d.count()) await d.first().click().catch(() => {});
  await page.waitForTimeout(300);
}
await b.close();
