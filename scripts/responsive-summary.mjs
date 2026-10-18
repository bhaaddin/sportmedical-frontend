/*
 * Summarise a result of responsive-audit.mjs.   node scripts/responsive-summary.mjs <result.json> [more.json ...] [--md out.md]
 * Failure codes per row: OVF (sideways overflow), SCR (the document scrolls vertically), DEAD (one-sided or large gutters),
 * GUT (equal gutters wider than 12 % of the room each: a centred page on an ultrawide), REG (>= 768: the page does not fit its region and scrolls as a whole inside it), NARROW (content uses < 85 % of the room on >= 1280), TCH (touch target < 44 px in the page), COV (last row behind a
 * fixed bar), CLP (text cut without an ellipsis), TBL (phone: a table scrolls sideways), OVL (overlapping text), INT
 * (content under the rail), ERR (page crashed / not loaded).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const mdIdx = args.indexOf('--md');
const mdOut = mdIdx >= 0 ? args.splice(mdIdx, 2)[1] : null;
import { flags } from './responsive-flags.mjs';

const klass = (w) => (w < 768 ? 'phone' : w < 1280 ? 'tablet' : w < 2000 ? 'desktop' : 'wide');
const rows = args.flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
const byPage = new Map();
for (const r of rows) {
  const k = r.route.replace(/\/[0-9a-f-]{36}/, '/:id');
  const e = byPage.get(k) ?? { phone: new Set(), tablet: new Set(), desktop: new Set(), wide: new Set(), n: 0, bad: 0 };
  const fl = flags(r);
  e.n++;
  if (fl.length) e.bad++;
  fl.forEach((x) => e[klass(r.w)].add(x));
  byPage.set(k, e);
}
const total = {};
for (const r of rows) for (const x of flags(r)) total[x] = (total[x] ?? 0) + 1;
let md = `| page | phone | tablet | desktop | wide | rows failing |\n|---|---|---|---|---|---|\n`;
for (const [k, e] of [...byPage].sort()) {
  const c = (s) => ([...s].sort().join(' ') || 'ok');
  md += `| ${k} | ${c(e.phone)} | ${c(e.tablet)} | ${c(e.desktop)} | ${c(e.wide)} | ${e.bad}/${e.n} |\n`;
}
md += `\nTotals (rows with the failure of ${rows.length}): ${JSON.stringify(total)}\n`;
console.log(md);
if (mdOut) writeFileSync(mdOut, md);
