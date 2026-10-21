/* R11: open the freshly generated form link (read from the API, never typed) in a fresh browser context. */
import { launch, newPage, login, api, shot, BASE } from './lib.mjs';
const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const clubs = (await api(page, 'GET', '/api/clubs')).json;
const club = clubs.find((c) => c.name === 'ZZ test plánování');
const orders = (await api(page, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json;
console.log('orders status', Array.isArray(orders) ? orders.map((o) => o.status + ' ' + (o.formUrl || o.portalUrl || '').replace(/[^/]+$/, '<tok>')) : JSON.stringify(orders).slice(0, 200));
const order = (Array.isArray(orders) ? orders : []).filter((o) => o.status === 'Invited' && (o.formUrl || o.portalUrl)).pop();
if (order) {
  const path = (order.portalUrl || order.formUrl);
  const p2 = await newPage(browser, 'desktop');
  const reqs = [];
  p2.on('response', (r) => { if (r.url().includes('/api/')) reqs.push(r.status() + ' ' + r.url().replace(/[A-Za-z0-9_-]{30,}/g, '<tok>').replace(BASE, '')); });
  await p2.goto(BASE + path.replace(/^https?:\/\/[^/]+/, ''));
  await p2.waitForTimeout(5000);
  console.log('page says:', (await p2.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' '));
  console.log(reqs.join('\n'));
  await shot(p2, 'r11-4-opened');
}
await browser.close();
