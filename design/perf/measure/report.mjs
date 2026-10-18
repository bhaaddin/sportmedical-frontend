import fs from 'fs';
const label = process.argv[2] || 'before';
const { results, notes } = JSON.parse(fs.readFileSync(`result-${label}.json`, 'utf8'));
let out = '';
const kb = (b) => (b / 1024).toFixed(1);
out += `| Screen | reqs | exact duplicates | 4xx/5xx/abort | KB | quiet ms |\n|---|---:|---:|---:|---:|---:|\n`;
let tot = 0, totd = 0;
for (const r of results) {
  const c = new Map(); for (const q of r.reqs) { const k = q.method + ' ' + q.full; c.set(k, (c.get(k) || 0) + 1); }
  const dup = [...c.values()].reduce((a, n) => a + (n - 1), 0);
  const bad = r.reqs.filter(q => q.status === 'ABORT' || q.status >= 400).length;
  const bytes = r.reqs.reduce((a, q) => a + (q.bytes || 0), 0);
  tot += r.reqs.length; totd += dup;
  out += `| ${r.name} | ${r.reqs.length} | ${dup} | ${bad} | ${kb(bytes)} | ${r.quiet} |\n`;
}
out += `| **Total** | **${tot}** | **${totd}** | | | |\n\n`;
if (process.argv[3] === 'detail') {
for (const r of results) {
  out += `\n#### ${r.name}\n`;
  const g = new Map();
  for (const q of r.reqs) { const k = q.method + ' ' + q.path; const e = g.get(k) || { n: 0, bytes: 0, ms: 0, st: new Set(), q: new Map() }; e.n++; e.bytes = Math.max(e.bytes, q.bytes || 0); e.ms = Math.max(e.ms, q.ms || 0); e.st.add(q.status); e.q.set(q.full, (e.q.get(q.full) || 0) + 1); g.set(k, e); }
  for (const [k, e] of [...g].sort((a, b) => b[1].n - a[1].n)) {
    const dup = [...e.q.values()].filter(n => n > 1).reduce((a, n) => a + n - 1, 0);
    out += `- ${k} x${e.n}${dup ? ` (dup ${dup})` : ''} max ${kb(e.bytes)}KB ${e.ms}ms [${[...e.st].join(',')}]\n`;
  }
}
}
out += `\nNotes:\n${notes.join('\n')}\n`;
console.log(out);
