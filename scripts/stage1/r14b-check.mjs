/* R14b in the real app: no Rezervace in the Kluby navigation; /clubs/rezervace lands on the orders; Hráči, Statistiky, Fakturace still open. */
import './env.mjs';
import { launch, newPage, login, shot, BASE } from '../club-planning/lib.mjs';
const size = process.argv[2] ?? 'desktop';
const b = await launch();
const page = await newPage(b, size);
await login(page);
await page.goto(BASE + '/clubs/rezervace');
await page.waitForTimeout(2500);
console.log(`[${size}] /clubs/rezervace ->`, new URL(page.url()).pathname, '| h1:', (await page.locator('h1').first().innerText().catch(() => '?')).trim());
const nav = (await page.locator('nav a, nav button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
console.log(`[${size}] nav entries:`, JSON.stringify(nav.filter((t) => /Rezervace|Objednávky klubů|Hráči|Statistiky|Fakturace/.test(t))));
for (const path of ['/clubs/hraci', '/clubs/statistiky', '/clubs/fakturace']) {
  await page.goto(BASE + path);
  await page.waitForTimeout(1500);
  console.log(`[${size}] ${path} ->`, new URL(page.url()).pathname, '| h1:', (await page.locator('h1').first().innerText().catch(() => '?')).trim());
}
await shot(page, `r14b-after-${size}`);
await b.close();
