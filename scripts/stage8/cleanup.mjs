/* Cancels every live booking whose note starts with "ZZ test stage8" (left by a check that stopped half way). */
import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b, 'desktop'); await login(p);
const cals = ((await api(p, 'GET', '/api/calendars')).json); const list = cals.data ?? cals;
const from = new Date().toISOString().slice(0, 10); const to = new Date(Date.now() + 55 * 86400000).toISOString().slice(0, 10);
let cancelled = 0, scanned = 0;
for (const c of list) {
  const r = await api(p, 'GET', `/api/day?from=${from}&to=${to}&calendarIds=${c.id}`);
  const rows = r.json?.data ?? r.json ?? [];
  for (const a of rows.filter((x) => x.status !== 4)) {
    scanned++;
    const d = (await api(p, 'GET', `/api/calendars/${c.id}/appointments/${a.id}`)).json; const note = (d?.data ?? d)?.note ?? '';
    if (String(note).startsWith('ZZ test stage8')) { await api(p, 'DELETE', `/api/calendars/${c.id}/appointments/${a.id}?reason=ZZ%20test%20cleanup`); cancelled++; }
  }
}
await b.close().catch(()=>{});
console.log('scanned', scanned, 'cancelled', cancelled);
await b.close();
