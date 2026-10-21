/* 2.5 audit, part 2: the planner stage itself - cards, windows, chips, left panels - resting and hovered. */
import { launch, newPage, shot } from './lib.mjs';
import { setTheme, openPlanner } from './flows.mjs';
import { probe, failing, hoverAudit } from './contrast.mjs';
const size = process.argv[2] ?? 'desktop';
const mode = process.argv[3] ?? 'dark';
const accent = process.argv[4] ?? 'forest';
const tag = process.argv[5] ?? 'audit';
const weeks = Number(process.argv[6] ?? 1);
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, mode, accent);
await openPlanner(page, weeks);
const report = (label, rows) => { console.log(`[${size}/${mode}/${accent}] ${label}: ${rows.length} failing`); for (const r of rows.slice(0, 16)) console.log('   ', r.ratio + '<' + r.need, JSON.stringify(r.text), r.tag, 'bg', r.bg, 'fg', r.fg, r.gradient ? '(gradient)' : '', r.hovering ? 'hover:' + JSON.stringify(r.hovering) : ''); };
await shot(page, `${tag}-2.5-${size}-${mode}-${accent}-board`);
report('stage at rest', failing(await probe(page, '.sm-planner')));
const h = await hoverAudit(page, '.sm-planner', '.schedule-event, .board-window, .agenda-chip, .agenda-term, .mini-day, button.board-chip, [data-testid^=mini-day]', { max: 30 });
report(`stage hover (${h.hovered} elements hovered)`, h.bad);
await b.close();
