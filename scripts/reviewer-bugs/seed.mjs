/*
 * Test data for the reviewer-bug checks: event bookings (no patient) named "ZZ reviewer ..." in the dev database, in the quiet
 * week SEED_MONDAY (default 11. 1. 2027), spread over the clinic's calendars and činnosti. `node seed.mjs` creates, `node seed.mjs clean`
 * cancels every booking of that name again. Only these rows are ever touched.
 */
import { launch, newPage, login, api } from './lib.mjs';
const clean = process.argv[2] === 'clean';
import { seedDay } from './flows.mjs';
const WEEK = [0, 1, 2, 3, 4].map(seedDay);
const NAME = 'ZZ reviewer test (smazat)';
const b = await launch(); const page = await newPage(b); await login(page);
const cals = (await api(page, 'GET', '/api/calendars')).json.data.filter((c) => c.isActive && !c.name.startsWith('ZZ'));
const acts = (await api(page, 'GET', '/api/activities')).json.data.activities.filter((a) => a.isActive);
if (clean) {
  let n = 0;
  const day = await api(page, 'GET', `/api/day?from=${WEEK[0]}&to=${WEEK[4]}`);
  const rows = day.json?.data ?? day.json ?? [];
  for (const a of Array.isArray(rows) ? rows : []) {
    if (!(a.patientName ?? '').includes('ZZ reviewer') && !(a.eventName ?? '').includes('ZZ reviewer')) continue;
    const d = await api(page, 'DELETE', `/api/calendars/${a.calendarId}/appointments/${a.id}`);
    if (d.status < 300) n++;
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
  let ok = 0;
  /* one booking at a time, the availability read again after each (so no two bookings of a činnost share a start) */
  for (let k = 0; k < count; k++) {
    const av = await api(page, 'GET', `/api/calendars/${cal.id}/availability?activityId=${act.id}&from=${WEEK[d]}&to=${WEEK[d]}&forPublic=false&staffStarts=true`);
    const slot = (av.json?.data ?? av.json ?? [])[0];
    if (!slot) break;
    const r = await api(page, 'POST', `/api/calendars/${cal.id}/appointments/unregistered`, { calendarId: cal.id, activityId: act.id, startUtc: slot.startUtc, name: NAME, phone: null, note: null });
    if (r.status < 300) { ok++; made++; } else break;
  }
  console.log(WEEK[d], calName, act.name, 'created', ok, '/', count);
}
console.log('total', made);
await b.close();
