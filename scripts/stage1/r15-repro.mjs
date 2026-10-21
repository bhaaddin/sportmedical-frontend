/* R15a/b: the booking bubble opened from a free minute of the board: price at the moment a činnost is picked, "Zkusit přesně". */
import './env.mjs';
import { launch, newPage, shot } from '../reviewer-bugs/lib.mjs';
import { openPlanner, clickBoard, BUBBLE } from '../reviewer-bugs/flows.mjs';
const label = process.argv[2] ?? 'before';
const size = process.argv[3] ?? 'desktop';
const minute = Number(process.argv[4] ?? 580); // 9:40
const activity = process.argv[5] ?? 'Spiroergometrické';
const b = await launch();
const page = await newPage(b, size);
await openPlanner(page);
if (!(await clickBoard(page, size, 3, minute, /19\. 11\./))) { console.log('click off screen'); process.exit(0); }
await page.getByText('Objednat pacienta', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByText('Jen zablokovat čas bez pacienta').first().click();
await page.getByRole('button', { name: 'Pokračovat' }).click();
await page.waitForTimeout(700);
const bubble = page.locator(BUBBLE);
console.log('before činnost, price words:', /Cena|Kč/.test(await bubble.innerText()));
await bubble.getByText(activity).first().click();
await page.waitForTimeout(1500);
const text = (await bubble.innerText()).replace(/\s+/g, ' ');
console.log('bubble:', text.slice(0, 700));
console.log('Zkusit přesně:', /Zkusit přesně/.test(text), '| price field:', await bubble.locator('input[inputmode=decimal], input[aria-label*=Cena i], [data-testid*=price]').count());
console.log('Objednat enabled:', await bubble.getByRole('button', { name: 'Objednat termín' }).isEnabled().catch(() => 'n/a'));
await shot(page, `r15-${label}-${size}`);
await b.close();
