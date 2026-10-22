/* R2 in the real app: chips are služby; one click = one služba, two = two columns per day, činnosti as pills inside; "Všechny" resets. */
import { launch, newPage, login, shot, waitPlanner, BASE } from './lib.mjs';
const size = process.argv[2] ?? 'desktop';
const label = process.argv[3] ?? 'after';
const b = await launch();
const page = await newPage(b, size);
await login(page);
await page.goto(BASE + '/planovani');
await waitPlanner(page);
await page.waitForTimeout(1500);
const chips = page.locator('.calendar-chip:not(.is-all)');
const names = await chips.allInnerTexts();
console.log(`[${size}] chips:`, JSON.stringify(names));
const cols = async () => page.evaluate(() => ({
  heads: [...document.querySelectorAll('.day-title')].slice(0, 1).map((d) => [...d.querySelectorAll('.day-calendars > *')].map((x) => x.textContent.trim())),
  subs: document.querySelector('.board-head')?.dataset.subs ?? '1',
  pills: [...document.querySelectorAll('.calendar-pill')].map((x) => x.textContent.trim()),
  pressed: [...document.querySelectorAll('.calendar-chip')].map((x) => x.getAttribute('aria-pressed')),
  all: !!document.querySelector('[data-testid=calendar-chip-all]'),
}));
console.log(`[${size}] start`, JSON.stringify(await cols()));
await chips.nth(1).click(); await page.waitForTimeout(900);
console.log(`[${size}] click 1`, JSON.stringify(await cols())); await shot(page, `r2-${label}-${size}-one`);
await chips.nth(0).click(); await page.waitForTimeout(900);
console.log(`[${size}] click 2`, JSON.stringify(await cols())); await shot(page, `r2-${label}-${size}-two`);
await chips.nth(2).click(); await page.waitForTimeout(900);
console.log(`[${size}] click 3`, JSON.stringify(await cols()));
await page.locator('[data-testid=calendar-chip-all]').click(); await page.waitForTimeout(700);
console.log(`[${size}] all`, JSON.stringify(await cols())); await shot(page, `r2-${label}-${size}-all`);
console.log('errors', page.errors.filter((e) => !e.includes('403')).slice(0, 5));
await b.close();
