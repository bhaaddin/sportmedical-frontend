import { launch, newPage, login, setTheme, waitPlanner } from './lib.mjs';
const [, , mode, selector] = process.argv;
const b = await launch(); const p = await newPage(b); await login(p); await setTheme(p, mode);
await p.goto('http://localhost:3010/planovani'); await waitPlanner(p).catch(() => {});
await p.locator('[data-testid=mini-day-2026-10-27]').first().hover(); await p.waitForTimeout(1200);
const r = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return 'none'; const out = []; for (let n = el; n && out.length < 6; n = n.parentElement) { const cs = getComputedStyle(n); out.push(n.tagName + '.' + [...n.classList].join('.') + ' bg=' + cs.backgroundColor + ' img=' + cs.backgroundImage.slice(0, 160) + ' color=' + cs.color + ' op=' + cs.opacity); } return out.join('\n'); }, selector);
console.log(r); await b.close();
