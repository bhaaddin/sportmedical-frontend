/*
 * Colour-contrast audit of what is on screen, read from the real browser's computed styles (not from the code).
 *
 * For every visible element of a region it works out
 *   - TEXT: the text colour (alpha and the opacity of every ancestor folded in) against the surface behind it, the
 *     layers of background-colour and gradient stops of every ancestor composited bottom-up (a gradient is judged at
 *     its WORST stop), needing 4.5:1, or 3:1 for large text (>= 24 px, or >= 18.66 px bold);
 *   - ICON: an inline <svg> that draws with a stroke or fill, against the same surface, needing 3:1;
 *   - CONTROL: an input / select / textarea / combobox, whose border (or own fill) must stand out from the surface
 *     it sits on by 3:1 (WCAG 1.4.11).
 * Disabled controls and hidden things are exempt (WCAG 1.4.3). Everything is returned, not asserted: the callers
 * (scripts/stage3b/audit-popouts.mjs, audit-routes.mjs) decide what is a failure and print the counts.
 */

/** Runs INSIDE the page. `rootSelector` limits the region ('body' = the whole page); `viewportOnly` skips what is scrolled out of sight. */
export function auditInPage({ rootSelector, viewportOnly, sample = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = (css) => {
    if (cache.has(css)) return cache.get(css);
    let out = null;
    if (css && css !== 'none' && css !== 'transparent') {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = '#000';
      g.fillStyle = css;
      const s = String(g.fillStyle);
      const hex = /^#([0-9a-f]{6})$/i.exec(s);
      const n = /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s);
      const cs3 = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)$/.exec(s);
      if (cs3) out = { r: +cs3[1] * 255, g: +cs3[2] * 255, b: +cs3[3] * 255, a: cs3[4] === undefined ? 1 : +cs3[4] };
      else if (hex) out = { r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16), a: 1 };
      else if (n) out = { r: +n[1], g: +n[2], b: +n[3], a: n[4] === undefined ? 1 : +n[4] };
    }
    cache.set(css, out);
    return out;
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
      a,
    };
  };
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hexOf = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  /* The candidate surfaces behind an element: one per gradient stop (worst case is judged), composited bottom-up. */
  const surfacesBehind = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const colour = rgba(cs.backgroundColor);
      const img = cs.backgroundImage;
      const stops = img && img !== 'none' && /gradient/.test(img) ? (img.match(/rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/gi) ?? []).map(rgba).filter(Boolean) : [];
      layers.push({ colour, stops });
      if ((colour && colour.a >= 0.999 && stops.length === 0) || (stops.length && stops.every((s) => s.a >= 0.999))) break;
    }
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) {
      const { colour, stops } = layers[i];
      if (colour) cands = cands.map((c) => over(colour, c));
      if (stops.length) cands = cands.flatMap((c) => stops.map((s) => over(s, c)));
      if (cands.length > 24) cands = cands.slice(0, 24);
    }
    return cands;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1'); return o; };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (viewportOnly && (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth)) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (n.hasAttribute('hidden')) return false;
      if (cs.clipPath === 'inset(50%)') return false;
    }
    return true;
  };
  const disabledEl = (el) => !!el.closest('[disabled],[aria-disabled="true"],.Mui-disabled,fieldset:disabled');
  const sel = (el) => {
    const parts = [];
    for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
      const cls = [...n.classList].filter((c) => !/^css-/.test(c)).slice(0, 2).join('.');
      parts.unshift(n.tagName.toLowerCase() + (n.getAttribute('data-testid') ? `[${n.getAttribute('data-testid')}]` : n.id ? '#' + n.id : cls ? '.' + cls : ''));
    }
    return parts.join('>');
  };

  if (sample) {
    /* "Is anything large still dark?": the surface under a 32 x 18 grid of points, and how many of them are darker than DARK_LUMINANCE. */
    const cols = 32;
    const rows = 18;
    let dark = 0;
    const examples = new Map();
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = ((i + 0.5) / cols) * innerWidth;
        const y = ((j + 0.5) / rows) * innerHeight;
        const el = document.elementFromPoint(x, y);
        if (!el) continue;
        const surfaces = surfacesBehind(el);
        if (surfaces.every((c) => lum(c) < 0.1)) {
          dark += 1;
          const k = sel(el);
          examples.set(k, (examples.get(k) ?? 0) + 1);
        }
      }
    }
    return { darkShare: dark / (cols * rows), examples: [...examples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} x${n}`) };
  }
  const roots = [...document.querySelectorAll(rootSelector)];
  const out = [];
  const seen = new Set();
  const consider = (el, kind, fg, need, text) => {
    if (!fg) return;
    const surfaces = surfacesBehind(el);
    const alpha = Math.min(1, fg.a * opacityOf(el));
    let worst = Infinity;
    let worstSurface = surfaces[0];
    for (const s of surfaces) {
      const eff = over({ ...fg, a: alpha }, s);
      const r = ratio(eff, s);
      if (r < worst) { worst = r; worstSurface = s; }
    }
    out.push({ kind, sel: sel(el), text: (text ?? '').slice(0, 40), fg: hexOf(fg) + (alpha < 0.999 ? `@${alpha.toFixed(2)}` : ''), bg: hexOf(worstSurface), ratio: Math.round(worst * 100) / 100, need, pass: worst >= need - 0.005 });
  };
  const SKIP = new Set(['script', 'style', 'head', 'meta', 'link', 'title', 'noscript', 'option', 'path', 'circle', 'rect', 'g', 'defs', 'use', 'line', 'polyline', 'polygon', 'ellipse']);

  for (const root of roots) {
    const all = [root, ...root.querySelectorAll('*')];
    for (const el of all) {
      if (seen.has(el)) continue;
      seen.add(el);
      const tag = el.tagName.toLowerCase();
      if (SKIP.has(tag)) continue;
      if (!visible(el) || disabledEl(el)) continue;
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim() !== '').map((c) => c.textContent.trim()).join(' ');
      if (own !== '' && tag !== 'svg') {
        const px = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = px >= 24 || (px >= 18.66 && bold);
        const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? rgba(cs.webkitTextFillColor) : rgba(cs.color);
        if (fill && fill.a > 0) consider(el, 'text', fill, large ? 3 : 4.5, own);
      }
      if (tag === 'svg' && el.getBoundingClientRect().width >= 8) {
        const stroke = rgba(cs.stroke);
        const fill = rgba(cs.fill);
        const paint = stroke && stroke.a > 0 ? stroke : fill && fill.a > 0 ? fill : null;
        if (paint) consider(el, 'icon', paint, 3, el.getAttribute('aria-label') ?? el.getAttribute('data-testid') ?? '');
      }
      const isField = tag === 'input' || tag === 'textarea' || tag === 'select' || el.getAttribute('role') === 'combobox' || el.classList.contains('MuiOutlinedInput-root');
      if (isField) {
        if (tag === 'input' && ['hidden', 'checkbox', 'radio'].includes(el.type)) continue;
        if (el.classList.contains('MuiInputBase-input') && el.closest('.MuiOutlinedInput-root')) continue; /* judged on the root */
        const parentSurfaces = surfacesBehind(el.parentElement ?? el);
        /* an MUI outlined input draws its border on a child <fieldset> (.MuiOutlinedInput-notchedOutline) */
        const edgeEl = el.classList.contains('MuiOutlinedInput-root') ? el.querySelector(':scope > .MuiOutlinedInput-notchedOutline') ?? el : el;
        const ecs = edgeEl === el ? cs : getComputedStyle(edgeEl);
        const edge = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({ w: parseFloat(ecs[`border${s}Width`]), c: rgba(ecs[`border${s}Color`]), st: ecs[`border${s}Style`] })).find((b) => b.w > 0 && b.st !== 'none' && b.c && b.c.a > 0);
        const fillBg = rgba(cs.backgroundColor);
        let best = 0;
        let worstSurface = parentSurfaces[0];
        for (const s of parentSurfaces) {
          let r = 1;
          if (edge) r = Math.max(r, ratio(over(edge.c, s), s));
          if (fillBg && fillBg.a > 0.05) r = Math.max(r, ratio(over(fillBg, s), s));
          if (best === 0 || r < best) { best = r; worstSurface = s; }
        }
        /* a field the design draws without any boundary (a search line inside a palette, identified by its icon and placeholder) is not a control boundary */
        if (!edge && !(fillBg && fillBg.a > 0.05) && el.closest('.MuiInputBase-root') && !el.closest('.MuiOutlinedInput-root') && !el.closest('.MuiFilledInput-root')) continue;
        out.push({ kind: 'control', sel: sel(el), text: el.getAttribute('aria-label') ?? el.placeholder ?? '', fg: edge ? hexOf(edge.c) : '(fill)', bg: hexOf(worstSurface), ratio: Math.round(best * 100) / 100, need: 3, pass: best >= 3 - 0.005 });
      }
    }
  }
  return out;
}

/** The share (0..1) of the viewport whose surface is darker than relative luminance 0.1, and what paints most of it. */
export async function darkSurfaces(page) {
  return page.evaluate(auditInPage, { rootSelector: 'body', viewportOnly: true, sample: true });
}

export async function auditRegion(page, rootSelector = 'body', { viewportOnly = true } = {}) {
  return page.evaluate(auditInPage, { rootSelector, viewportOnly });
}

/** Reduces a result list to counts and the failures (worst first, de-duplicated by selector and colours). */
export function summarise(items, { includeControls = true } = {}) {
  const used = items.filter((i) => includeControls || i.kind !== 'control');
  const seen = new Set();
  const fails = used
    .filter((i) => !i.pass)
    .filter((i) => { const k = `${i.kind}|${i.sel}|${i.fg}|${i.bg}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.ratio - b.ratio);
  const by = (k) => ({ checked: used.filter((i) => i.kind === k).length, failed: fails.filter((i) => i.kind === k).length });
  return { text: by('text'), icon: by('icon'), control: by('control'), total: used.length, failed: fails.length, fails };
}
