/*
 * The planner's LIGHT look, generated from its dark stylesheets (R15e: "when I click Světlý režim everything must be light").
 *
 *     node scripts/planner-light-css.mjs
 *
 * Reads every planner stylesheet in cascade order (the generated prototype CSS and the hand-written component CSS) and writes
 *
 *     src/planner/styles/planner.light.css
 *
 * which holds ONLY the declarations that carry a colour, each repeated under `html[data-sm-mode="light"]` with the colour
 * translated to the light look (page #EFF1F4, white cards, ink #1A1D21, the picked accent). The dark stylesheets are not
 * touched and the light rules match nothing in dark mode, so dark stays pixel-identical. `data-sm-mode` is put on the
 * document root by AccentRootVars (staff app only); the light file is loaded on demand when the mode is light.
 *
 * Translation rules (`toLight`), by what the colour is used for:
 *   - TEXT (color, fill, stroke, ...): the contrast the colour had on the navy page is kept against WHITE, hue kept for
 *     semantic colours (green, amber, red...), near-white -> the ink, accent chrome (cyan family) -> `--sm-planner-accent-ink`.
 *   - SHADOWS and glows: far fainter (a soft ink shadow, an accent halo at 35 %).
 *   - SURFACES (backgrounds, gradient stops): navy -> the light page / white tints, accent chrome -> the picked accent
 *     (`--sm-planner-accent`), a white veil -> an ink veil of the same alpha, a black scrim -> a light ink scrim.
 *   - LINES (border, outline): navy -> a pale grey-blue hairline, accent chrome -> a tint of the accent.
 * Hand fixes that the translation cannot know live in planner.light.extra.css (written by hand, loaded after this file).
 *
 * Re-run whenever a planner stylesheet changes (a test fails if the generated file is stale).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { parseColor, rgbToHsl, hslToRgb, isAccentChrome, relativeLuminance, toHex, contrastRatio } from '../src/accent.ts';

const contrast = (a, b) => contrastRatio(typeof a === 'string' ? a : a, typeof b === 'string' ? b : { ...b, a: 1 });

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCES = [
  'src/planner/styles/planner.css',
  'src/planner/styles/planner.extras.css',
  'src/planner/styles/planner.fx.css',
  'src/planner/styles/planner.compact.css',
  'src/planner/styles/planner.fluid.css',
  'src/planner/components/board/board.css',
  'src/planner/components/board/phone.css',
  'src/planner/components/board/month/month.css',
  'src/planner/components/left/left.css',
  'src/planner/components/plan/plan.css',
  'src/planner/club/club.css',
  'src/planner/components/dialogs/board/board-dialogs.css',
  'src/planner/components/dialogs/generic/generic.css',
  'src/planner/components/dialogs/leftover/leftover.css',
];
export const OUT = 'src/planner/styles/planner.light.css';
/* Every light rule gains the same (0,1,1) over the dark rule it copies, so the cascade BETWEEN rules (board.css's "repeat the class
   to win" tricks) decides exactly as in dark, and a light copy always out-ranks the dark rule it mirrors whatever order the
   stylesheets load in (the light file is fetched on demand, possibly before a lazily imported dark file). */
export const LIGHT = 'html[data-sm-mode="light"]';
/* Properties that paint: a rule's declaration of one is copied even when it holds no colour literal (`var(--lock-fill)`), so a
   colourless dark rule cannot out-rank the translated copy of an earlier one. */
const PAINT_PROP = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|filter|caret-color|accent-color|text-decoration|text-decoration-color|column-rule|stop-color|-webkit-text-fill-color)$/i;

/* the planner's own accent variables (the picked accent, or the planner tint of Nastavení -> Barvy when one is set; src/accent.ts accentVariables) */
const ACCENT = 'var(--sm-planner-accent, #0D5C52)';
const ACCENT_INK = 'var(--sm-planner-accent-ink, #0D5C52)';
const INK = '#1A1D21';
const NAVY_LUM = 0.0068; /* #001421 */

const TEXT_PROPS = new Set(['color', 'fill', 'stroke', 'caret-color', 'text-decoration-color', '-webkit-text-fill-color', '-webkit-text-stroke', '-webkit-text-stroke-color', 'text-emphasis-color']);
const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', 'filter', 'drop-shadow']);
const LINE_PROPS = /^(border|outline|column-rule)/;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const r3 = (n) => String(Math.round(n * 1000) / 1000);

