/* R2 + R6 reproduction on the real stack: calendar selector, a holiday week (week of 28 Oct 2026), month tile, phone. */
import { launch, newPage, login, shot, waitPlanner, BASE } from './lib.mjs';
const size = process.argv[2] ?? 'desktop';
const label = process.argv[3] ?? 'before';
const b = await launch();
const page = await newPage(b, size);
await login(page);
await page.goto(BASE + '/planovani');
await waitPlanner(page);
await page.waitForTimeout(1500);
console.log(`[${size}] chips:`, JSON.stringify(await page.locator('.calendar-chip').allInnerTexts()));
await shot(page, `r2-${label}-${size}-week`);
// go to the holiday week: 28.10.2026
for (let i = 0; i < 1; i++) { await page.click('[data-command=nextWeek]'); await page.waitForTimeout(900); }
await page.waitForTimeout(1500);
await shot(page, `r6-${label}-${size}-holiday-week`);
console.log(`[${size}] heading:`, await page.locator('#week-range').innerText());
await page.click('[data-view=month]').catch(() => {});
await page.waitForTimeout(1500);
await shot(page, `r6-${label}-${size}-month`);
console.log('errors', page.errors.slice(0, 5));
await b.close();
