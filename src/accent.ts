/*
 * The accent: how the colour a person picks in Nastavení -> Osobní -> Vzhled reaches every pixel of the staff app.
 *
 * LIGHT mode draws the interface in the picked colour itself (`palette.primary.main`).
 *
 * DARK mode is the planner prototype's navy glass with a cyan accent, drawn with hundreds of cyan/aqua/teal
 * values (borders, glows, fills, text). One picked colour cannot be dropped into that by hand, so the pick is
 * turned into a SHIFT of the cyan family:
 *
 *     hue        + dh        (the picked colour's hue minus cyan's)
 *     saturation * ds        (a slate stays a calm grey-blue instead of becoming neon)
 *     lightness  + (100 - l) * kl   (lifted only as far as WCAG AA needs on the navy surfaces and under the dark ink of a button)
 *
 * Only colours that ARE the accent chrome move (`isAccentChrome`: a bright, saturated hue between green-teal and
 * azure); the navy surfaces, the near-white text and the semantic tones (green/amber/red/blue/purple) stay.
 * The same shift is applied in two places and must agree:
 *   - in TypeScript to concrete colours (`shiftColor`) - the MUI theme, which needs real values for `alpha()`;
 *   - in CSS through ONE custom property, `--sm-hsl`, read by `hsl(from <old colour> var(--sm-hsl, h s l))`
 *     (`accentCss`, `wrapCssColors`). When `--sm-hsl` is not set the fallback `h s l` is the identity, so the
 *     default accent paints exactly the colours the files always had.
 *
 * Pure functions only: no DOM, no React, so the generator of the planner stylesheet (a node script) imports this
 * file as well.
 */

export interface Rgba { r: number; g: number; b: number; a: number }
export interface Hsl { h: number; s: number; l: number }
/** The shift of the cyan family that one picked accent stands for. */
export interface AccentShift { dh: number; ds: number; kl: number }

export const IDENTITY_SHIFT: AccentShift = { dh: 0, ds: 1, kl: 0 };

/** The accent that keeps the prototype's cyan family untouched (the default; `THEME_ACCENTS[0]`). */
export const DEFAULT_ACCENT_HEX = '#0D5C52';
/** The prototype's cyan, `--cyan`: the colour every shift is measured from. */
export const CYAN = '#00E6E4';
/** Dark ink on a bright accent fill (`DARK.onCyan`). */
export const ON_ACCENT_INK = '#001E2C';
/** The CSS custom property that carries the shift into stylesheets. */
export const SHIFT_VAR = '--sm-hsl';

