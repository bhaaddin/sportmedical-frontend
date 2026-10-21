/*
 * 2.1 - booking from a click / drag on the EMPTY day of the week board (event path, no patient needed): choose a činnost
 * and look for a LIST of predefined times. Before the fix: any chosen minute the server did not list (lunch, closing,
 * a finer board step) showed the notice plus up to 36 time buttons. After: never a list, one nearest offer at most.
 * Usage: node scripts/reviewer-bugs/r21.mjs [desktop|tablet|phone] [tag]   (tag names the screenshots: before / after)
 */
import { launch, newPage, login, shot, waitPlanner, boardRect, dayX, minuteY, BASE } from './lib.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const WEEKS = 4, DAY = 3;
const CASES = [{ m: 540, what: 'offered 09:00' }, { m: 690, what: '11:30 crosses the lunch' }, { m: 1050, what: '17:30 crosses closing' }];
const b = await launch();
let failed = 0;
for (const c of CASES) {
  const page = await newPage(b, size);
  await login(page);
  await page.goto(BASE + '/planovani');
  await waitPlanner(page);
  for (let i = 0; i < WEEKS; i++) { await page.getByRole('button', { name: 'Následující týden' }).click(); await page.waitForTimeout(200); }
  await page.waitForTimeout(1500);
  const r = await boardRect(page);
  let x = dayX(r, DAY);
  if (size !== 'desktop') {
    /* phone / tablet: one day at a time - take Thursday from the strip, click inside the visible column */
    await page.getByRole('button', { name: /19. 11./ }).first().click();
    await page.waitForTimeout(500);
    x = page.viewportSize().width * 0.6;
  }
  const y = minuteY(await boardRect(page), c.m);
  if (y > page.viewportSize().height - 40) { console.log(size, c.what, '=> skipped (below the fold of the board scroller on this layout)'); await page.close(); continue; }
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  await page.getByText('Objednat pacienta', { exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByText('Jen zablokovat čas bez pacienta').first().click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.waitForTimeout(700);
  await page.locator('[aria-labelledby=new-appointment-title]').getByText('Základní sportovní').first().click();
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby=new-appointment-title]')].map((d) => (d.innerText || '').replace(/\s+/g, ' ')).join(' || '));
  const list = /Volné začátky/.test(text);
  const timeField = await page.getByLabel('Čas od').count();
  const verdict = (list ? 'LIST SHOWN' : 'no list') + ', ' + (timeField ? 'time field shown' : 'no time field');
  console.log(size, c.what, '=>', verdict);
  if (tag === 'after' && (list || timeField)) failed++;
  await shot(page, `${tag}-2.1-${size}-${c.m}`);
  await page.close();
}
await b.close();
if (failed) { console.error('FAILED', failed); process.exit(1); }
