/*
 * Test data for the reviewer-bug checks: event bookings (no patient) named "ZZ reviewer ..." in the dev database, week of
 * 7.-11. 12. 2026 (a quiet week), spread over the clinic's calendars and činnosti. `node seed.mjs` creates, `node seed.mjs clean`
 * cancels every booking of that name again. Only these rows are ever touched.
 */
import { launch, newPage, login, api } from './lib.mjs';
const clean = process.argv[2] === 'clean';
const WEEK = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'];
const NAME = 'ZZ reviewer test (smazat)';
const b = await launch(); const page = await newPage(b); await login(page);
const cals = (await api(page, 'GET', '/api/calendars')).json.data.filter((c) => c.isActive && !c.name.startsWith('ZZ'));
const acts = (await api(page, 'GET', '/api/activities')).json.data.activities.filter((a) => a.isActive);
const range = async (cal, from, to) => (await api(page, 'GET', `/api/calendars/${cal.id}/appointments?from=${from}&to=${to}`));
if (clean) {
  let n = 0;
  for (const cal of cals) {
    const r = await range(cal, WEEK[0], WEEK[4]);
    const rows = r.json?.data ?? r.json ?? [];
    for (const a of Array.isArray(rows) ? rows : (rows.appointments ?? [])) {
      if ((a.patientName ?? a.name ?? a.eventName ?? '').includes('ZZ reviewer')) { const d = await api(page, 'DELETE', `/api/calendars/${cal.id}/appointments/${a.id}`); if (d.status < 300) n++; }
    }
  }
  console.log('cancelled', n);
  await b.close(); process.exit(0);
}
const plan = [
  // [dayIdx, calendar name, activity name part, count]
  [0, 'Ordinace 1', 'Základní sportovní', 4], [0, 'Ordinace 1', 'Komplexní sportovní', 2], [0, 'Ordinace 1', 'Spiro', 1],
  [1, 'Diagnostika', 'Základní diagnostika', 3], [1, 'Diagnostika', 'Komplexní diagnostika', 1],
  [2, 'Ordinace 1', 'Základní sportovní', 2], [2, 'Diagnostika', 'Základní diagnostika', 2], [2, 'InBody', 'InBody', 2],
  [3, 'Ordinace 1', 'Komplexní sportovní', 6],
];
let made = 0;
for (const [d, calName, actPart, count] of plan) {
  const cal = cals.find((c) => c.name === calName); const act = acts.find((a) => a.name.includes(actPart));
  if (!cal || !act) { console.log('skip', calName, actPart); continue; }
  const av = await api(page, 'GET', `/api/calendars/${cal.id}/availability?activityId=${act.id}&from=${WEEK[d]}&to=${WEEK[d]}&forPublic=false&staffStarts=true`);
  const slots = (av.json?.data ?? av.json ?? []);
  let ok = 0;
  for (const s of slots) {
    if (ok >= count) break;
    // take non-overlapping starts: availability is refreshed per booking, so just try and let the server refuse a clash
    const r = await api(page, 'POST', `/api/calendars/${cal.id}/appointments/unregistered`, { calendarId: cal.id, activityId: act.id, startUtc: s.startUtc, name: NAME, phone: null, note: null });
    if (r.status < 300) { ok++; made++; }
  }
  console.log(WEEK[d], calName, act.name, 'created', ok, '/', count);
}
console.log('total', made);
await b.close();
