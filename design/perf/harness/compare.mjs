// usage: node compare.mjs <before-throttled> <after-throttled> <before-unthrottled> <after-unthrottled>   -> before -> after tables
import fs from 'node:fs';
const [bt, at, bu, au] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const ids = ['home', 'login', 'signin', 'prehled', 'planovani', 'clubs', 'club-slany', 'patients', 'objednat', 'prehled-warm', 'planovani-warm'];
const NAMES = {
  home: '/ (public home)', login: '/login', signin: 'sign-in click to /prehled', prehled: '/prehled', planovani: '/planovani',
  clubs: '/clubs', 'club-slany': '/clubs/<FK Slany>', patients: '/patients', objednat: '/objednat',
  'prehled-warm': '/prehled repeat visit', 'planovani-warm': '/planovani repeat visit',
};
const cut = (r) => {
  const c = Math.max(r.usable ?? 0, r.lcp ?? 0, r.fcp ?? 0) || Infinity;
  const a = { n: 0, js: 0, enc: 0, api: 0 };
  for (const x of r.sample) {
    if (x.start > c) continue;
    a.n += 1; a.enc += x.cache ? 0 : x.enc;
    if (x.cat === 'js') a.js += x.cache ? 0 : x.enc;
    if (x.cat === 'api') a.api += 1;
  }
  return a;
};
const u = (r) => (r.usable == null ? null : Math.max(r.usable, r.fcp ?? 0));
const pair = (b, a, f = Math.round, unit = '') => {
  if (b == null && a == null) return '-';
  const fb = b == null ? '-' : `${f(b)}${unit}`;
  const fa = a == null ? '-' : `${f(a)}${unit}`;
  if (b == null || a == null || b === 0) return `${fb} -> ${fa}`;
  const d = Math.round(((a - b) / b) * 100);
  return `${fb} -> **${fa}** (${d > 0 ? '+' : ''}${d} %)`;
};
const kb = (n) => Math.round(n / 1024);
function table(title, B, A) {
  console.log(`### ${title}\n`);
  console.log('| screen | FCP ms | LCP ms | usable ms | TBT ms | JS kB (brotli) until usable | requests until usable | transferred kB until usable |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const id of ids) {
    const b = B[id], a = A[id];
    if (!b || !a) continue;
    const cb = cut(b), ca = cut(a);
    console.log(`| ${NAMES[id]} | ${pair(b.fcp, a.fcp)} | ${pair(b.lcp, a.lcp)} | ${pair(u(b), u(a))} | ${pair(b.tbt, a.tbt)} | ${pair(kb(cb.js), kb(ca.js))} | ${pair(cb.n, ca.n)} | ${pair(kb(cb.enc), kb(ca.enc))} |`);
  }
  console.log('');
}
table('Fast 4G (9 Mbit/s, 170 ms RTT) + CPU 4x slowdown - before -> after (median of 3 cold loads)', bt, at);
table('Unthrottled (localhost) - before -> after (median of 3 cold loads)', bu, au);
