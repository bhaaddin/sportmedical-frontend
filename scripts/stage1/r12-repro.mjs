/* R12: the club summary's "Přehled všech činností" - are the činnosti drawn in their own colours, with prices? */
import { launch, newPage, login, api, shot, startClubOrder } from './lib.mjs';
const label = process.argv[2] ?? 'before';
const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const club = (await api(page, 'GET', '/api/clubs')).json.find((c) => c.name === 'ZZ test plánování');
await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 3, 'Komplexní sportovní prohlídka': 2, 'Spiroergometrické vyšetření': 1 });
await page.locator('.s42-summary-card:visible, #order-command:visible').first().click({ position: { x: 20, y: 20 } }).catch(() => {});
await page.waitForTimeout(800);
if (!(await page.locator('.s41-scene').count())) {
  await page.locator('text=DETAIL').first().click().catch(() => {});
  await page.waitForTimeout(800);
}
await page.locator('[data-s41-action=activities]').first().click();
await page.waitForTimeout(800);
const rows = await page.$$eval('.s41-detail-row', (els) => els.map((e) => ({
  name: e.querySelector('.s41-detail-name')?.textContent,
  tone: getComputedStyle(e).getPropertyValue('--tone'),
  dot: getComputedStyle(e.querySelector('.s41-detail-name i')).backgroundColor,
  bar: getComputedStyle(e.querySelector('.s41-detail-bar i')).backgroundColor,
  barImg: getComputedStyle(e.querySelector('.s41-detail-bar i')).backgroundImage.slice(0, 60),
  sub: e.querySelector('.s41-detail-sub')?.textContent,
})));
console.log(JSON.stringify(rows, null, 1));
console.log('money lines:', await page.$$eval('.s41-money-line', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' '))));
await shot(page, `r12-${label}`);
await browser.close();
