/* The Přehled of Stage 3 (the "before"): run it on the commit before the redesign. */
import { launch, newPage, login, jpg, facts, SIZES4 } from './lib.mjs';
const tag = process.env.TAG ?? 'before';
const browser = await launch();
for (const [name, size] of Object.entries(SIZES4)) {
  const page = await newPage(browser, size);
  await login(page);
  await page.goto(process.env.BASE + '/prehled');
  await page.waitForTimeout(4000);
  await jpg(page, `${tag}-prehled-${size.width}x${size.height}`);
  console.log(name, JSON.stringify(await facts(page)), page.errors.filter((e) => !e.includes('403')).slice(0, 2));
  await page.context().close();
}
await browser.close();
