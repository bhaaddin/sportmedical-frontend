/* Screenshots (small JPEGs) of the Barvy page and the planner with a tint, light and dark, desktop and phone; also document-scroll / overflow / 44 px checks. */
import { launch, newPage, login, setTheme, jpg, waitPlanner, BASE } from './lib.mjs';
const browser = await launch();
for (const size of ['desktop', 'tablet', 'phone']) {
  const page = await newPage(browser, size);
  await login(page);
  for (const mode of ['light', 'dark']) {
    await setTheme(page, mode, '#2563EB');
    await page.goto(BASE + '/nastaveni/barvy-sluzeb');
    await page.waitForSelector('#barvy-planovac', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll('button, [role=button], input:not([type=hidden]), select, a')].filter((e) => e.getClientRects().length).map((e) => ({ r: e.getBoundingClientRect(), t: (e.getAttribute('aria-label') || e.innerText || '').slice(0, 30) })).filter((x) => x.r.width < 43.5 || x.r.height < 43.5);
      const main = document.querySelector('main#main-content, main');
      return { docScroll: document.documentElement.scrollHeight > innerHeight + 1, hOverflow: document.documentElement.scrollWidth > innerWidth + 1, small: small.slice(0, 6).map((x) => `${x.t}|${Math.round(x.r.width)}x${Math.round(x.r.height)}`), mainScrolls: main ? main.scrollHeight > main.clientHeight + 1 : null };
    });
    console.log(size, mode, JSON.stringify(m));
    await jpg(page, `barvy-${size}-${mode}`, 40);
  }
  await page.context().close();
}
await browser.close();