/* ------------------------------ parsing and formatting ------------------------------ */

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const to2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` / `rgba()` with commas or spaces; anything else is `null`. */
export function parseColor(input: string): Rgba | null {
  const text = input.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }
  const fn = /^rgba?\(\s*([^)]*)\)$/i.exec(text);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const channel = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    const [r, g, b] = parts.slice(0, 3).map(channel);
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
  }
  return null;
}

/** `#rrggbb` (upper case), or `#rrggbbaa` when not opaque. */
export function toHex({ r, g, b, a }: Rgba): string {
  const base = `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
  return a >= 1 ? base : `${base}${to2(a * 255).toUpperCase()}`;
}

const trimNum = (n: number): string => String(Math.round(n * 1000) / 1000);

/** `rgba(r, g, b, a)` (or `rgb(...)` when opaque). */
export function toRgbString({ r, g, b, a }: Rgba): string {
  const c = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  return a >= 1 ? `rgb(${c})` : `rgba(${c}, ${trimNum(a)})`;
}

export function rgbToHsl({ r, g, b }: Rgba): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d + 6) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl, a = 1): Rgba {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r, g, b] = hn < 60 ? [c, x, 0] : hn < 120 ? [x, c, 0] : hn < 180 ? [0, c, x] : hn < 240 ? [0, x, c] : hn < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a };
}

/* ------------------------------ contrast ------------------------------ */

function channelLuminance(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(color: string | Rgba): number {
  const rgb = typeof color === 'string' ? parseColor(color) : color;
  if (rgb === null) throw new Error(`Not a colour: ${String(color)}`);
  return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b);
}

/** WCAG contrast ratio (1..21) of two opaque colours. */
export function contrastRatio(a: string | Rgba, b: string | Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `top` laid over `bottom` at `alpha` (both opaque inputs); the opaque result. */
export function blend(bottom: string | Rgba, top: string | Rgba, alpha: number): Rgba {
  const b = typeof bottom === 'string' ? parseColor(bottom) : bottom;
  const t = typeof top === 'string' ? parseColor(top) : top;
  if (b === null || t === null) throw new Error('Not a colour');
  return { r: b.r + (t.r - b.r) * alpha, g: b.g + (t.g - b.g) * alpha, b: b.b + (t.b - b.b) * alpha, a: 1 };
}

/**
 * `fg` lifted toward white, a step at a time, until it reads at `target` on `bg` (a colour that already does is returned unchanged,
 * so a default look is never touched).
 */
export function liftToContrast(fg: string, bg: string | Rgba, target = AA): string {
  let color = normalizeHex(fg) ?? fg;
  const bgRgb = typeof bg === 'string' ? (parseColor(bg) as Rgba) : bg;
  for (let step = 0; step < 40 && contrastRatio(color, bgRgb) < target; step++) {
    color = toHex(blend(color, '#FFFFFF', 0.05));
  }
  return color;
}

/* ------------------------------ the shift ------------------------------ */

/**
 * Is this colour accent chrome (moves with the accent) or structure/semantics (stays)?
 * A saturated hue from green-teal to azure that is not nearly black; not the navy surfaces (hue ~196-210, dark), not the
 * near-white text (l >= 90), not greys.
 */
export function isAccentChrome({ h, s, l }: Hsl): boolean {
  return h >= 150 && h <= 195 && s >= 45 && l >= 16 && l < 90;
}

export function isIdentityShift(shift: AccentShift): boolean {
  return shift.dh === 0 && shift.ds === 1 && shift.kl === 0;
}

/**
 * How much of the lightness lift a colour takes: none for the DARK teal surfaces of the prototype (pills, pins, avatar chips, the
 * sunk fields - lightness below 24), all of it from lightness 36 up (the cyan text, lines and bright fills the lift exists for), a
 * ramp between. Without this an orange or purple accent lifted a dark teal pill to a bright one and the light text on it read 1.5:1.
 * The default accent has kl = 0, so nothing moves for it.
 */
export function liftWeight(l: number): number {
  return clamp((l - 24) / 12, 0, 1);
}

export function shiftHsl({ h, s, l }: Hsl, shift: AccentShift): Hsl {
  return {
    h: (((h + shift.dh) % 360) + 360) % 360,
    s: clamp(s * shift.ds, 0, 100),
    l: l + (100 - l) * shift.kl * liftWeight(l),
  };
}

/** One colour moved by the shift; a colour that is not accent chrome, or a shift of nothing, comes back unchanged. */
export function shiftColor(color: string, shift: AccentShift): string {
  if (isIdentityShift(shift)) return color;
  const rgb = parseColor(color);
  if (rgb === null || !isAccentChrome(rgbToHsl(rgb))) return color;
  const moved = hslToRgb(shiftHsl(rgbToHsl(rgb), shift), rgb.a);
  return /^#/.test(color.trim()) ? toHex(moved) : toRgbString(moved);
}

const COLOR_LITERAL = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^()]*\)/g;

/** Every accent-chrome colour literal inside a CSS value (a gradient, a shadow list) moved by the shift. */
export function shiftCssColors(text: string, shift: AccentShift): string {
  if (isIdentityShift(shift)) return text;
  return text.replace(COLOR_LITERAL, (m) => shiftColor(m, shift));
}

/* ------------------------------ the CSS side ------------------------------ */

/** The value of `--sm-hsl`: the three channels of the shift, as `hsl(from ...)` reads them. */
export function shiftExpression(shift: AccentShift): string {
  const n = (v: number) => trimNum(v);
  return `calc(h + ${n(shift.dh)}) calc(s * ${n(shift.ds)}) calc(l + (100 - l) * ${n(shift.kl)} * clamp(0, (l - 24) / 12, 1))`;
}

/** A colour that follows the accent in CSS: the old literal with the shift applied by the browser (identity when `--sm-hsl` is unset). */
export function accentCss(color: string): string {
  return `hsl(from ${color} var(${SHIFT_VAR}, h s l))`;
}

const WRAPPED = /hsl\(from (?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\)) var\(--sm-hsl, h s l\)\)/;
const WRAPPED_OR_LITERAL = new RegExp(`${WRAPPED.source}|${COLOR_LITERAL.source}`, 'g');

/** Wraps each accent-chrome literal of a stylesheet text in `accentCss`; idempotent. Returns the text and how many it wrapped. */
export function wrapCssColors(text: string): { css: string; wrapped: number } {
  let wrapped = 0;
  const css = text.replace(WRAPPED_OR_LITERAL, (m) => {
    if (m.startsWith('hsl(from')) return m;
    const rgb = parseColor(m);
    if (rgb === null || !isAccentChrome(rgbToHsl(rgb))) return m;
    wrapped++;
    return accentCss(m);
  });
  return { css, wrapped };
}

/** Accent-chrome literals still written bare in a stylesheet or source text (what the guard tests look for). */
export function unwrappedAccentColors(text: string): string[] {
  const found: string[] = [];
  text.replace(WRAPPED_OR_LITERAL, (m) => {
    if (m.startsWith('hsl(from')) return m;
    const rgb = parseColor(m);
    if (rgb !== null && isAccentChrome(rgbToHsl(rgb))) found.push(m);
    return m;
  });
  return found;
}

/* ------------------------------ deriving the shift from a picked colour ------------------------------ */

/** Navy surfaces the accent is drawn on in dark mode: page, glass panel, floating (lightest), sunk field. */
export const DARK_SURFACES = ['#001421', '#001A2A', '#042C3D', '#021C2D', '#000C17'] as const;
/** The lightest and the darkest ends of the fills the dark ink sits on (primary button, selected segment, hover). */
const FILL_STOPS = ['#24F8E0', '#06CBBB', '#17EAD8', '#00BDA9', '#4FFFEA', '#1FDCCB', '#3AF4E4', '#10CDB9'] as const;
/** WCAG AA for normal text. */
export const AA = 4.5;

const CYAN_HSL = rgbToHsl(parseColor(CYAN) as Rgba);

export function normalizeHex(input: string): string | null {
  const rgb = parseColor(input);
  return rgb === null || !/^#/.test(input.trim()) ? null : toHex({ ...rgb, a: 1 });
}

/** The accent text colour at a given shift must read on every navy surface and on the tint it sits on. */
function readableAt(shift: AccentShift): boolean {
  const accent = shiftColor(CYAN, shift);
  return (
    DARK_SURFACES.every((s) => contrastRatio(accent, s) >= AA && contrastRatio(accent, blend(s, accent, 0.16)) >= AA) &&
    FILL_STOPS.every((f) => contrastRatio(ON_ACCENT_INK, shiftColor(f, shift)) >= AA)
  );
}

/**
 * The shift of the cyan family for a picked colour. The default accent is the identity, so the prototype's own
 * look is untouched; every other colour moves the hue to its own, keeps its saturation (floored so a grey accent
 * stays a tint, not neon) and lifts the lightness no further than AA needs. An unreadable pick falls back to the
 * identity (the default look), never to something that cannot be read.
 */
export function deriveShift(accentHex: string): AccentShift {
  const hex = sanitizeAccent(accentHex);
  if (hex === DEFAULT_ACCENT_HEX.toUpperCase()) return IDENTITY_SHIFT;
  const hsl = rgbToHsl(parseColor(hex) as Rgba);
  const dh = Math.round((hsl.h - CYAN_HSL.h) * 100) / 100;
  const ds = Math.round(clamp(hsl.s / 100, 0.15, 1) * 100) / 100;
  for (let step = 0; step <= 98; step++) {
    const shift: AccentShift = { dh, ds, kl: step / 100 };
    if (readableAt(shift)) return shift;
  }
  return { dh, ds, kl: 0.98 };
}

/** A light-mode accent must carry white (or dark ink) text and show as a button on a white page: contrast against white of at least this. */
export const MIN_ACCENT_CONTRAST_ON_WHITE = 3;

/**
 * The picked colour as the app stores it: an upper-case `#RRGGBB`. Anything that is not a plain 3/6-digit hex colour,
 * or is too pale to be a button on the light page (a white or near-white pick), is the default accent instead.
 */
export function sanitizeAccent(input: unknown): string {
  if (typeof input !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input.trim())) return DEFAULT_ACCENT_HEX;
  const hex = normalizeHex(input);
  if (hex === null || contrastRatio(hex, '#FFFFFF') < MIN_ACCENT_CONTRAST_ON_WHITE) return DEFAULT_ACCENT_HEX;
  return hex;
}

