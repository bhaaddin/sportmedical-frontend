import { launch, newPage, login, setTheme } from './lib.mjs';
const b = await launch(); const p = await newPage(b); await login(p); await setTheme(p, 'light', '#0D9488');
await p.goto('http://localhost:3010/prehled'); await p.waitForTimeout(2500);
const btn = p.getByRole('link', { name: /Rychlá registrace/ }).first();
await btn.hover(); await p.waitForTimeout(400);
console.log(await btn.evaluate((e) => { const cs = getComputedStyle(e); const sv = e.querySelector('svg'); const s = getComputedStyle(sv); return JSON.stringify({ cls: e.className.slice(0, 120), color: cs.color, bg: cs.backgroundColor, svgColor: s.color, fill: s.fill, stroke: s.stroke }); }));
await b.close();
