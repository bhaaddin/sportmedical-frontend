/* R19: the new shell on a few screens at the four sizes. Screenshots in design/stage4. */
import { launch, newPage, login, jpg, facts, SIZES4 } from './lib.mjs';
const pages = (process.env.PAGES ?? 'patients,settings,planovani,billing').split(',');
const sizes = (process.env.SIZES ?? 'desktop,tablet').split(',');
const browser = await launch();
for (const name of sizes) {
  const size = SIZES4[name];
  const page = await newPage(browser, size);
  await login(page);
  for (const p of pages) {
    await page.goto(process.env.BASE + '/' + p);
    await page.waitForTimeout(3500);
    await jpg(page, `shell-${p}-${size.width}x${size.height}`);
    console.log(name, p, JSON.stringify(await facts(page)), page.errors.filter((e) => !e.includes('403')).slice(0, 2));
  }
  await page.context().close();
}
await browser.close();
