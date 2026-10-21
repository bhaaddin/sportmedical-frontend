import { launch, newPage, login, api, startClubOrder } from './lib.mjs';
const b = await launch(); const page = await newPage(b, process.argv[2] ?? 'desktop'); await login(page);
const club = (await api(page, 'GET', '/api/clubs')).json.find((c) => c.name === 'ZZ test plánování');
await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 2, 'Komplexní sportovní prohlídka': 2, 'Spiroergometrické vyšetření': 2 });
await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#adaptive-viewport .plan-card')].map((c) => { const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); return { cls: c.className.replace(/\s+/g, ' ').slice(0, 120), op: cs.opacity, vis: cs.visibility, x: Math.round(r.x), w: Math.round(r.width), tr: cs.transform.slice(0, 40) }; })), null, 1));
console.log(await page.evaluate(() => { const v = document.querySelector('#adaptive-viewport'); const r = v.getBoundingClientRect(); return JSON.stringify({ x: r.x, w: r.width, mask: getComputedStyle(v).maskImage.slice(0, 80), more: [v.dataset.moreBefore, v.dataset.moreAfter], deck: document.querySelector('.adaptive-deck').className }); }));
await b.close();
