import fs from 'fs';
const L = (l) => JSON.parse(fs.readFileSync('result-' + l + '.json')).results;
const [b, a] = [L(process.argv[2]), L(process.argv[3])];
const stat = (r) => { const c = new Map(); for (const q of r.reqs) { const k = q.method + ' ' + q.full; c.set(k, (c.get(k) || 0) + 1); } return { n: r.reqs.length, dup: [...c.values()].reduce((x, n) => x + n - 1, 0), kb: r.reqs.reduce((x, q) => x + (q.bytes || 0), 0) / 1024 }; };
let tb = { n: 0, dup: 0, kb: 0 }, ta = { n: 0, dup: 0, kb: 0 };
let out = '| # | Screen / step | Req before | Req after | Dup before | Dup after | KB before | KB after |\n|---|---|---:|---:|---:|---:|---:|---:|\n';
for (const r of b) {
  const x = a.find((y) => y.name === r.name); const s = stat(r), t = x ? stat(x) : { n: 0, dup: 0, kb: 0 };
  for (const k of ['n', 'dup', 'kb']) { tb[k] += s[k]; ta[k] += t[k]; }
  const m = r.name.match(/^(\S+)\s+(.*)$/);
  out += `| ${m[1]} | ${m[2]} | ${s.n} | ${t.n} | ${s.dup} | ${t.dup} | ${s.kb.toFixed(0)} | ${t.kb.toFixed(0)} |\n`;
}
out += `| | **Total** | **${tb.n}** | **${ta.n}** | **${tb.dup}** | **${ta.dup}** | **${tb.kb.toFixed(0)}** | **${ta.kb.toFixed(0)}** |\n`;
console.log(out);
