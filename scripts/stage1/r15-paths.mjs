/* R15a: the price appears the moment a činnost is picked, on every booking path of the main planner: board click, drag, the toolbar button. */
import './env.mjs';
import { launch, newPage, shot, boardRect, dayX, minuteY } from '../reviewer-bugs/lib.mjs';
import { openPlanner, clickBoard, BUBBLE } from '../reviewer-bugs/flows.mjs';
const size = process.argv[2] ?? 'desktop';
const b = await launch();
const page = await newPage(b, size);
await openPlanner(page);
const report = async (path) => {
  const bubble = page.locator(BUBBLE);
  await bubble.waitFor({ timeout: 8000 }).catch(() => {});
  // step 1 may ask what to book: choose "Jen zablokovat čas" like the other scripts (no patient needed)
  const block = page.getByText('Jen zablokovat čas bez pacienta').first();
  if (await block.count()) { await block.click(); await page.getByRole('button', { name: 'Pokračovat' }).click(); await page.waitForTimeout(600); }
  await bubble.getByText('Komplexní sportovní').first().click();
  await page.waitForTimeout(1200);
  const val = await bubble.getByLabel('Cena').inputValue().catch(() => 'NO FIELD');
  const totalTxt = (await bubble.innerText()).match(/Celkem k úhradě\s*([^\n]+)/)?.[1] ?? '?';
  console.log(`[${size}] ${path}: Cena field=${val} total=${totalTxt}`);
  await shot(page, `r15-path-${path}-${size}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const drop = page.getByRole('button', { name: 'Zahodit' });
  if (await drop.count()) await drop.first().click();
  await page.waitForTimeout(500);
};
// 1) board click
if (await clickBoard(page, size, 3, 540, /19\. 11\./)) { await page.getByText('Objednat pacienta', { exact: true }).first().click(); await page.waitForTimeout(600); await report('click'); }
// 2) drag on the board (desktop)
if (size === 'desktop') {
  const r = await boardRect(page);
  await page.mouse.move(dayX(r, 4), minuteY(r, 600)); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(dayX(r, 4), minuteY(r, 600 + i * 15));
  await page.mouse.up(); await page.waitForTimeout(600);
  const o = page.getByText('Objednat pacienta', { exact: true }).first();
  if (await o.count()) await o.click();
  await page.waitForTimeout(600);
  if (await page.locator(BUBBLE).count()) await report('drag'); else console.log('drag: no bubble', (await page.locator('body').innerText()).slice(0, 80).replace(/\s+/g, ' '));
}
// 3) toolbar button
const btn = page.locator('button:has-text("Objednávka"):visible').first();
if (await btn.count()) { await btn.click(); await page.waitForTimeout(800); await shot(page, `r15-path-button0-${size}`); const txt = await page.locator('[role=menu]:visible, [role=dialog]:visible').first().innerText().catch(() => ''); console.log('button opens:', txt.replace(/\s+/g, ' ').slice(0, 200)); }
await b.close();
