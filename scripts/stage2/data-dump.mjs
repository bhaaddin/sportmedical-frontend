/* R2: how calendars map to služby / činnosti in the dev data (no patient data). */
import { launch, newPage, login, api } from './lib.mjs';
const b = await launch(); const p = await newPage(b); await login(p);
const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
const cals = un((await api(p, 'GET', '/api/calendars')).json);
const svcs = un((await api(p, 'GET', '/api/clinic-services')).json);
const acts = un((await api(p, 'GET', '/api/activities')).json);
const A = Array.isArray(acts) ? acts : (acts.activities ?? acts.items ?? Object.values(acts).find(Array.isArray));
console.log('CALENDARS'); for (const c of cals) console.log(' ', c.name, '|', c.id.slice(-4), '| svc', c.clinicServiceId?.slice(-4), '| act', c.activityId?.slice(-4), '| active', c.isActive, '| keys', Object.keys(c).join(','));
console.log('SERVICES'); for (const s of svcs) console.log(' ', s.name, '|', s.id.slice(-4), s.isActive);
console.log('ACTIVITIES'); for (const a of A) console.log(' ', a.name, '| svc', a.clinicServiceId?.slice(-4), a.isActive);
await b.close();
