/* Cancels every live order of the test club 'ZZ test plánování' (the only data the club-planning scripts create). */
import { launch, newPage, login, api, findOrMakeClub } from './lib.mjs';
const b = await launch();
const p = await newPage(b, 'desktop');
await login(p);
const club = await findOrMakeClub(p);
const orders = (await api(p, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json ?? [];
for (const o of orders.filter((x) => x.status !== 'Cancelled')) {
  const r = await api(p, 'POST', `/api/v1/club-orders/${o.id}/cancel?cancelAthletes=false`, {});
  console.log('cancel', o.id.slice(0, 8), o.status, r.status);
}
await b.close();
