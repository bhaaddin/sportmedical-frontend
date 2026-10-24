import { launch, newPage, login, setTheme, waitPlanner } from './lib.mjs';
const [, , mode, route, selector, props = 'background,color,opacity'] = process.argv;
const b = await launch(); const p = await newPage(b); await login(p); await setTheme(p, mode);
await p.goto('http://localhost:3010' + route); await waitPlanner(p).catch(() => {}); await p.waitForTimeout(1500);
const r = await p.evaluate(([sel, props]) => {
  const el = document.querySelector(sel); if (!el) return 'none';
  const want = props.split(',');
  const out = [];
  const walk = (rules, ctx) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules, ctx + (r.conditionText ? ' @' + r.conditionText : '')); else if (r.selectorText) { let m = false; try { m = el.matches(r.selectorText); } catch {} if (m) { const hit = want.filter((w) => r.style.getPropertyValue(w) || (w === 'background' && (r.style.background || r.style.backgroundImage))); if (hit.length) out.push(r.selectorText.slice(0, 140) + ' {' + hit.map((w) => w + ':' + (r.style.getPropertyValue(w) || r.style.background || r.style.backgroundImage).slice(0, 80)).join('; ') + '}' + ctx); } } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, ''); } catch {} }
  return out.join('\n') + '\n-- inline: ' + (el.getAttribute('style') || '').slice(0, 200) + '\n-- cls: ' + el.className;
}, [selector, props]);
console.log(r); await b.close();
