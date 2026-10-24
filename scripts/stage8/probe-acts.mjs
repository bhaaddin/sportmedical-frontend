import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b, 'desktop'); await login(p);
const cals = (await api(p, 'GET', '/api/calendars')).json; const list = cals.data ?? cals;
console.log(list.filter(c=>c.isActive!==false).map(c => `${c.id.slice(0,6)} ${c.name} step=${c.displayStepMinutes} svc=${c.clinicServiceId?.slice(0,6)}`).join('\n'));
const acts = (await api(p, 'GET', '/api/activities')).json.data.activities.filter((a) => a.isActive);
console.log(acts.map(a => `${a.name} ${a.durationMinutes}min svc=${a.clinicServiceId?.slice(0,6)} price=${a.priceCzk}`).join('\n'));
await b.close();
