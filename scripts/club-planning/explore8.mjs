import { launch, newPage, login, shot, toasts, findOrMakeClub, startClubOrder } from './lib.mjs';
const b = await launch();
const p = await newPage(b, 'desktop');
await login(p);
const club = await findOrMakeClub(p);
await startClubOrder(p, club.id, { 'Základní sportovní prohlídka': 30, 'Komplexní sportovní prohlídka': 12 });
await p.getByRole('button', { name: 'Měsíc', exact: true }).first().click();
await p.waitForTimeout(500);
for (let i = 0; i < 3; i++) {
  await p.getByRole('button', { name: 'Následující týden' }).first().click();
  await p.waitForTimeout(400);
  console.log(await p.locator('.alternative-head').first().innerText());
}
await b.close();
