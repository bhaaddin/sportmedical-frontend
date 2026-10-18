import fs from 'fs';
const T = process.env.TOKEN;
const H = { Authorization: 'Bearer ' + T };
const get = async (p) => { const r = await fetch('http://localhost:5092' + p, { headers: H }); const j = await r.json(); return j.data ?? j; };
const cals = (await get('/api/calendars')).map((c) => c.id);
const day = (d) => new Date(Date.parse(d + 'T00:00:00Z'));
const add = (d, n) => new Date(day(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const prague = (iso) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const M0 = '2026-09-14', M1 = '2026-11-12';
const monthApp = await get(`/api/day?from=${M0}&to=${M1}&calendarIds=${cals.join(',')}`);
console.log('appointments in big window', monthApp.length);
let bad = 0, checked = 0;
for (let s = M0; s <= add(M1, -6); s = add(s, 1)) for (const len of [0, 6]) {
  const e = add(s, len);
  const srv = await get(`/api/day?from=${s}&to=${e}&calendarIds=${cals.join(',')}`);
  const mine = monthApp.filter((a) => prague(a.startUtc) >= s && prague(a.startUtc) <= e);
  checked++;
  const ids = (x) => x.map((a) => a.id).sort().join();
  if (ids(srv) !== ids(mine)) { bad++; if (bad < 4) console.log('DAY MISMATCH', s, e, srv.length, mine.length); }
}
console.log('day windows checked', checked, 'mismatches', bad);
for (const c of cals) {
  const big = await get(`/api/calendars/${c}/blocks?from=${M0}&to=${M1}`);
  if (big.length === 0) continue;
  let bad2 = 0, ch = 0;
  for (let s = M0; s <= add(M1, -6); s = add(s, 1)) for (const len of [0, 6]) {
    const e = add(s, len);
    const srv = await get(`/api/calendars/${c}/blocks?from=${s}&to=${e}`);
    // overlap in Prague local days [s, e]
    const mine = big.filter((b) => prague(b.startUtc) <= e && prague(new Date(Date.parse(b.endUtc) - 1).toISOString()) >= s);
    ch++;
    const ids = (x) => x.map((a) => a.id).sort().join();
    if (ids(srv) !== ids(mine)) { bad2++; if (bad2 < 4) console.log('BLOCK MISMATCH', c.slice(0, 4), s, e, srv.length, mine.length); }
  }
  console.log('blocks', c.slice(0, 4), 'in big', big.length, 'windows', ch, 'mismatches', bad2);
}
