/* 2.5 audit, part 1: the booking bubble (step 1, step 2, selected činnost) - text/background contrast, resting and hovered. */
import { launch, newPage, shot } from './lib.mjs';
import { setTheme, openPlanner, openBookingStep2, clickBoard, BUBBLE } from './flows.mjs';
import { probe, failing, hoverAudit } from './contrast.mjs';
const size = process.argv[2] ?? 'desktop';
const mode = process.argv[3] ?? 'dark';
const accent = process.argv[4] ?? 'forest';
const tag = process.argv[5] ?? 'audit';
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, mode, accent);
await openPlanner(page);
const report = (label, rows) => { console.log(`[${size}/${mode}/${accent}] ${label}: ${rows.length} failing`); for (const r of rows.slice(0, 14)) console.log('   ', r.ratio + '<' + r.need, JSON.stringify(r.text), r.tag, 'bg', r.bg, 'fg', r.fg, r.hovering ? 'hover:' + JSON.stringify(r.hovering) : ''); };
// step 1
if (await clickBoard(page, size, 3, 540, /19\. 11\./)) {
  report('selection popover', failing(await probe(page, '[role=menu], [data-testid=selection-popover], .MuiPopover-paper')).slice(0));
  await page.getByText('Objednat pacienta', { exact: true }).first().click();
  await page.waitForTimeout(800);
  report('bubble step 1', failing(await probe(page, BUBBLE)));
  await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-step1`);
  await page.getByText('Jen zablokovat čas bez pacienta').first().click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.waitForTimeout(600);
  await page.locator(BUBBLE).getByText('Základní sportovní').first().click();
  await page.waitForTimeout(1200);
  report('bubble step 2 (činnost chosen)', failing(await probe(page, BUBBLE)));
  const h = await hoverAudit(page, BUBBLE, 'button, [role=radio], [role=button], a, label');
  report(`bubble step 2 hover (${h.hovered} elements hovered)`, h.bad);
  await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-step2`);
}
await b.close();
