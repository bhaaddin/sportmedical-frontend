import { launch, newPage, login, shot, toasts, findOrMakeClub, startClubOrder } from './lib.mjs';
const size = process.argv[2] ?? 'desktop';
const b = await launch();
const p = await newPage(b, size);
await login(p);
const dayEl = (d) => p.locator('.month-tile[data-day="' + d + '"], [data-testid="phone-month-day-' + d + '"]').first();
const club = await findOrMakeClub(p);
await startClubOrder(p, club.id, { 'Základní sportovní prohlídka': 30, 'Komplexní sportovní prohlídka': 12 });
await p.getByRole('button', { name: 'Měsíc', exact: true }).first().click();
await p.waitForTimeout(800);
await shot(p, `x-month-${size}-0`);
// plain click on a whole day: Thursday 22. 10.
await dayEl("2026-10-22").click();
await p.waitForTimeout(1500);
await shot(p, `x-month-${size}-1`);
console.log('after click', await toasts(p));
// plain click on a past day and on a weekend
await dayEl("2026-10-19").click();
await p.waitForTimeout(800);
console.log('past', await toasts(p));
await dayEl("2026-10-24").click();
await p.waitForTimeout(800);
console.log('weekend', await toasts(p));
// drag over 3 days
const a = await dayEl('2026-10-27').boundingBox();
const c = await dayEl('2026-10-29').boundingBox();
await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await p.mouse.down();
await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(1800);
await shot(p, `x-month-${size}-2`);
console.log('after drag', await toasts(p));
console.log(p.errors);
await b.close();
