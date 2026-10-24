import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b, 'desktop'); await login(p);
const cals = (await api(p, 'GET', '/api/calendars')).json; const c = (cals.data ?? cals)[0];
const r = await api(p, 'GET', `/api/calendars/${c.id}/blocks?from=2026-10-26&to=2026-10-28`);
console.log(JSON.stringify((r.json?.data ?? r.json)[0]));
const o = await api(p, 'GET', '/api/v1/club-orders'); console.log(o.status, JSON.stringify(o.json).slice(0,600));
const a = await api(p, 'GET', '/api/activities'); console.log(JSON.stringify(a.json).slice(0,500));
await b.close();
