/* 2.5 audit, part 4: the other planner surfaces (day list, month, left panel, flyouts, card summary, detail) at rest and hovered. */
import { launch, newPage, shot } from './lib.mjs';
import { setTheme, openPlanner, weeksToSeed } from './flows.mjs';
import { probe, failing, hoverAudit } from './contrast.mjs';
const size = process.argv[2] ?? 'desktop';
const mode = process.argv[3] ?? 'dark';
const accent = process.argv[4] ?? 'forest';
const tag = process.argv[5] ?? 'audit';
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, mode, accent);
await openPlanner(page, weeksToSeed());
let total = 0;
const report = (label, rows) => { total += rows.length; console.log(`[${size}/${mode}/${accent}] ${label}: ${rows.length} failing`); for (const r of rows.slice(0, 12)) console.log('   ', r.ratio + '<' + r.need, JSON.stringify(r.text), r.tag, 'bg', r.bg, 'fg', r.fg, r.hovering ? 'hover:' + JSON.stringify(r.hovering) : ''); };
const HOVERABLE = 'button, [role=button], [role=menuitem], [role=radio], a, .schedule-event, .board-window, .agenda-chip, .agenda-term, [data-testid^=mini-day], .rd-record, .month-tile, [data-testid^=month-day]';
const pass = async (label, scope = 'body') => {
  report(label + ' (rest)', failing(await probe(page, scope)));
  const h = await hoverAudit(page, scope, HOVERABLE, { max: 45 });
  report(`${label} (hover, ${h.hovered} hovered)`, h.bad);
};
await pass('week board + panels', '.sm-planner');
const open = async (name) => { await page.getByRole('button', { name, exact: true }).first().click().catch(() => page.getByText(name, { exact: true }).first().click()); await page.waitForTimeout(900); };
// card summary
const card = page.locator('.schedule-event.board-booking').first();
if (await card.count()) { await card.click(); await page.waitForTimeout(600); await pass('card summary', 'body'); await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-summary`); await page.keyboard.press('Escape'); }
// day list + month
await open('Den'); await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-day`); await pass('Den (day list)', '.sm-planner');
await open('Měsíc'); await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-month`); await pass('Měsíc', '.sm-planner');
await b.close();
console.log('TOTAL failing', total);
