import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b, 'desktop'); await login(p);
const cals = (await api(p, 'GET', '/api/calendars')).json;
const from = process.argv[2] ?? '2026-10-19', to = process.argv[3] ?? '2026-11-30';
for (const c of (cals.data ?? cals)) {
  const r = await api(p, 'GET', `/api/calendars/${c.id}/blocks?from=${from}&to=${to}`);
  const arr = r.json?.data ?? r.json;
  console.log(c.name, r.status, Array.isArray(arr) ? arr.filter(x => x.kind === 'club').map(x => ({ s: x.startUtc, e: x.endUtc, club: x.clubName, acts: x.activityIds?.length, st: x.orderStatus, cb: x.clubBlockId?.slice(0,6) })) : String(r.text));
}
await b.close();
