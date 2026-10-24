import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b); await login(p);
const a = (await api(p, 'GET', '/api/activities')).json;
const list = a.data?.activities ?? a.data ?? a.activities;
const s = (await api(p, 'GET', '/api/clinic-services')).json;
console.log('services', (s.data).map((x) => [x.name, x.colorHex].join('|')));
for (const x of list) console.log([x.name, x.isActive, 'own=' + x.colorHex, 'eff=' + x.effectiveColorHex, 'legacy=' + x.color, 'svc=' + (x.clinicServiceId ?? '').slice(0, 4), 'id=' + x.id.slice(0, 4)].join(' | '));
await b.close();