/* ------------------------------ light mode helpers ------------------------------ */

/** Text colour on a light-mode accent fill: white when it reads (>= AA), otherwise whichever of white/ink reads better. */
export function onAccentText(fill: string): '#FFFFFF' | '#1A1D21' {
  const white = contrastRatio('#FFFFFF', fill);
  if (white >= AA) return '#FFFFFF';
  return contrastRatio('#1A1D21', fill) > white ? '#1A1D21' : '#FFFFFF';
}

/** The accent mixed into white; light mode's hover/selected/soft tints (the forest ones are the board's own, see `lightTints`). */
export function tintOf(accentHex: string, amount: number): string {
  const rgb = parseColor(accentHex);
  if (rgb === null) throw new Error(`Not a colour: ${accentHex}`);
  return toHex(blend('#FFFFFF', rgb, amount));
}

/** The accent mixed into black (pressed / dark variants). */
export function darken(accentHex: string, amount: number): string {
  const rgb = parseColor(accentHex);
  if (rgb === null) throw new Error(`Not a colour: ${accentHex}`);
  return toHex(blend(rgb, '#000000', amount));
}

/**
 * The accent as TEXT on light surfaces: the pick itself when it already reads (>= AA on white and on its own soft tint),
 * otherwise the pick darkened a step at a time until it does (teal and orange are 3.4-3.7:1 as picked). The fill keeps the
 * pick; only text, outlines of text buttons and links use this.
 */
