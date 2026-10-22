/* R18: the new Přehled, populated / quiet / failing, at the four sizes. Screenshots in design/stage4. */
import { launch, newPage, login, api, jpg, facts, SIZES4 } from './lib.mjs';
import { mockOverview } from './mock.mjs';
const modes = (process.env.MODES ?? 'full,quiet,fail').split(',');
const browser = await launch();
for (const mode of modes) {
  for (const [name, size] of Object.entries(SIZES4)) {
    const page = await newPage(browser, size);
    await login(page);
    const j = (await api(page, 'GET', '/api/patients?pageSize=8&page=1')).json;
    const patients = Array.isArray(j) ? j : (j?.data?.items ?? j?.items ?? []);
    await mockOverview(page, patients, mode);
    await page.goto(process.env.BASE + '/prehled');
    await page.waitForSelector('[data-overview]');
    await page.waitForTimeout(3500);
    await jpg(page, `after-prehled-${mode}-${size.width}x${size.height}`);
    console.log(mode, name, JSON.stringify(await facts(page)), page.errors.filter((e) => !e.includes('403')).slice(0, 2));
    await page.context().close();
  }
}
await browser.close();
