// PF-D: /clubs asks for the club summaries ONCE (batch route), seeds the per-club cache, falls back on 404.
// Run: node verify-club-summaries.mjs   (dev stack: frontend :3000, API :5092)
import { launch, login, settle, spa, BASE } from './lib.mjs';

const isSummary = (u) => /\/api\/v1\/clubs\/[^/]+\/summary$/.test(u.pathname);
const isBatch = (u) => u.pathname === '/api/v1/clubs/summaries';

async function run(label, { block404 }) {
  const { browser, page } = await launch();
  const calls = [];
  const bodies = new Map();
  page.on('response', async (resp) => {
    const u = new URL(resp.url());
    if (!isSummary(u) && !isBatch(u)) return;
    let body = null;
    try { body = await resp.json(); } catch { /* none */ }
    calls.push({ at: Date.now(), kind: isBatch(u) ? 'batch' : 'single', path: u.pathname + u.search, status: resp.status() });
    if (isBatch(u) && Array.isArray(body)) body.forEach((r) => bodies.set(`batch:${r.clubId}`, r));
    if (isSummary(u)) bodies.set(`single:${u.pathname.split('/')[4]}`, body);
  });
  if (block404) await page.route('**/api/v1/clubs/summaries**', (route) => route.fulfill({ status: 404, body: '' }));

  await login(page);
  await settle(page);
  calls.length = 0;
  await spa(page, '/clubs');
  await page.waitForSelector('[role="listitem"]');
  await settle(page, 1200);
  const onList = calls.map((c) => `${c.kind} ${c.status}`);
  const cards = await page.$$eval('[role="listitem"]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));

  // open the first card that is active
  calls.length = 0;
  await page.click('[role="listitem"]');
  await settle(page, 1500);
  const afterOpen = calls.map((c) => `${c.kind} ${c.status}`);
  console.log(`\n== ${label} ==`);
  console.log('on /clubs:', onList.length, 'summary requests ->', JSON.stringify(onList.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})));
  console.log('after opening a club:', afterOpen.length, 'summary requests', JSON.stringify(afterOpen));
  console.log('cards:', cards.length);
  await browser.close();
  return { cards, bodies, onList };
}

const batch = await run('batch route (new backend)', { block404: false });
const single = await run('fallback (batch route answers 404)', { block404: true });

// same numbers?
let same = 0, diff = 0;
const clubIds = [...batch.bodies.keys()].filter((k) => k.startsWith('batch:')).map((k) => k.slice(6));
for (const id of clubIds) {
  const a = JSON.stringify(batch.bodies.get(`batch:${id}`));
  const b = single.bodies.has(`single:${id}`) ? JSON.stringify(single.bodies.get(`single:${id}`)) : null;
  if (b === null) continue;
  a === b ? same++ : diff++;
}
console.log(`\nbatch row == single-route body for ${same} clubs, differ for ${diff} (of ${clubIds.length} in batch)`);
const sortC = (c) => [...c].sort().join('\n');
console.log('card texts identical between modes:', sortC(batch.cards) === sortC(single.cards));
if (sortC(batch.cards) !== sortC(single.cards)) {
  console.log('BATCH:\n' + sortC(batch.cards)); console.log('SINGLE:\n' + sortC(single.cards));
}
