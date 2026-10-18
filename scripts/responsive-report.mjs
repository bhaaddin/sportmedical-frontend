/*
 * Before / after report of two responsive-audit results.
 *   node scripts/responsive-report.mjs <before.json> <after.json> <out-dir>
 * Writes <out-dir>/before.json, after.json (trimmed: route, viewport, failure codes, the measures) and report.md
 * (a table per page and viewport class, and the totals of both).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { flags } from './responsive-flags.mjs';

const [beforePath, afterPath, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const klass = (w) => (w < 768 ? 'phone' : w < 1280 ? 'tablet' : w < 2000 ? 'desktop' : 'wide');
const norm = (r) => r.replace(/\/[0-9a-f-]{36}/, '/:id');
const trim = (rows) => rows.map((r) => ({
  route: norm(r.route), viewport: r.vp, flags: flags(r),
  W: r.W, H: r.H, avail: r.avail, gapL: r.gapL, gapR: r.gapR, used: r.used, docHeight: r.docHeight,
  regionScroll: r.regionScroll, touchMain: r.touchMain, innerScroll: (r.innerScroll ?? []).filter((s) => s.table).length,
}));
const before = trim(JSON.parse(readFileSync(beforePath, 'utf8')));
const after = trim(JSON.parse(readFileSync(afterPath, 'utf8')));
writeFileSync(`${outDir}/before.json`, JSON.stringify(before));
writeFileSync(`${outDir}/after.json`, JSON.stringify(after));

const group = (rows) => {
  const m = new Map();
  for (const r of rows) {
    const e = m.get(r.route) ?? { n: 0, bad: 0, c: { phone: new Set(), tablet: new Set(), desktop: new Set(), wide: new Set() } };
    e.n++;
    if (r.flags.length) e.bad++;
    r.flags.forEach((f) => e.c[klass(r.W)].add(f));
    m.set(r.route, e);
  }
  return m;
};
const gb = group(before), ga = group(after);
const cell = (e, k) => (e && e.c[k].size ? [...e.c[k]].sort().join(' ') : 'ok');
const pages = [...new Set([...gb.keys(), ...ga.keys()])].sort();
const count = (rows) => { const t = {}; for (const r of rows) for (const f of r.flags) t[f] = (t[f] ?? 0) + 1; return t; };
let md = `# Responsive audit: staff pages, before and after\n\n`;
md += `Viewports: ${[...new Set(after.map((r) => r.viewport))].join(', ')}. Codes: OVF sideways overflow, SCR the document scrolls, REG page taller than its region (>= 768), DEAD one-sided/large empty side, GUT equal gutters > 12 % (centred page on an ultrawide), NARROW content < 85 % of the room, TCH touch target < 44 px, COV last row behind the bottom bar, CLP clipped text, TBL phone table scrolls sideways, OVL overlapping text, INT content under the rail, ERR page did not load.\n\n`;
md += `Rows with the failure: before ${JSON.stringify(count(before))} of ${before.length}; after ${JSON.stringify(count(after))} of ${after.length}.\n\n`;
md += `| page | phone (before > after) | tablet | desktop | wide |\n|---|---|---|---|---|\n`;
for (const p of pages) {
  const b = gb.get(p), a = ga.get(p);
  md += `| ${p} | ${['phone', 'tablet', 'desktop', 'wide'].map((k) => `${cell(b, k)} > ${cell(a, k)}`).join(' | ')} |\n`;
}
writeFileSync(`${outDir}/report.md`, md);
console.log(md.split('\n').slice(0, 6).join('\n'));