export function accentInk(accentHex: string): string {
  let ink = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;
  for (let step = 0; step < 24; step += 1) {
    const reads = contrastRatio(ink, '#FFFFFF') >= AA && contrastRatio(ink, lightTints(ink).softBg) >= AA;
    if (reads) return ink;
    ink = darken(ink, 0.06);
  }
  return ink;
}

/** Light mode's tints of the accent. The default accent keeps the board's exact hand-picked values. */
export function lightTints(accentHex: string): { hover: string; selected: string; softBg: string; softLine: string } {
  if (normalizeHex(accentHex) === DEFAULT_ACCENT_HEX.toUpperCase() || normalizeHex(accentHex) === null) {
    return { hover: '#E4EEEB', selected: '#D7E9E5', softBg: '#F4F8F7', softLine: '#C9D6D3' };
  }
  return { hover: tintOf(accentHex, 0.11), selected: tintOf(accentHex, 0.16), softBg: tintOf(accentHex, 0.045), softLine: tintOf(accentHex, 0.24) };
}

/* ------------------------------ the custom properties on the document ------------------------------ */

const rgbTriplet = (color: string): string => {
  const c = parseColor(color) as Rgba;
  return `${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}`;
};

/**
 * The custom properties the staff app sets on the document root for a picked accent and mode; `null` values mean
 * "remove it" (the stylesheets' fallbacks are the default look). Nothing at all is set for the default accent.
 *
 *   --sm-hsl           the shift for stylesheets that draw the cyan family (the planner is dark in either mode)
 *   --sm-accent        the colour the interface is drawn in (light: the pick, dark: the shifted cyan)
 *   --sm-accent-rgb    the same as "r, g, b" for rgba(var(--sm-accent-rgb), .15) tints
 *   --sm-on-accent     the text colour on that fill
 *   --sm-tint-*        light mode's soft backgrounds (hover, selected, soft card)
 */
