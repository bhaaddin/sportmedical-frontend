// usage: node report.mjs <label> <unthrottled.json> <throttled.json>   -> markdown tables on stdout
import fs from 'node:fs';
const [label, unPath, thPath] = process.argv.slice(2);
const load = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const un = load(unPath);
const th = load(thPath);
const ids = ['home', 'login', 'signin', 'prehled', 'planovani', 'clubs', 'club-slany', 'patients', 'objednat', 'prehled-warm', 'planovani-warm'];
const NAMES = {
  home: '/ (public home)', login: '/login', signin: 'sign-in click to /prehled (SPA hop)', prehled: '/prehled', planovani: '/planovani',
  clubs: '/clubs', 'club-slany': '/clubs/<FK Slany>', patients: '/patients', objednat: '/objednat',
  'prehled-warm': '/prehled, repeat visit (cache warm)', 'planovani-warm': '/planovani, repeat visit (cache warm)',
};
const kb = (n) => (n == null ? '-' : (n / 1024).toFixed(0));
const ms = (n) => (n == null ? '-' : String(Math.round(n)));
const row = (id, r) => {
  if (!r) return `| ${NAMES[id]} | - |`;
  const cut = Math.max(r.usable ?? 0, r.lcp ?? 0, r.fcp ?? 0) || Infinity;
  const c = { agg: {}, total: { n: 0, raw: 0, enc: 0 } };
  for (const x of r.sample) {
    if (x.start > cut) continue;
    const g = (c.agg[x.cat] ??= { n: 0, raw: 0, enc: 0 });
    g.n += 1; g.raw += x.raw; g.enc += x.cache ? 0 : x.enc;
    c.total.n += 1; c.total.raw += x.raw; c.total.enc += x.cache ? 0 : x.enc;
  }
  for (const k of ['js', 'css', 'font', 'img', 'api', 'doc', 'other']) c.agg[k] ??= { n: 0, raw: 0, enc: 0 };
  const a = c.agg;
  return `| ${NAMES[id]} | ${c.total.n} | ${kb(a.js.raw)} / ${kb(a.js.enc)} | ${kb(a.css.raw)} / ${kb(a.css.enc)} | ${kb(a.font.enc)} | ${a.api.n} | ${kb(c.total.enc)} | ${kb(r.total.enc)} | ${ms(r.fcp)} | ${ms(r.lcp)} | ${ms(r.usable == null ? null : Math.max(r.usable, r.fcp ?? 0))} | ${ms(r.tbt)} |`;
};
const head = ['| screen | requests until usable | JS raw / transferred kB | CSS raw / transferred kB | fonts kB | API calls | transferred kB until usable | transferred kB incl. idle prefetch | FCP ms | LCP ms | usable ms | TBT ms |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'].join(String.fromCharCode(10));
console.log(`### ${label} - Fast 4G (9 Mbit/s, 170 ms RTT) + CPU 4x slowdown, median of 3 cold loads\n`);
console.log(head);
for (const id of ids) console.log(row(id, th[id]));
console.log(`\n### ${label} - unthrottled (localhost), median of 3\n`);
console.log(head);
for (const id of ids) console.log(row(id, un[id]));
