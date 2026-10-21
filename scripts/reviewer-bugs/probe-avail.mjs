import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const page = await newPage(b); await login(page);
const cals = (await api(page, 'GET', '/api/calendars')).json.data;
const acts = (await api(page, 'GET', '/api/activities')).json.data.activities;
const day = process.argv[2] ?? '2026-11-19';
const cal = cals[0];
for (const a of acts.filter((x) => x.isActive && x.clinicServiceId === cal.clinicServiceId)) {
  const r = await api(page, 'GET', `/api/calendars/${cal.id}/availability?activityId=${a.id}&from=${day}&to=${day}&forPublic=false&staffStarts=true`);
  const starts = (r.json?.data ?? r.json ?? []).map((s) => new Date(s.startUtc).toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }));
  console.log(a.name, a.durationMinutes + 'min', 'status', r.status, 'n=' + starts.length, starts.join(' '));
}
await b.close();