export function accentVariables(accentInput: string, mode: 'light' | 'dark', plannerTintInput?: string | null): Record<string, string | null> {
  const accent = sanitizeAccent(accentInput);
  /* R15d: the planner's own tint. Unset = it follows the accent; set = the planner stage (its CSS, dark and light) draws in it while the rest of the app keeps the accent. */
  const planner = plannerTintInput === undefined || plannerTintInput === null ? accent : sanitizeAccent(plannerTintInput);
  const vars: Record<string, string | null> = {
    [SHIFT_VAR]: null,
    '--sm-accent': null,
    '--sm-accent-light': null,
    '--sm-accent-dark': null,
    '--sm-accent-hover': null,
    '--sm-accent-active': null,
    '--sm-accent-rgb': null,
    '--sm-accent-ink': null,
    '--sm-on-accent': null,
    '--sm-tint-hover': null,
    '--sm-tint-selected': null,
    '--sm-soft-bg': null,
    '--sm-soft-line': null,
    '--sm-planner-accent': null,
    '--sm-planner-accent-ink': null,
    '--sm-planner-on-accent': null,
  };
  /* the planner stage: the dark prototype's cyan family is shifted to the tint; the light layer reads the tint as plain colours */
  if (planner !== DEFAULT_ACCENT_HEX.toUpperCase()) {
    vars[SHIFT_VAR] = shiftExpression(deriveShift(planner));
    if (mode === 'light') {
      vars['--sm-planner-accent'] = planner;
      vars['--sm-planner-accent-ink'] = accentInk(planner);
      vars['--sm-planner-on-accent'] = onAccentText(planner);
    }
  }
  if (accent === DEFAULT_ACCENT_HEX.toUpperCase()) return vars;
  if (mode === 'light') {
    const tints = lightTints(accent);
    vars['--sm-accent'] = accent;
    vars['--sm-accent-light'] = tintOf(accent, 0.7);
    vars['--sm-accent-dark'] = darken(accent, 0.25);
    vars['--sm-accent-hover'] = tintOf(accent, 0.85);
    vars['--sm-accent-active'] = darken(accent, 0.1);
    vars['--sm-accent-rgb'] = rgbTriplet(accent);
    vars['--sm-accent-ink'] = accentInk(accent);
    vars['--sm-on-accent'] = onAccentText(accent);
    vars['--sm-tint-hover'] = tints.hover;
    vars['--sm-tint-selected'] = tints.selected;
    vars['--sm-soft-bg'] = tints.softBg;
    vars['--sm-soft-line'] = tints.softLine;
  } else {
    const shift = deriveShift(accent);
    const main = shiftColor(CYAN, shift);
    vars['--sm-accent'] = main;
    vars['--sm-accent-light'] = shiftColor('#23F2E7', shift);
    vars['--sm-accent-dark'] = shiftColor('#00ADAB', shift);
    vars['--sm-accent-hover'] = shiftColor('#4FFFEA', shift);
    vars['--sm-accent-active'] = shiftColor('#00BDA9', shift);
    vars['--sm-accent-rgb'] = rgbTriplet(main);
    vars['--sm-on-accent'] = ON_ACCENT_INK;
  }
  return vars;
}
