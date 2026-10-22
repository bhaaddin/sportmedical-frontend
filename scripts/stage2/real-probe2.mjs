process.env.BASE ??= 'http://localhost:3006';
process.env.DEV_LOGIN ??= 'C:/Users/Matko/vt-tmp/s2api-login.txt';
const { launch, newPage, login, api } = await import('./lib.mjs');
const b = await launch(); const p = await newPage(b); await login(p);
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
const cals = un((await api(p, 'GET', '/api/calendars')).json).filter((c) => c.isActive);
const from = '2026-10-26', to = '2026-12-06';
for (const c of cals.slice(0, 2)) {
  const blocks = un((await api(p, 'GET', `/api/calendars/${c.id}/blocks?from=${from}&to=${to}`)).json);
  const days = {}; for (const bl of blocks) { const d = bl.startUtc.slice(0, 10); (days[d] ??= []).push(`${bl.kind}${bl.clubName ? ':' + bl.clubName : ''} ${bl.startUtc.slice(11, 16)}-${bl.endUtc.slice(11, 16)}${bl.orderCode ? ' ' + bl.orderCode : ''}${bl.playersMissing !== undefined ? ' missing=' + bl.playersMissing : ''}${bl.holdExpired !== undefined ? ' exp=' + bl.holdExpired : ''}`); }
  console.log(c.name, JSON.stringify(days).slice(0, 900));
  const day = un((await api(p, 'GET', `/api/calendars/${c.id}/day-range?from=2026-11-09&to=2026-11-13`)).json);
  console.log(' appointments 9-13 Nov', Array.isArray(day) ? day.length : JSON.stringify(day).slice(0, 100));
}
const acts = un((await api(p, 'GET', '/api/activities')).json); const A = Array.isArray(acts) ? acts : acts.activities;
console.log(A.filter((a) => a.isActive).slice(0, 8).map((a) => `${a.name}|${a.id.slice(-4)}|svc ${a.clinicServiceId.slice(-4)}|${a.durationMinutes}min`));
console.log('me', JSON.stringify((await api(p, 'GET', '/api/v1/account')).json).slice(0, 200));
await b.close();
