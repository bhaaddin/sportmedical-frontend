/*
 * Contrast probe for a real page: for every element of a scope that carries text it composites the background through the
 * ancestors and reports the WCAG ratio of the computed text colour against it; `hoverAudit` repeats that while the pointer
 * rests on each interactive element of the scope (the reviewer's "text turns white on a light background").
 * Runs inside the page, so it measures what the browser really paints (computed colours, not the theme's intentions).
 */
export const PROBE = String.raw`(scope, opts) => {
  const parse = (c) => {
    let m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = /^color\(srgb ([^)]+)\)$/.exec(c);
    if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    return null;
  };
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: (top.r * top.a + under.r * under.a * (1 - top.a)) / a, g: (top.g * top.a + under.g * under.a * (1 - top.a)) / a, b: (top.b * top.a + under.b * under.a * (1 - top.a)) / a, a };
  };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    let gradient = false;
    for (const n of chain) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none') gradient = true; }
    // composite properly: walk from the root down
    let canvas = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = chain.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(chain[i]);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) canvas = canvas.a === 0 ? bg : over(bg, canvas);
    }
    if (canvas.a < 1) canvas = over(canvas, { r: 0, g: 20, b: 33, a: 1 }); // the page behind (dark navy) when nothing opaque is found
    return { bg: canvas, gradient };
  };
  const root = typeof scope === 'string' ? document.querySelector(scope) : scope;
  if (!root) return { error: 'scope not found' };
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = (t.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = t.parentElement;
    if (!el || seen.has(el)) continue;
    if (el.closest('[disabled], .Mui-disabled, [aria-disabled=true]')) continue; /* WCAG 1.4.3: disabled controls are exempt */
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    seen.add(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const { bg, gradient } = bgOf(el);
    const eff = over(fg, bg);
    const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const rt = ratio(eff, bg);
    out.push({ text: text.slice(0, 40), ratio: Math.round(rt * 100) / 100, need: large ? 3 : 4.5, fg: cs.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')', gradient, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter((c) => !c.startsWith('css-')).slice(0, 2).join('.') : ''), x: Math.round(r.x), y: Math.round(r.y) });
  }
  return { rows: out };
}`;

export async function probe(page, scope) {
  const r = await page.evaluate(`(${PROBE})(${JSON.stringify(scope)})`);
  if (r.error) throw new Error(r.error);
  return r.rows;
}
export const failing = (rows) => rows.filter((r) => r.ratio < r.need && !r.gradient); /* a gradient fill is not measured by a flat composite */

/** Hover each element matching `interactive` inside `scope`; return the failures seen while it is hovered (de-duplicated by text). */
export async function hoverAudit(page, scope, interactive, { max = 40 } = {}) {
  const handles = await page.locator(interactive.split(',').map((x) => `${scope} ${x.trim()}`).join(', ')).elementHandles();
  const bad = new Map();
  let n = 0;
  for (const h of handles.slice(0, max)) {
    if (!(await h.isVisible())) continue;
    await h.scrollIntoViewIfNeeded().catch(() => {});
    await h.hover({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(120);
    n++;
    const rows = failing(await probe(page, scope)).filter((r) => !r.gradient);
    for (const r of rows) {
      const key = r.text + '|' + r.tag;
      if (!bad.has(key)) bad.set(key, { ...r, hovering: (await h.evaluate((e) => (e.getAttribute('aria-label') || e.innerText || e.className || '').toString().replace(/\s+/g, ' ').slice(0, 40))) });
    }
  }
  await page.mouse.move(0, 0);
  return { hovered: n, bad: [...bad.values()] };
}
