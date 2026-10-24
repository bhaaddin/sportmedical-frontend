import { launch, newPage, login, setTheme, waitPlanner } from './lib.mjs';
const [, , mode, route, x, y] = process.argv;
const b = await launch(); const p = await newPage(b); await login(p); await setTheme(p, mode);
await p.goto('http://localhost:3010' + route); await waitPlanner(p).catch(() => {});
const r = await p.evaluate(([x, y]) => {
  const out = [];
  for (let el = document.elementFromPoint(+x, +y); el && out.length < 8; el = el.parentElement) {
    const cs = getComputedStyle(el);
    out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} bg=${cs.backgroundColor} img=${cs.backgroundImage.slice(0, 90)} color=${cs.color} style=${(el.getAttribute('style') || '').slice(0, 100)}`);
  }
  return out;
}, [x, y]);
console.log(r.join('\n'));
await b.close();
