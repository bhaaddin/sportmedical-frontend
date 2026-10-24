import { launch, newPage, login, setTheme, waitPlanner, buttons } from './lib.mjs';
const [, , route] = process.argv;
const b = await launch(); const p = await newPage(b); await login(p); await setTheme(p, 'light');
await p.goto('http://localhost:3010' + route); if (/planovani/.test(route)) await waitPlanner(p); else await p.waitForTimeout(2500);
console.log((await buttons(p)).join('\n')); await b.close();
