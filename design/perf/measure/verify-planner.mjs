import { launch, login, settle, BASE } from './lib.mjs';
import fs from 'fs';
const { browser, page, log } = await launch();
await login(page); await settle(page, 1200);
await page.goto(BASE + '/planovani'); await page.waitForSelector('[data-testid="mini-day-2026-10-26"]'); await settle(page, 1500);
const snap = async (tag) => {
  const txt = await page.evaluate(() => document.querySelector('.sm-planner')?.innerText ?? document.body.innerText);
  const html = await page.evaluate(() => document.querySelectorAll('[data-testid^="appt"],[class*="appointment"],[class*="block"],[data-block]').length);
  return { tag, len: txt.length, txt, html };
};
const out = [];
out.push(await snap('week-now'));
for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Následující týden' }).first().click(); await settle(page, 1200); }
out.push(await snap('week-oct26'));
await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await settle(page, 1200);
out.push(await snap('month'));
await page.getByRole('button', { name: 'Den', exact: true }).first().click(); await settle(page, 1200);
out.push(await snap('day'));
await page.screenshot({ path: `verify-${process.env.TAG}.png` });
fs.writeFileSync(`verify-${process.env.TAG}.json`, JSON.stringify(out.map(o => ({ tag: o.tag, txt: o.txt })), null, 1));
console.log(out.map(o => `${o.tag}: ${o.len} chars, ${o.html} blocks`).join('\n'));
await browser.close();
