import { launch, newPage, login, shot, boardRect, findOrMakeClub, startClubOrder } from './lib.mjs';
const b = await launch();
const p = await newPage(b, 'desktop');
await login(p);
const club = await findOrMakeClub(p);
await startClubOrder(p, club.id, { 'Základní sportovní prohlídka': 7, 'Komplexní sportovní prohlídka': 5 });
console.log(await boardRect(p));
console.log(await p.evaluate(() => [...document.querySelectorAll('#day-board, #day-board > *')].slice(0, 12).map((e) => e.tagName + '#' + e.id + '.' + e.className + ' ' + JSON.stringify(e.getBoundingClientRect().toJSON()))));
await b.close();
