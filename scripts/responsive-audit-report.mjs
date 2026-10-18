/*
 * Turns two result files of scripts/responsive-audit-public.mjs into the before/after table.
 *
 *   node scripts/responsive-audit-report.mjs before.json after.json > report.md
 *
 * One row per page, one column per viewport class: "n/m" = viewports of that class that break at least one rule, out of m
 * measured; under it the rules that fail (before -> after).
 */
import { readFileSync } from 'node:fs';

const [beforeFile, afterFile] = process.argv.slice(2);
const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const before = load(beforeFile);
const after = afterFile ? load(afterFile) : null;
const CLASSES = ['phone', 'tablet-portrait', 'tablet-landscape', 'desktop', 'ultrawide', 'zoom80', 'zoom125'];
const label = { phone: 'phone', 'tablet-portrait': 'tablet P', 'tablet-landscape': 'tablet L', desktop: 'desktop', ultrawide: 'ultrawide', zoom80: 'zoom 80%', zoom125: 'zoom 125%' };

const cell = (records, page, cls) => {
  const list = records.filter((r) => r.page === page && r.cls === cls);
  const bad = list.filter((r) => (r.fail ?? []).length > 0);
  const rules = [...new Set(bad.flatMap((r) => r.fail))].sort();
  return { n: bad.length, m: list.length, rules };
};

const pages = [...new Set(before.map((r) => r.page))];
const kinds = Object.fromEntries(before.map((r) => [r.page, r.kind]));
const lines = [];
lines.push(`| page | kind | ${CLASSES.map((c) => label[c]).join(' | ')} |`);
lines.push(`|---|---|${CLASSES.map(() => '---').join('|')}|`);
for (const page of pages) {
  const cols = CLASSES.map((cls) => {
    const b = cell(before, page, cls);
    if (b.m === 0) return '';
    if (after === null) return `${b.n}/${b.m}${b.rules.length ? `<br>${b.rules.join(', ')}` : ''}`;
    const a = cell(after, page, cls);
    const rules = b.rules.length || a.rules.length ? `<br>${b.rules.join(', ') || '-'} → ${a.rules.join(', ') || '-'}` : '';
    return `${b.n}/${b.m} → ${a.m === 0 ? '?' : `${a.n}/${a.m}`}${rules}`;
  });
  lines.push(`| ${page} | ${kinds[page]} | ${cols.join(' | ')} |`);
}

const totals = (records) => {
  const t = {};
  for (const r of records) for (const k of r.fail ?? []) t[k] = (t[k] ?? 0) + 1;
  return t;
};
lines.push('');
lines.push('| rule | before | after |');
lines.push('|---|---|---|');
const tb = totals(before); const ta = after ? totals(after) : {};
for (const k of [...new Set([...Object.keys(tb), ...Object.keys(ta)])].sort()) lines.push(`| ${k} | ${tb[k] ?? 0} | ${after ? ta[k] ?? 0 : ''} |`);
lines.push(`| records | ${before.length} | ${after ? after.length : ''} |`);
console.log(lines.join('\n'));
