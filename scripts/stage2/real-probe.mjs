/* Stage-2 API copy (:5193 via Vite :3006): what the data looks like (calendars, workers of the week, club blocks) - no patient data. */
process.env.BASE ??= 'http://localhost:3006';
process.env.DEV_LOGIN ??= 'C:/Users/Matko/vt-tmp/s2api-login.txt';
const { launch, newPage, login, api } = await import('./lib.mjs');
const b = await launch(); const p = await newPage(b); await login(p);
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
const cals = un((await api(p, 'GET', '/api/calendars')).json).filter((c) => c.isActive);
console.log('calendars', cals.map((c) => `${c.name}|${c.id.slice(-4)}|svc ${c.clinicServiceId?.slice(-4)}`));
for (const day of ['2026-10-26', '2026-10-27']) {
  for (const c of cals) {
    const r = (await api(p, 'GET', `/api/calendars/${c.id}/preview?from=${day}&to=${day}`)).json;
    const row = un(r)?.[0];
    console.log(day, c.name, row ? `open=${row.isOpen} ${row.startTime}-${row.endTime} break=${row.breakStart}-${row.breakEnd} worker=${row.workerDisplayName ?? '-'}(${(row.workerUserId ?? '').slice(-4)}) exc=${JSON.stringify(row.lunchException ?? null)}` : JSON.stringify(r).slice(0, 120));
  }
}
console.log('slots', JSON.stringify((await api(p, 'GET', '/api/v1/settings/booking-slots')).json));
console.log('clubs', JSON.stringify((await api(p, 'GET', '/api/v1/settings/clubs')).json).slice(0, 300));
const clubs = (await api(p, 'GET', '/api/clubs')).json; console.log('club list', (clubs.data ?? clubs).map?.((c) => c.name + '|' + c.id.slice(-4)));
console.log('club orders', JSON.stringify(((await api(p, 'GET', '/api/v1/club-orders')).json ?? []).slice?.(0, 3)).slice(0, 400));
await b.close();