const HEX = '#[0-9a-fA-F]{8}\\b|#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3,4}\\b';
const COLOR_RE = new RegExp(`hsl\\(from\\s+(?:${HEX}|rgba?\\([^)]*\\))\\s+var\\(--sm-hsl,\\s*h s l\\)\\)|${HEX}|rgba?\\([^)]*\\)|\\b(?:white|black)\\b`, 'g');
const WRAP_RE = new RegExp(`^hsl\\(from\\s+(${HEX}|rgba?\\([^)]*\\))\\s+var\\(--sm-hsl,\\s*h s l\\)\\)$`);

/** Mixes `hsl(var(--sm-accent) ...)` at an alpha: relative colour syntax over the accent. */
const accentAt = (base, alpha) => (alpha >= 0.999 ? base : `rgb(from ${base} r g b / ${r3(alpha)})`);
const neutral = (l, a) => {
  const c = hslToRgb({ h: 215, s: 9, l }, a);
  return a >= 0.999 ? toHex(c) : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${r3(a)})`;
};
const hslOut = (h, s, l, a) => {
  const c = hslToRgb({ h, s, l }, a);
  return a >= 0.999 ? toHex(c) : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${r3(a)})`;
};
/** The lightness at which (h, s) reaches a relative luminance. */
function lightnessForLuminance(h, s, lum) {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (relativeLuminance({ ...hslToRgb({ h, s, l: mid }), a: 1 }) < lum) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One colour (already parsed) -> its light counterpart as CSS text. `use` is 'text' | 'shadow' | 'line' | 'surface' | 'var'. */
export function toLight(rgba, use, solid = false) {
  const { h, s, l } = rgbToHsl(rgba);
  const a = rgba.a;
  const chrome = isAccentChrome({ h, s, l });
  const dark = l < 35;
  const grey = s < 22;
  if (use === 'shadow') {
    if (chrome) return accentAt(ACCENT, a * 0.35);
    if (l >= 80) return `rgba(255, 255, 255, ${r3(a * 0.7)})`;
    return `rgba(20, 24, 28, ${r3(Math.min(a, 1) * 0.16)})`;
  }
  if (use === 'text') {
    if (chrome) return a >= 0.999 ? ACCENT_INK : accentAt(ACCENT_INK, a);
    if (l >= 90 || (l >= 85 && s < 40)) return a >= 0.999 ? INK : `rgba(26, 29, 33, ${r3(a)})`;
    const cr = (relativeLuminance({ ...rgba, a: 1 }) + 0.05) / (NAVY_LUM + 0.05);
    const target = clamp(1.05 / cr - 0.05, 0, 1);
    const ls = grey ? 9 : s;
    const lh = grey ? 215 : h;
    return hslOut(lh, ls, lightnessForLuminance(lh, ls, target), a);
  }
  if (use === 'var') {
    if (chrome) return ACCENT_INK;
    if (l >= 90 || (l >= 85 && s < 40)) return a >= 0.999 ? INK : `rgba(26, 29, 33, ${r3(a)})`;
  }
  /* lines and surfaces */
  if (chrome) {
    if (use === 'line' && l < 60) return accentAt(`color-mix(in srgb, ${ACCENT} 45%, #fff)`, a);
    /* A BRIGHT chrome fill is the accent (the ink on it was turned white by the text rule); a DARK teal panel (l < 30: a pill, a pin, a
       field sunk into the glass, which held bright text) becomes a pale accent tint; a gradient with a bright stop is bright throughout
       (`solid`), so its dark end does not turn pale under white ink. Washes keep their alpha. */
    if (use === 'surface' && l < 30 && !solid) return accentAt(`color-mix(in srgb, ${ACCENT} 14%, #fff)`, a);
    return accentAt(ACCENT, a);
  }
  if (dark) {
    if (a < 0.999 && l < 4 && s < 5) return `rgba(20, 24, 28, ${r3(a * 0.4)})`; /* a black scrim / dim */
    if (use === 'line') return neutral(90 - l * 0.35, a);
    /* surfaces keep their order: the deeper the navy, the paler the paper */
    return neutral(97 + (l / 35) * 3, a);
  }
  if (l >= 80) {
    if (a < 0.999) return `rgba(20, 24, 28, ${r3(a)})`; /* a white veil -> an ink veil */
    return use === 'line' ? neutral(80, a) : neutral(12 + (100 - l), a);
  }
  /* mid tones: muted blues / greys and the semantic hues */
  if (grey || (h >= 190 && h <= 235 && s < 55)) {
    if (use === 'line') return neutral(clamp(100 - l, 62, 84), a);
    /* a mid grey fill reads with neither ink nor white: push it to a clearly dark or clearly light one */
    const m = clamp(100 - l * 0.8, 20, 90);
    return neutral(a >= 0.85 && m > 38 && m < 64 ? (m < 51 ? 34 : 68) : m, a);
  }
  return hslOut(h, s, use === 'line' ? Math.min(l, 55) : l, a);
}

function parse(text) {
  const wrapped = WRAP_RE.exec(text);
  const rgba = parseColor(wrapped ? wrapped[1] : text === 'white' ? '#fff' : text === 'black' ? '#000' : text);
  return rgba;
}

/** The value of one declaration with every colour translated; null when it holds none (or none we can parse). */
export function translateValue(prop, value) {
  const name = prop.toLowerCase();
  /* a mask's colours are alpha masks, not paint */
  if (/mask/.test(name)) return null;
  const use = name.startsWith('--') ? 'var' : TEXT_PROPS.has(name) ? 'text' : SHADOW_PROPS.has(name) ? 'shadow' : LINE_PROPS.test(name) && !/shadow/.test(name) ? 'line' : 'surface';
  /* keep url(...) payloads (embedded SVGs, fragment ids) out of the colour scan */
  const holes = [];
  const masked = value.replace(/url\([^)]*\)/g, (m) => { holes.push(m); return `\u0000${holes.length - 1}\u0000`; });
  let count = 0;
  /* a value with a bright, solid chrome colour is a bright accent fill throughout (see toLight) */
  const solid = use === 'surface' && (masked.match(COLOR_RE) ?? []).some((m) => {
    const c = parse(m);
    if (!c || c.a < 0.6) return false;
    const hsl = rgbToHsl(c);
    return isAccentChrome(hsl) && hsl.l >= 30;
  });
  const translated = masked.replace(COLOR_RE, (m) => {
    const rgba = parse(m);
    if (!rgba) return m;
    count += 1;
    return toLight(rgba, use, solid);
  });
  /* a DATA colour used as TEXT (a činnost's / calendar's tone drawn on a pale card) is darkened to read on light surfaces */
  const DATA_VAR = /var\((--(?:tone|agenda-tone|resize-tone|preview-tone|smart-accent|move-tone|ev-border|cal))(,[^)]*)?\)/g;
  let withData = translated;
  if (use === 'text' && DATA_VAR.test(translated)) {
    DATA_VAR.lastIndex = 0;
    withData = translated.replace(DATA_VAR, (m) => `color-mix(in srgb, ${m} 52%, #000)`);
    count += 1;
  }
  if (count === 0) return null;
  return withData.replace(/\u0000(\d+)\u0000/g, (_, i) => holes[Number(i)]);
}

