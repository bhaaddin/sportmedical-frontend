/* R1 + R3 in the real app: the toolbar filter lists služby (deduplicated, with the price) and filters by them; the sidebar has no "Všechny termíny" tab. */
import './env.mjs';
import { launch, newPage, login, shot, waitPlanner, BASE } from '../reviewer-bugs/lib.mjs';
const size = process.argv[2] ?? 'desktop';
const label = process.argv[3] ?? 'after';
const b = await launch();
const page = await newPage(b, size);
await login(page);
await page.goto(BASE + '/planovani');
await waitPlanner(page);
await page.waitForTimeout(1500);
const sel = page.locator('#activity-filter');
console.log(`[${size}] options:`, JSON.stringify(await sel.locator('option').allInnerTexts()));
console.log(`[${size}] sr label:`, (await page.locator('.filter-select .sr-only').innerText()));
const cardsBefore = await page.locator('.plan-card, .week-event, [data-booking-id], .booking-card').count();
const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value));
for (const v of opts.slice(1)) {
  await sel.selectOption(v);
  await page.waitForTimeout(600);
  const n = await page.locator('[data-booking-id], .booking-card, .board-booking').count();
  console.log(`[${size}] filter ${v.slice(0, 8)} -> bookings drawn ${n}`);
}
await sel.selectOption('all');
const tabs = await page.locator('button:has-text("Všechny termíny")').count();
console.log(`[${size}] "Všechny termíny" buttons:`, tabs);
console.log(`[${size}] sidebar tabs:`, JSON.stringify(await page.locator('[data-agenda-mode], .agenda-tabs button, #agenda-tabs button').allInnerTexts()));
await shot(page, `r1-${label}-${size}`);
await b.close();
