import { launch, newPage, login, setTheme, jpg, waitPlanner } from './lib.mjs';
const [, , mode = 'light', size = 'desktop', ...routes] = process.argv;
const browser = await launch();
const page = await newPage(browser, size);
await login(page);
await setTheme(page, mode);
for (const r of routes) {
  await page.goto('http://localhost:3010' + r);
  await page.waitForTimeout(2500);
  if (r.includes('planovani') || r.includes('kalendar')) await waitPlanner(page).catch(() => {});
  await jpg(page, `peek-${mode}-${size}-${r.replace(/[^a-z0-9]+/gi, '_')}`);
}
console.log('errors', page.errors.slice(0, 5));
await browser.close();
