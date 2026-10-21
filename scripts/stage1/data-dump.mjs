/* Dumps the činnosti / služby / price-list structure of the dev stack (no patient data). */
import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b); await login(p);
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j); const acts0 = un((await api(p, 'GET', '/api/activities')).json); const acts = acts0;
const svcs = un((await api(p, 'GET', '/api/clinic-services')).json);
const pl = un((await api(p, 'GET', '/api/services')).json);
const pub = (await api(p, 'GET', '/api/public/price-list')).json;
console.log('ACT KEYS', Object.keys(acts)); const A = Array.isArray(acts) ? acts : (acts.activities ?? acts.items ?? Object.values(acts).find(Array.isArray));
console.log('ACTIVITIES'); for (const a of A) console.log(' ', a.name, '|', a.priceCzk, '|', a.clinicServiceId?.slice(0,6), '|', a.isActive, '|', a.id.slice(0,6), '| svc?', a.serviceId?.slice(0,6));
console.log('CLINIC-SERVICES'); for (const s of svcs) console.log(' ', s.name, '|', s.id.slice(0,6), '|', JSON.stringify(Object.keys(s)).slice(0,200));
console.log('PRICE LIST /api/services', Array.isArray(pl) ? pl.length : JSON.stringify(pl).slice(0,200)); for (const s of (Array.isArray(pl) ? pl : [])) console.log(' ', s.name, '|', s.price ?? s.priceCzk, '|', s.id?.slice(0,6), '|', s.activityId?.slice(0,6), s.isActive);
console.log('PUBLIC', JSON.stringify(pub).slice(0, 600));
await b.close();
