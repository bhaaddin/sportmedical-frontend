/*
 * The hard limits of R18, measured in the page (the same function runs on the old Přehled and the new one, so the numbers
 * in docs/stage4-2026-10.md compare like with like).
 *
 *   elements   distinct visual elements of the CONTENT above the fold: every block / chart / list (a `[data-ov]` of the new
 *              screen, a `section[data-shelf]` of the old one), every card (`[data-card]`) and every button or link that
 *              stands OUTSIDE those - each counted once, nested things not counted again. The navigation chrome (rail /
 *              sidebar, top action bar) is counted separately as `chrome`.
 *   charts     `[data-ov=chart]`, `canvas`, a `[data-chart]`, or an svg with role=img in the content
 *   colours    distinct hue families (40 degree buckets) among the non-neutral colours of text, backgrounds and borders in
 *              the content (saturation > 45%, alpha > .15, not the near-black navy); greys and the theme's blue-greys are neutral
 *   contrast   the lowest text/background contrast ratio found in the content (WCAG AA wants 4.5, 3 for large text)
 *   targets    interactive elements in the content and the chrome smaller than 44px in BOTH directions
 */
export const MEASURE = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const main = document.querySelector('main#main-content') ?? document.body;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.top < vh && r.bottom > 0 && r.left < vw;
  };
  const inChrome = (e) => e.closest('[data-shell="rail"], [data-shell="sidebar"], [data-shell="actions"], [data-shell="bottombar"], [data-shell="topbar"], [data-shell="settings-side"]') !== null;

  /* ── elements ── */
  const blockSel = '[data-ov], section[data-shelf], [data-shelf-page] > header';
  const cardSel = '[data-card]';
  const blocks = [...main.querySelectorAll(blockSel)].filter(visible);
  const cards = [...main.querySelectorAll(cardSel)].filter(visible);
  const counted = [...blocks, ...cards];
  /* a card inside a counted block is the block's own content in the new design but a separate box in the old one: count cards, not their shelf, when a shelf is only a holder */
  const standalone = [...main.querySelectorAll('button, a[href], [role=button]')].filter(
    (e) => visible(e) && !inChrome(e) && !counted.some((c) => c.contains(e)),
  );
  const elements = blocks.length + cards.length + standalone.length;
  const chrome = [...document.querySelectorAll('[data-shell="rail"] a, [data-shell="rail"] button, [data-shell="sidebar"] a, [data-shell="sidebar"] button, [data-shell="actions"] a, [data-shell="actions"] button, [data-shell="topbar"] a, [data-shell="topbar"] button, [data-shell="bottombar"] a, [data-shell="bottombar"] button')].filter(visible).length;

  /* ── charts ── */
  const charts = main.querySelectorAll('[data-ov=chart], canvas, [data-chart], svg[role=img]').length;

  /* ── colours, contrast ── */
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /* A colour is a colour when it is saturated (> 45%) and not the near-black navy of the page; the theme's blue-greys are neutral. */
  const hueOf = ({ r, g, b }) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0 || (max - min) / max < 0.45 || lum({ r, g, b }) < 0.03) return null;
    const d = max - min;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60);
    return (h + 360) % 360;
  };
  const hues = new Map();
  const note = (c, where) => {
    const p = parse(c);
    if (!p || p.a < 0.15) return;
    const h = hueOf(p);
    if (h === null) return;
    const bucket = Math.floor(h / 40) * 40;
    const key = `${bucket}-${bucket + 40}`;
    if (!hues.has(key)) hues.set(key, new Set());
    hues.get(key).add(`${where}:${c}`);
  };
  const luminance = ({ r, g, b }) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /* A gradient fill (the lit primary button, the glass panels) has no single colour to measure against: skipped, and counted. */
  let gradientSkipped = 0;
  const bgOf = (e) => {
    for (let n = e; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const p = parse(cs.backgroundColor);
      if (p && p.a > 0.9) return p;
      if (n !== document.body && cs.backgroundImage.includes('gradient')) return null;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  let worst = { ratio: 99, text: '' };
  for (const e of main.querySelectorAll('*')) {
    if (!visible(e)) continue;
    const cs = getComputedStyle(e);
    note(cs.color, 'color');
    note(cs.backgroundColor, 'bg');
    if (parseFloat(cs.borderTopWidth) > 0) note(cs.borderTopColor, 'border');
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
    if (own) {
      const fg = parse(cs.color);
      const bg = bgOf(e);
      if (bg === null) gradientSkipped++;
      if (fg && fg.a > 0.5 && bg !== null) {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        const adj = ratio / need;
        if (adj < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, need, adj, text: e.textContent.trim().slice(0, 30), color: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})` };
      }
    }
  }

  /* ── tap targets ── */
  const small = [...document.querySelectorAll('main#main-content a[href], main#main-content button, [data-shell] a[href], [data-shell] button, [data-shell] [role=link]')]
    .filter((e) => visible(e) && !e.closest('[data-day]'))
    .map((e) => ({ r: e.getBoundingClientRect(), label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28) }))
    .filter(({ r }) => r.width < 43.5 && r.height < 43.5)
    .map(({ r, label }) => `${label} ${Math.round(r.width)}x${Math.round(r.height)}`);

  return {
    elements,
    parts: { blocks: blocks.length, cards: cards.length, standaloneButtons: standalone.length },
    chrome,
    charts,
    colours: [...hues.keys()].sort(),
    colourSamples: Object.fromEntries([...hues.entries()].map(([k, v]) => [k, [...v].slice(0, 3)])),
    contrastWorst: worst,
    contrastSkippedOnGradient: gradientSkipped,
    smallTargets: small,
    docScroll: document.documentElement.scrollHeight - innerHeight,
    hOverflow: document.documentElement.scrollWidth - innerWidth,
    fitRegionScroll: (() => { const r = document.getElementById('fit-region'); return r ? r.scrollHeight - r.clientHeight : null; })(),
  };
};
