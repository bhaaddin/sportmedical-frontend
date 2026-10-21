/* R11: the form token opened on the players' route /klub/:token (what a link typed by hand ends up as). */
import { launch, newPage, login, api, shot, BASE } from './lib.mjs';
const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const club = (await api(page, 'GET', '/api/clubs')).json.find((c) => c.name === 'ZZ test plánování');
const orders = (await api(page, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json;
const order = orders.filter((o) => o.status === 'Invited' && (o.formUrl || o.portalUrl)).pop();
const tok = (order.portalUrl || order.formUrl).split('/').pop();
for (const route of ['/klub/', '/klub-objednavka/']) {
  const p2 = await newPage(browser, 'desktop');
  await p2.goto(BASE + route + tok);
  await p2.waitForTimeout(4500);
  console.log(route, '->', (await p2.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(120, 330));
  await shot(p2, 'r11-5-route-' + route.replace(/\//g, ''));
}
await browser.close();