const prefixSelector = (sel) => {
  const s = sel.trim();
  if (/^(html|:root)\b/.test(s)) return s.replace(/^(html|:root)/, LIGHT);
  if (/^body\b/.test(s)) return s.replace(/^body/, `${LIGHT} body`);
  return `${LIGHT} ${s}`;
};

export function build() {
  const out = [];
  const stats = { rules: 0, decls: 0, keyframes: 0 };
  const keyframeNames = new Set();
  const lightKeyframes = [];

  const processKeyframes = (atRule) => {
    let touched = false;
    const clone = atRule.clone();
    clone.name = 'keyframes';
    clone.params = `${atRule.params}-lt`;
    clone.walkDecls((d) => {
      const v = translateValue(d.prop, d.value);
      if (v !== null) { d.value = v; touched = true; }
    });
    if (touched) { keyframeNames.add(atRule.params); lightKeyframes.push(clone.toString()); stats.keyframes += 1; }
  };

  const lightRule = (rule) => {
    const decls = [];
    rule.each((node) => {
      if (node.type !== 'decl') return;
      const prop = node.prop;
      if (prop.toLowerCase() === 'color-scheme') { decls.push(`color-scheme:light${node.important ? '!important' : ''}`); return; }
      const v = translateValue(prop, node.value);
      if (v !== null) decls.push(`${prop}:${v}${node.important ? '!important' : ''}`);
      else if (PAINT_PROP.test(prop)) decls.push(`${prop}:${node.value}${node.important ? '!important' : ''}`);
    });
    if (decls.length === 0) return null;
    /*
     * TEXT ON ITS OWN FILL. The text rule translates a colour alone (near-white -> ink), but a rule that paints its own fill and sets
     * its own text colour made them a PAIR in dark (white on a teal fill, white on a red pill). The pair is re-solved on the
     * translated fill: the accent fill takes the ink-on-accent, any other opaque fill takes whichever of white / ink reads better.
     */
    /* (a `background-image: var(--hatch)` is a pattern over the page, not a fill the text sits on) */
    const fillDecl = decls.find((d) => /^background(-color|-image)?:/.test(d) && !/^background-image:\s*var\(/.test(d));
    const colorIdx = decls.findIndex((d) => /^color:/.test(d));
    /* (a wash - `rgb(from ACCENT ...)` - or a pale tint - `color-mix(ACCENT n%, #fff)` - is not a solid accent fill) */
    const bareAccent = (d) => d.split(`color-mix(in srgb, ${ACCENT}`).join('').split(`rgb(from ${ACCENT}`).join('').includes(ACCENT);
    const solidAccent = fillDecl !== undefined && bareAccent(fillDecl);
    let ink = null;
    /* a fill that is a DATA colour (`background: var(--cal, ...)`: a calendar's, a činnost's) keeps the text the dark rule chose for it */
    const fillIsData = fillDecl !== undefined && /var\(/.test(fillDecl) && !/--sm-planner-accent/.test(fillDecl) && !/#[0-9a-fA-F]{3}|rgba?\(|hsl/.test(fillDecl.replace(/var\([^)]*\)/g, ''));
    if (fillIsData) {
      const own = rule.nodes.find((n) => n.type === 'decl' && n.prop === 'color');
      if (own && colorIdx >= 0) decls[colorIdx] = `color:${own.value}${own.important ? '!important' : ''}`;
    } else if (solidAccent) ink = 'var(--sm-planner-on-accent, #FFFFFF)';
    else if (fillDecl !== undefined) {
      const stops = (fillDecl.match(new RegExp(`${HEX}|rgba?\([^)]*\)`, 'g')) ?? []).map((m) => parseColor(m)).filter((c) => c && c.a >= 0.85);
      if (stops.length > 0) {
        const worst = (text) => Math.min(...stops.map((c) => contrast(text, c)));
        ink = worst('#FFFFFF') >= worst(INK) ? '#FFFFFF' : INK;
        /* only override when the rule's own text really was a pair with this fill: it sets a colour (or the fill is dark) */
        if (colorIdx < 0 && ink === INK) ink = null;
      }
    }
    if (ink !== null && !fillIsData) {
      if (colorIdx >= 0) decls[colorIdx] = `color:${ink}${decls[colorIdx].includes('!important') ? '!important' : ''}`;
      else decls.push(`color:${ink}`);
    }
    stats.rules += 1;
    stats.decls += decls.length;
    return `${rule.selectors.map(prefixSelector).join(',')}{${decls.join(';')}}`;
  };

  /* Pass 1: which keyframes carry colours. */
  const roots = SOURCES.map((file) => postcss.parse(readFileSync(join(root, file), 'utf8'), { from: file }));
  for (const r of roots) r.walkAtRules(/keyframes$/, processKeyframes);

  /* Pass 2: the rules, keeping at-rule wrappers (@media, @supports, @container, @layer). */
  const walk = (container, emit) => {
    container.each((node) => {
      if (node.type === 'rule') {
        if (node.parent && node.parent.type === 'atrule' && /keyframes$/.test(node.parent.name)) return;
        const text = lightRule(node);
        if (text) emit(text);
        /* a rule that starts an animation which has a light twin points at the twin */
        const anim = node.nodes.find((n) => n.type === 'decl' && /^animation(-name)?$/.test(n.prop));
        if (anim) {
          let v = anim.value;
          let changed = false;
          for (const name of keyframeNames) {
            const re = new RegExp(`(^|[\\s,])${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|[\\s,])`, 'g');
            if (re.test(v)) { v = v.replace(re, `$1${name}-lt`); changed = true; }
          }
          if (changed) emit(`${node.selectors.map(prefixSelector).join(',')}{${anim.prop}:${v}}`);
        }
      } else if (node.type === 'atrule' && !/keyframes$|font-face|property|import|charset/.test(node.name)) {
        const inner = [];
        walk(node, (t) => inner.push(t));
        if (inner.length) emit(`@${node.name} ${node.params}{${inner.join('\n')}}`);
      }
    });
  };
  for (const r of roots) walk(r, (t) => out.push(t));

  const header = `/*\n * GENERATED by scripts/planner-light-css.mjs from the planner's dark stylesheets - do not edit by hand.\n * Every rule sits under ${LIGHT}, so it matches nothing in dark mode. Hand fixes: planner.light.extra.css.\n * ${stats.rules} rules, ${stats.decls} declarations, ${stats.keyframes} keyframes.\n */\n`;
  return header + lightKeyframes.join('\n') + '\n' + out.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = build();
  writeFileSync(join(root, OUT), css);
  console.log(`${OUT}: ${css.length} bytes; ${css.split('\n')[3]}`);
}
