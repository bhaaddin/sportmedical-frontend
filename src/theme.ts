import { createTheme, alpha, type Theme } from '@mui/material/styles';
import {
  DEFAULT_ACCENT_HEX,
  IDENTITY_SHIFT,
  accentInk,
  blend,
  contrastRatio,
  deriveShift,
  liftToContrast,
  parseColor,
  lightTints,
  onAccentText,
  sanitizeAccent,
  shiftCssColors,
  tintOf,
  toHex,
  type AccentShift,
  type Rgba,
} from './accent';

/*
 * The clinic's design language, taken from the board Matko handed over on
 * 3. 10. 2026 ("SportMedical — 10 směrů designu"): a calm, flat, bordered
 * surface in Public Sans, one dark accent, no gradients and no shadows except
 * on things that float (dialogs, menus). Every number here was measured on
 * that board, not invented; the tokens are exported so the calendar grid, the
 * status chips and the public pages draw from one place.
 */

/** The accent colours the doctor can pick for their own workspace (plan: styly). */
export interface ThemeAccent {
  key: string;
  label: string;
  color: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  { key: 'forest', label: 'Lesní zelená', color: '#0D5C52' },
  { key: 'slate', label: 'Břidlicová', color: '#2B3440' },
  { key: 'teal', label: 'Tyrkysová', color: '#0D9488' },
  { key: 'blue', label: 'Modrá', color: '#2563EB' },
  { key: 'purple', label: 'Fialová', color: '#7C3AED' },
  { key: 'orange', label: 'Oranžová', color: '#EA580C' },
];

export type ThemeMode = 'light' | 'dark';

/** The board's fixed values — surfaces, ink, lines, tones and the hatch patterns. */
export const DESIGN = {
  font: '"Public Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ink: '#1A1D21',
  inkSoft: '#14181C',
  muted: '#5A636D',
  faint: '#B3B9C0',
  line: '#E2E6EA',
  lineStrong: '#DCE0E5',
  page: '#EFF1F4',
  paper: '#FFFFFF',
  head: '#F4F6F7',
  radius: { sm: 4, md: 8, lg: 10, xl: 12 },
  /** Soft status tones: chips, badges, KPI numbers. */
  tone: {
    green: { bg: '#E2EBE4', fg: '#27603A', line: '#C7DACB' },
    beige: { bg: '#FBF1E7', fg: '#8A5A2F', line: '#E7CBA9' },
    red: { bg: '#F5E0D8', fg: '#9B3B1B', line: '#E3C3BA' },
    grey: { bg: '#EFF1F4', fg: '#4A5564', line: '#DCE0E5' },
    blue: { bg: '#E3ECF7', fg: '#2B5C9B', line: '#C4D6EE' },
  },
  danger: '#9B3B1B',
  /** The red of the "now" line and its time pill. */
  now: '#C0392B',
  hatch: {
    closed: 'repeating-linear-gradient(135deg, #E4E7EB 0px, #E4E7EB 7px, #F3F5F7 7px, #F3F5F7 14px)',
    closedLine: '#CBD1D8',
    holiday: 'repeating-linear-gradient(135deg, #F2DEC8 0px, #F2DEC8 7px, #FBF1E7 7px, #FBF1E7 14px)',
    holidayLine: '#E7CBA9',
    holidayInk: '#8A5A2F',
  },
  appointment: { bg: '#EFF1F4', bgActive: '#DCE0E5', edge: '#4A5564' },
  selection: { bg: '#D7E9E5', line: '#0D5C52' },
  softPrimary: { bg: '#F4F8F7', line: '#C9D6D3' },
  shadow: {
    menu: '0 12px 32px rgba(20, 24, 28, 0.14)',
    dialog: '0 24px 60px rgba(20, 24, 28, 0.20)',
  },
} as const;

/**
 * The dark theme's fixed values, taken from the top of `design/planner-v65.html`
 * (its `:root` tokens) and its component CSS: a navy page, glass panels with a
 * teal 1px border and a soft glow, cyan/aqua active states. Light mode never
 * reads these.
 */
export const DARK = {
  bg: '#001421',
  bgDeep: '#000C17',
  /** The solid colour behind a glass panel (palette.background.paper). */
  glass: '#001A2A',
  /** A field sunk into a panel. */
  field: '#001425',
  fieldLine: '#22546A',
  line: '#06415A',
  lineLight: '#087E97',
  /** The bright outline of a panel: the prototype's `.glass-panel` border, `rgba(0,223,227,.79)`, as the file draws it. */
  panelLine: 'rgba(0, 223, 227, 0.79)',
  cyan: '#00E6E4',
  aqua: '#23F2E7',
  white: '#F4FAFF',
  muted: '#A3B9CE',
  faint: '#7C93A8',
  green: '#00E5C6',
  blue: '#118CFF',
  purple: '#974BF8',
  amber: '#FFB21F',
  red: '#FF1950',
  /** Ink on a cyan/aqua fill. */
  onCyan: '#001E2C',
  /** Readable text shades of the semantic colours on the dark glass (all >= 4.5:1). */
  text: { green: '#4DF2DA', amber: '#FFC857', red: '#FF7B98', blue: '#6DB5FF', purple: '#B98BFF', grey: '#BCD0E1' },
  /** The panel itself, then a floating surface (dialog, menu). */
  panel: 'linear-gradient(160deg, #001725 0%, #000C1A 74%, #001A25 100%)',
  floating: 'linear-gradient(160deg, #042C3D, #001523 66%, #011B2D)',
  /** The prototype's `.glass-panel` shadow, value for value. */
  panelGlow: '0 0 1px #00EBF7, 0 7px 23px rgba(0, 0, 0, 0.6), 0 0 21px rgba(0, 216, 221, 0.165), inset 0 0 21px rgba(1, 38, 56, 0.38)',
  floatingGlow: '0 28px 90px rgba(0, 0, 0, 0.66), 0 0 35px rgba(0, 226, 228, 0.23), inset 0 0 30px rgba(1, 132, 172, 0.09)',
  /** The primary button, as the prototype's `.oc-create`. */
  primaryFill: 'linear-gradient(105deg, #24F8E0, #06CBBB)',
  primaryFillHover: 'linear-gradient(105deg, #4FFFEA, #1FDCCB)',
  primaryLine: '#0BEAD7',
  primaryGlow: 'inset 0 1px rgba(184, 255, 247, 0.43), 0 0 18px rgba(0, 233, 199, 0.18)',
  primaryGlowHover: 'inset 0 1px rgba(223, 255, 255, 0.8), 0 0 20px rgba(0, 251, 206, 0.55)',
  /** Soft status tones for dark: tinted fill, light text, tinted line. */
  tone: {
    green: { bg: 'rgba(0, 229, 198, 0.12)', fg: '#4DF2DA', line: 'rgba(0, 229, 198, 0.45)' },
    beige: { bg: 'rgba(255, 178, 31, 0.12)', fg: '#FFC857', line: 'rgba(255, 178, 31, 0.45)' },
    red: { bg: 'rgba(255, 25, 80, 0.14)', fg: '#FF7B98', line: 'rgba(255, 25, 80, 0.5)' },
    grey: { bg: 'rgba(163, 185, 206, 0.10)', fg: '#BCD0E1', line: 'rgba(163, 185, 206, 0.30)' },
    blue: { bg: 'rgba(17, 140, 255, 0.14)', fg: '#6DB5FF', line: 'rgba(17, 140, 255, 0.5)' },
  },
} as const;

type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };
/**
 * The soft accent surfaces of LIGHT mode as CSS values that follow the picked accent (AccentRootVars sets
 * --sm-soft-bg / --sm-soft-line for any accent but the default; the fallbacks are the board's forest values,
 * i.e. DESIGN.softPrimary). For code that has no theme at hand; code with a theme reads tintsOf(theme).
 */
export const ACCENT_SOFT = {
  bg: 'var(--sm-soft-bg, #F4F8F7)',
  line: 'var(--sm-soft-line, #C9D6D3)',
} as const;

/** The border of an input / select, >= 3:1 against every surface a field sits on (WCAG 1.4.11): the prototype's #22546A was 2.3:1, the board's #E2E6EA 1.2:1. */
export const FIELD_EDGE = { light: '#7C858F', dark: '#4A8BA5' } as const;
/** A hovered field's border in light: darker than the resting one, still neutral (the accent at 50 % was 2.2:1). */
const FIELD_EDGE_HOVER = '#4A5564';

export type DarkTokens = Widen<typeof DARK>;

/**
 * The dark theme's tokens for a picked accent: the accent chrome (cyan, aqua, the lit border, the primary fill and its
 * glows) moved by the accent's shift, everything else - the navy surfaces, the white ink, the semantic green/amber/red/
 * blue/purple tones - exactly as the prototype has it. With the default accent (the identity shift) this IS `DARK`.
 */
export function darkTokens(shift: AccentShift): DarkTokens {
  const c = (value: string): string => shiftCssColors(value, shift);
  return {
    ...DARK,
    tone: { ...DARK.tone },
    text: { ...DARK.text },
    cyan: c(DARK.cyan),
    aqua: c(DARK.aqua),
    lineLight: c(DARK.lineLight),
    panelLine: c(DARK.panelLine),
    panelGlow: c(DARK.panelGlow),
    floatingGlow: c(DARK.floatingGlow),
    primaryFill: c(DARK.primaryFill),
    primaryFillHover: c(DARK.primaryFillHover),
    primaryLine: c(DARK.primaryLine),
    primaryGlow: c(DARK.primaryGlow),
    primaryGlowHover: c(DARK.primaryGlowHover),
  };
}

declare module '@mui/material/styles' {
  interface Theme {
    /** The dark tokens for the accent this theme was built with (the prototype's `DARK` for the default accent). */
    smDark: DarkTokens;
    /** The accent's shift of the cyan family (the identity for the default accent). */
    smShift: AccentShift;
    /** Light mode's tints of the accent: hover, selected, soft card background and line. */
    smTints: { hover: string; selected: string; softBg: string; softLine: string };
  }
  interface ThemeOptions {
    smDark?: DarkTokens;
    smShift?: AccentShift;
    smTints?: { hover: string; selected: string; softBg: string; softLine: string };
  }
}

/** The dark tokens a theme was built with (the prototype's own for a theme not made by buildTheme, e.g. MUI's default in a test). */
export function darkOf(theme: Theme): DarkTokens {
  return theme.smDark ?? darkTokens(IDENTITY_SHIFT);
}

/** The accent's shift a theme was built with (the identity for a theme not made by buildTheme). */
export function shiftOf(theme: Theme): AccentShift {
  return theme.smShift ?? IDENTITY_SHIFT;
}

/** The sunken header / footer surface of a panel for the theme's mode: the board's pale grey in light, a faint cyan veil on the glass in dark. */
export function headSurface(theme: Theme): string {
  return theme.palette.mode === 'light' ? DESIGN.head : alpha(darkOf(theme).cyan, 0.07);
}

/** The accent as TEXT for the theme's mode (>= AA on the surface): the pick darkened where needed in light, the bright primary in dark. */
export function accentInkOf(theme: Theme): string {
  return theme.palette.mode === 'light' ? accentInk(theme.palette.primary.main) : theme.palette.primary.main;
}

/** Light mode's accent tints a theme was built with (the board's forest tints for a theme not made by buildTheme). */
export function tintsOf(theme: Theme): { hover: string; selected: string; softBg: string; softLine: string } {
  return theme.smTints ?? lightTints(DEFAULT_ACCENT_HEX);
}

/** A cyan-family literal (a hex or rgba from the prototype) moved to the accent this theme was built with. */
export function accentLiteral(theme: Theme, literal: string): string {
  return shiftCssColors(literal, shiftOf(theme));
}

/**
 * The soft status tones as CSS values that follow the mode: the theme sets `--sm-tone-<tone>-<bg|fg|line>` on `:root` (light: the
 * board's pastels, dark: tinted glass), so a component that has no theme at hand - or writes `sx={{ bgcolor: ... }}` with a plain
 * string - never paints a light pastel on the dark app. The fallback is the light value.
 */
export const TONE_CSS = Object.fromEntries(
  (Object.keys(DESIGN.tone) as Array<keyof typeof DESIGN.tone>).map((k) => [
    k,
    { bg: `var(--sm-tone-${k}-bg, ${DESIGN.tone[k].bg})`, fg: `var(--sm-tone-${k}-fg, ${DESIGN.tone[k].fg})`, line: `var(--sm-tone-${k}-line, ${DESIGN.tone[k].line})` },
  ]),
) as Record<keyof typeof DESIGN.tone, { bg: string; fg: string; line: string }>;

/** One of the soft status tones for the theme's mode: the board's pastels in light, tinted glass in dark. */
export function toneColors(theme: Theme, tone: keyof typeof DESIGN.tone): { bg: string; fg: string; line: string } {
  return theme.palette.mode === 'light' ? DESIGN.tone[tone] : DARK.tone[tone];
}

/**
 * ONE surface token set for everything that floats (R5): dialog, menu, popover, select list, autocomplete list, drawer, the
 * planner's own dialogs and bubbles. The MUI paper overrides below and the CSS custom properties `--sm-pop-*` (set on `:root`
 * by the theme in BOTH modes, so a stylesheet or a piece of inline CSS can read them) come from here, and the contrast tests
 * read the same table - a pop-out component must take these, never a colour of its own (src/theme.popouts.guard.test.ts).
 */
export interface PopoutTokens {
  /** The colour a pop-out's text is judged against: the solid surface, or - on the dark glass gradient - each of its stops (see `stops`). */
  paper: string;
  /** Every colour the surface paints (a gradient has three): text must read on all of them. */
  stops: string[];
  border: string;
  text: string;
  muted: string;
  /** A hovered item over the surface (translucent, composite it over `paper`). */
  hover: string;
  /** A selected item over the surface. */
  selected: string;
}

export function popoutTokens(accentInput: string, mode: ThemeMode): PopoutTokens {
  const accent = sanitizeAccent(accentInput);
  const shift = deriveShift(accent);
  if (mode === 'light') {
    return { paper: DESIGN.paper, stops: [DESIGN.paper], border: DESIGN.line, text: DESIGN.ink, muted: DESIGN.muted, hover: '#F4F6F7', selected: lightTints(accent).selected };
  }
  const D = darkTokens(shift);
  const c = (value: string): string => shiftCssColors(value, shift);
  return {
    paper: '#042C3D',
    stops: ['#042C3D', '#001523', '#011B2D'],
    border: c('rgba(0, 224, 232, 0.5)'),
    text: D.white,
    muted: D.muted,
    hover: alpha(D.cyan, 0.09),
    selected: alpha(D.cyan, 0.14),
  };
}

/**
 * The clinic's theme, built for a chosen accent and light/dark mode. The accent
 * is the one thing a doctor picks; the shape, typography and the colour of every
 * surface stay fixed, so a colour choice tunes the product without turning it
 * into a different one.
 *
 * Dark mode is the partner's planner prototype (`design/planner-v65.html`, the
 * owner's instruction of 17. 10. 2026): a navy glass dashboard with teal
 * borders and a cyan primary. The picked accent reaches both modes: light draws
 * in the colour itself, dark moves the prototype's cyan family to the pick's hue
 * (src/accent.ts). The default accent is the identity - the prototype exactly.
 */
export function buildTheme(accentInput: string, mode: ThemeMode): Theme {
  const light = mode === 'light';
  /* A stored value that is not a colour falls back to the default instead of poisoning the palette. */
  const accentColor = sanitizeAccent(accentInput);
  const shift = deriveShift(accentColor);
  const D = darkTokens(shift);
  /* A cyan-family literal, moved to the accent (a no-op for the default accent). */
  const c = (value: string): string => shiftCssColors(value, shift);
  const tints = lightTints(accentColor);
  /* The accent as text on a light surface (AA); the dark theme's primary is already bright on the glass. */
  const inkAccent = light ? accentInk(accentColor) : D.cyan;
  const onAccent = onAccentText(accentColor);
  /* The colour the interface is drawn in: the doctor's accent in light, the accent's cyan family in dark. */
  const primary = light ? accentColor : D.cyan;
  const line = light ? DESIGN.line : D.line;
  const page = light ? DESIGN.page : D.bg;
  const paper = light ? DESIGN.paper : D.glass;
  const ink = light ? DESIGN.ink : D.white;
  const muted = light ? DESIGN.muted : D.muted;
  const head = light ? DESIGN.head : alpha(D.cyan, 0.07);
  const hover = light ? '#F4F6F7' : alpha(D.cyan, 0.09);
  /* A card's outline: the board's hairline in light, the glass panel's teal edge in dark. */
  const edge = light ? line : D.panelLine;
  const menuEdge = popoutTokens(accentColor, mode).border;
  /* What floats (menus, popovers, dialogs): the board's white with a shadow, the prototype's lit glass in dark. */
  const floating = light ? {} : { backgroundImage: D.floating };
  const pop = popoutTokens(accentColor, mode);
  /* a hovered field in dark: the primary at 50 % as the prototype has it - stronger only where that would be under 3:1 (a lifted orange or purple) */
  const fieldHoverDark = (() => {
    const base = parseColor(D.cyan) as Rgba;
    const alphaOk = [0.5, 0.6, 0.7, 0.85, 1].find((a) => [D.field, pop.paper, D.glass].every((s) => contrastRatio(toHex(blend(s, base, a)), s) >= 3)) ?? 1;
    return alpha(D.cyan, alphaOk);
  })();
  const toneFor = (tone: keyof typeof DESIGN.tone) => (light ? DESIGN.tone[tone] : D.tone[tone]);

  return createTheme({
    smDark: D,
    smShift: shift,
    smTints: tints,
    palette: {
      mode,
      primary: light
        ? {
            main: accentColor,
            contrastText: onAccent,
            /* A fill that takes dark ink (orange, teal) must get LIGHTER on hover: MUI's default (darker) drops dark ink below AA. */
            ...(onAccent === '#FFFFFF' ? {} : { dark: tintOf(accentColor, 0.86) }),
          }
        : { main: D.cyan, light: D.aqua, dark: c('#00ADAB'), contrastText: D.onCyan },
      secondary: { main: light ? '#2B3440' : '#D6EAF4' },
      background: { default: page, paper },
      text: { primary: ink, secondary: muted, disabled: light ? DESIGN.faint : '#6F8399' },
      success: light
        ? { main: '#27603A', light: DESIGN.tone.green.bg, contrastText: '#FFFFFF' }
        : { main: D.green, light: D.tone.green.bg, contrastText: D.onCyan },
      warning: light
        ? { main: '#8A5A2F', light: DESIGN.tone.beige.bg, contrastText: '#FFFFFF' }
        : { main: D.amber, light: D.tone.beige.bg, contrastText: D.onCyan },
      error: light
        ? { main: '#9B3B1B', light: DESIGN.tone.red.bg, contrastText: '#FFFFFF' }
        : { main: '#FF6B88', light: D.tone.red.bg, contrastText: D.onCyan },
      info: light
        ? { main: '#2B5C9B', light: DESIGN.tone.blue.bg, contrastText: '#FFFFFF' }
        : { main: '#5BB0FF', light: D.tone.blue.bg, contrastText: D.onCyan },
      divider: line,
      action: light
        ? { hover: alpha(ink, 0.04), selected: alpha(accentColor, 0.08), focus: alpha(accentColor, 0.12) }
        : {
            active: D.muted,
            hover: alpha(D.cyan, 0.09),
            selected: alpha(D.cyan, 0.14),
            focus: alpha(D.cyan, 0.16),
          },
    },
    shape: { borderRadius: DESIGN.radius.lg },
    typography: {
      fontFamily: DESIGN.font,
      fontSize: 14,
      h1: { fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h2: { fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h3: { fontWeight: 700, fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.2 },
      h4: { fontWeight: 800, fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.25 },
      h5: { fontWeight: 800, fontSize: 21, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h6: { fontWeight: 700, fontSize: 18, letterSpacing: '-0.005em', lineHeight: 1.35 },
      subtitle1: { fontWeight: 600, fontSize: 15 },
      subtitle2: { fontWeight: 600, fontSize: 13 },
      body1: { fontSize: 15, lineHeight: 1.5 },
      body2: { fontSize: 14, lineHeight: 1.5 },
      caption: { fontSize: 12, lineHeight: 1.4 },
      overline: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
      },
      button: { fontWeight: 600, letterSpacing: 0, textTransform: 'none', fontSize: 14 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          /* ACCENT_SOFT (a selected card, a soft panel) reads these two; in dark they are tinted glass, never the light mode's pale fill
             (white text on a pale fill was the "white on light when hovering" of the booking bubble). AccentRootVars sets them only in light. */
          ':root': {
            ...(light ? {} : { '--sm-soft-bg': c('rgba(0, 230, 228, 0.14)'), '--sm-soft-line': c('rgba(0, 224, 232, 0.5)') }),
            /* the pop-out surface tokens (popoutTokens): the same values the MUI paper overrides use, for CSS that has no theme at hand */
            '--sm-pop-paper': pop.paper,
            '--sm-pop-border': pop.border,
            '--sm-pop-text': pop.text,
            '--sm-pop-muted': pop.muted,
            '--sm-pop-hover': pop.hover,
            '--sm-pop-selected': pop.selected,
            ...Object.fromEntries((Object.keys(DESIGN.tone) as Array<keyof typeof DESIGN.tone>).flatMap((k) => [
              [`--sm-tone-${k}-bg`, toneFor(k).bg], [`--sm-tone-${k}-fg`, toneFor(k).fg], [`--sm-tone-${k}-line`, toneFor(k).line],
            ])),
          },
          body: {
            backgroundColor: page,
            color: ink,
            fontFamily: DESIGN.font,
            ...(light
              ? {}
              : {
                  /* The prototype's page: a deep navy with a teal light from the top right. */
                  backgroundImage: 'radial-gradient(ellipse at 85% 0%, #05364C 0%, transparent 44%), linear-gradient(120deg, #00111E, #00182A 70%, #00131F)',
                  backgroundAttachment: 'fixed',
                  scrollbarColor: `#0A5670 ${D.bg}`,
                }),
          },
          '::selection': { backgroundColor: alpha(primary, light ? 0.18 : 0.35) },
          /*
           * Touch (phone and tablet, below the desktop's 1280): every control is at least 44 px in both directions
           * (constitution VI). One block here instead of a size on every button; the dense desktop keeps its own sizes.
           * `body ` in front lifts these above the components' own single-class rules.
           */
          '@media (max-width: 1279.95px)': {
            'body .MuiButton-root, body .MuiToggleButton-root, body .MuiTab-root, body .MuiMenuItem-root, body .MuiListItemButton-root': { minHeight: 44 },
            'body .MuiIconButton-root:not(.MuiPickersArrowSwitcher-button)': { minWidth: 44, minHeight: 44 },
            'body .MuiButton-root': { minWidth: 44 },
            'body .MuiInputBase-input:not(.MuiInputBase-inputMultiline)': { minHeight: 44, boxSizing: 'border-box' },
            'body .MuiCheckbox-root, body .MuiRadio-root': { padding: 10 },
            'body .MuiCheckbox-sizeSmall, body .MuiRadio-sizeSmall': { padding: 12 },
            'body .MuiSwitch-root:not(.MuiSwitch-sizeSmall)': { height: 44, padding: '11px 8px' },
            'body .MuiSwitch-root:not(.MuiSwitch-sizeSmall) .MuiSwitch-switchBase': { padding: 12, left: -3, top: 0 },
            'body .MuiChip-root.MuiChip-clickable': { minHeight: 44 },
            /* The round filter / calendar pills (a ButtonBase that says aria-pressed). */
            'body .MuiButtonBase-root[aria-pressed]': { minHeight: 44, minWidth: 44 },
          },
          ...(light
            ? {}
            : {
                /* The planner's host paints the prototype's own page colour (#000c17) around the 1672x941 stage; inside the
                   application the page is the shell's navy, so no off-colour frame shows around (or edge shows at the rim of) the stage;
                   the stage's own glow gradients stay. */
                'body .sm-planner': { backgroundColor: 'transparent' },
                /* The stage's own page is a vertical navy gradient of its own; inside the application it is the shell's page, with only the file's soft glow at the bottom kept. */
                'body .sm-planner #dashboard.live-mode': {
                  backgroundColor: 'transparent',
                  background: 'radial-gradient(ellipse 62% 28% at 65% 94%, rgba(0, 103, 139, 0.18), transparent 83%)',
                },
                '*::-webkit-scrollbar': { width: 10, height: 10 },
                '*::-webkit-scrollbar-track': { background: 'transparent' },
                '*::-webkit-scrollbar-thumb': {
                  backgroundColor: '#0A5670',
                  borderRadius: 999,
                  border: `2px solid ${D.bg}`,
                },
                '*::-webkit-scrollbar-thumb:hover': { backgroundColor: D.lineLight },
              }),
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: light
            ? {}
            : { '&:not(.MuiBackdrop-invisible)': { backgroundColor: 'rgba(0, 7, 16, 0.73)', backdropFilter: 'blur(5px)' } },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            /* The prototype's buttons are 7px (`.app-button`, `#club-edit-link`); light keeps the board's 10. */
            borderRadius: light ? DESIGN.radius.lg : 7,
            textTransform: 'none',
            fontWeight: 600,
            paddingInline: 16,
            minHeight: 40,
            boxShadow: 'none',
          },
          sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: 13 },
          sizeLarge: { minHeight: 48, paddingInline: 22, fontSize: 15 },
          contained: light
            ? {
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }
            : {
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
                /* The prototype's `.oc-create`: an aqua gradient, dark ink, a lit edge. */
                '&.MuiButton-colorPrimary': {
                  background: D.primaryFill,
                  color: D.onCyan,
                  border: `1px solid ${D.primaryLine}`,
                  boxShadow: D.primaryGlow,
                  fontWeight: 700,
                  '&:hover': { background: D.primaryFillHover, boxShadow: D.primaryGlowHover },
                  '&.Mui-disabled': {
                    background: alpha(D.cyan, 0.14),
                    color: 'rgba(163, 185, 206, 0.6)',
                    borderColor: alpha(D.cyan, 0.2),
                    boxShadow: 'none',
                  },
                },
                /* The prototype's `.app-button.danger`: a dark wine fill, a rose edge, white ink. */
                '&.MuiButton-colorError': {
                  background: '#5F1631',
                  color: '#FFFFFF',
                  border: '1px solid #BC3459',
                  '&:hover': { background: '#7A1C3E', boxShadow: 'none' },
                },
              },
          outlined: {
            borderColor: light ? line : '#306077',
            backgroundColor: light ? paper : '#021C2D',
            color: ink,
            ...(light
              ? {}
              : {
                  /* The prototype's secondary button (`#club-edit-link`): a teal-to-navy gradient, a lit edge, ink that is nearly white. */
                  backgroundImage: 'linear-gradient(105deg, #063649, #072A3D)',
                  borderColor: c('rgba(50, 181, 199, 0.79)'),
                  color: '#DDFFFF',
                  boxShadow: 'inset 0 1px rgba(255, 255, 255, 0.07), 0 2px 8px rgba(0, 0, 0, 0.4)',
                }),
            '&:hover': {
              backgroundColor: light ? hover : '#0C384C',
              borderColor: light ? DESIGN.lineStrong : c('#74FFF4'),
              ...(light ? {} : { backgroundImage: c('linear-gradient(105deg, #07576B, #074154)'), boxShadow: `0 0 12px ${c('rgba(4, 235, 221, 0.21)')}` }),
            },
            '&.MuiButton-colorPrimary': {
              color: light ? inkAccent : '#DDFFFF',
              borderColor: light ? alpha(primary, 0.35) : c('rgba(50, 181, 199, 0.79)'),
            },
            '&.MuiButton-colorError': {
              color: light ? DESIGN.danger : D.text.red,
              borderColor: toneFor('red').line,
              ...(light ? {} : { backgroundImage: 'none' }),
            },
          },
          /* the accent as TEXT only where it must differ from the pick (orange, teal): the default accent's picture is unchanged */
          text: { '&:hover': { backgroundColor: hover }, ...(light && inkAccent !== accentColor ? { '&.MuiButton-colorPrimary': { color: inkAccent } } : {}) },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: DESIGN.radius.md },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ ownerState }) => ({
            backgroundImage: 'none',
            borderRadius: DESIGN.radius.xl,
            ...(ownerState.elevation !== undefined && ownerState.elevation >= 16
              ? { boxShadow: light ? DESIGN.shadow.dialog : D.floatingGlow, ...floating, ...(light ? {} : { border: `1px solid ${menuEdge}` }) }
              : ownerState.elevation !== undefined && ownerState.elevation >= 8
                ? { boxShadow: light ? DESIGN.shadow.menu : D.floatingGlow, border: `1px solid ${menuEdge}`, ...floating }
                : ownerState.variant === 'outlined'
                  ? { boxShadow: light ? 'none' : D.panelGlow, borderColor: edge }
                  : { boxShadow: light ? 'none' : D.panelGlow, border: `1px solid ${edge}` }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.xl,
            border: `1px solid ${edge}`,
            boxShadow: light ? 'none' : D.panelGlow,
            backgroundImage: light ? 'none' : D.panel,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: {
          root: {
            backgroundColor: light ? paper : 'rgba(0, 19, 33, 0.94)',
            color: ink,
            borderBottom: `1px solid ${light ? line : D.lineLight}`,
            boxShadow: 'none',
            backgroundImage: 'none',
            ...(light ? {} : { backdropFilter: 'blur(14px)' }),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            backgroundImage: light ? 'none' : D.panel,
            boxShadow: 'none',
            ...(light ? {} : { borderRight: `1px solid ${D.lineLight}` }),
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: light ? 'none' : `1px solid ${c('rgba(0, 224, 232, 0.6)')}`,
            boxShadow: light ? DESIGN.shadow.dialog : D.floatingGlow,
            ...floating,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: 20, fontWeight: 700, padding: '20px 24px 8px' } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '8px 24px 16px' } },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '12px 24px 20px', gap: 8, borderTop: `1px solid ${line}` },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: DESIGN.radius.lg,
            boxShadow: light ? DESIGN.shadow.menu : D.floatingGlow,
            border: `1px solid ${menuEdge}`,
            ...floating,
          },
          list: { padding: 6 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.md,
            fontSize: 14,
            minHeight: 36,
            '&:hover': { backgroundColor: hover },
            /* the aqua text, lifted only as far as AA on the selected item (the cyan wash over the glass) needs: a no-op for the default accent */
            ...(light ? {} : { '&.Mui-selected': { backgroundColor: alpha(D.cyan, 0.14), color: liftToContrast(D.aqua, blend(pop.paper, parseColor(D.cyan) as Rgba, 0.14)) } }),
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: DESIGN.radius.lg,
            boxShadow: light ? DESIGN.shadow.menu : D.floatingGlow,
            border: `1px solid ${menuEdge}`,
            ...floating,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 12,
            height: 24,
            /* Dark chips are tinted glass with a coloured line, never a flat bright fill (see the colour slots below). */
            ...(light
              ? {}
              : { backgroundColor: D.tone.grey.bg, color: D.tone.grey.fg, border: `1px solid ${D.tone.grey.line}` }),
          },
          sizeSmall: { height: 22, fontSize: 11 },
          label: { paddingInline: 10 },
          outlined: { borderColor: line },
          ...(light
            ? {}
            : {
                colorPrimary: { backgroundColor: alpha(D.cyan, 0.12), color: D.aqua, borderColor: alpha(D.cyan, 0.5) },
                colorSecondary: { backgroundColor: D.tone.grey.bg, color: D.tone.grey.fg, borderColor: D.tone.grey.line },
                colorSuccess: { backgroundColor: D.tone.green.bg, color: D.tone.green.fg, borderColor: D.tone.green.line },
                colorWarning: { backgroundColor: D.tone.beige.bg, color: D.tone.beige.fg, borderColor: D.tone.beige.line },
                colorError: { backgroundColor: D.tone.red.bg, color: D.tone.red.fg, borderColor: D.tone.red.line },
                colorInfo: { backgroundColor: D.tone.blue.bg, color: D.tone.blue.fg, borderColor: D.tone.blue.line },
              }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.lg,
            backgroundColor: light ? paper : D.field,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: FIELD_EDGE[mode] },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: light ? FIELD_EDGE_HOVER : fieldHoverDark },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: primary },
            ...(light ? {} : { '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(D.cyan, 0.14)}` } }),
          },
          input: { paddingTop: 11, paddingBottom: 11 },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: 14 } },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 2 } },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: DESIGN.radius.xl } },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: muted,
              backgroundColor: head,
              borderBottom: `1px solid ${line}`,
              paddingTop: 10,
              paddingBottom: 10,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${line}`, padding: '12px 16px', fontSize: 14 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:last-child td': { borderBottom: 0 }, '&.MuiTableRow-hover:hover': { backgroundColor: hover } },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: { backgroundColor: light ? paper : D.field, borderRadius: DESIGN.radius.lg },
          grouped: {
            border: `1px solid ${light ? line : D.lineLight}`,
            '&:not(:first-of-type)': { marginLeft: -1, borderLeft: `1px solid ${light ? line : D.lineLight}` },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            color: ink,
            paddingInline: 14,
            minHeight: 38,
            '&.Mui-selected': light
              ? {
                  backgroundColor: accentColor,
                  color: onAccent,
                  borderColor: accentColor,
                  '&:hover': { backgroundColor: accentColor },
                }
              : {
                  /* The prototype's Den / Týden / Měsíc: the selected segment is lit teal with dark ink. */
                  background: c('linear-gradient(105deg, #17EAD8, #00BDA9)'),
                  color: D.onCyan,
                  fontWeight: 700,
                  borderColor: D.primaryLine,
                  '&:hover': { background: c('linear-gradient(105deg, #3AF4E4, #10CDB9)') },
                },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44, borderBottom: `1px solid ${line}` },
          indicator: {
            height: 2,
            backgroundColor: primary,
            ...(light ? {} : { boxShadow: `0 0 10px ${D.cyan}` }),
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 14,
            minHeight: 44,
            color: muted,
            '&.Mui-selected': { color: primary },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.md,
            '&.Mui-selected': {
              backgroundColor: light ? tints.softBg : alpha(primary, 0.14),
              color: primary,
              '&:hover': { backgroundColor: light ? tints.softBg : alpha(primary, 0.18) },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: DESIGN.radius.lg, fontSize: 14, alignItems: 'center' },
          standard: {
            '&.MuiAlert-colorSuccess': { backgroundColor: toneFor('green').bg, color: toneFor('green').fg },
            '&.MuiAlert-colorWarning': { backgroundColor: toneFor('beige').bg, color: toneFor('beige').fg },
            '&.MuiAlert-colorError': { backgroundColor: toneFor('red').bg, color: toneFor('red').fg },
            '&.MuiAlert-colorInfo': {
              backgroundColor: light ? tints.softBg : alpha(primary, 0.12),
              color: light ? ink : D.white,
            },
            ...(light
              ? {}
              : {
                  '&.MuiAlert-colorSuccess, &.MuiAlert-colorWarning, &.MuiAlert-colorError, &.MuiAlert-colorInfo': {
                    border: `1px solid ${alpha(D.cyan, 0.22)}`,
                  },
                }),
          },
          /* MUI derives the outlined text from `palette.x.light`, which is a translucent tint here (alpha .14: invisible on the glass),
             and the filled fill from a darkened `main`: both are set explicitly so every severity reads in both modes (R5). */
          outlined: {
            '&.MuiAlert-colorSuccess': { color: toneFor('green').fg, borderColor: toneFor('green').line, backgroundColor: 'transparent' },
            '&.MuiAlert-colorWarning': { color: toneFor('beige').fg, borderColor: toneFor('beige').line, backgroundColor: 'transparent' },
            '&.MuiAlert-colorError': { color: toneFor('red').fg, borderColor: toneFor('red').line, backgroundColor: 'transparent' },
            '&.MuiAlert-colorInfo': { color: toneFor('blue').fg, borderColor: toneFor('blue').line, backgroundColor: 'transparent' },
          },
          filled: {
            '&.MuiAlert-colorSuccess': { backgroundColor: light ? '#27603A' : D.green, color: light ? '#FFFFFF' : D.onCyan },
            '&.MuiAlert-colorWarning': { backgroundColor: light ? '#8A5A2F' : D.amber, color: light ? '#FFFFFF' : D.onCyan },
            '&.MuiAlert-colorError': { backgroundColor: light ? '#9B3B1B' : '#FF6B88', color: light ? '#FFFFFF' : D.onCyan },
            '&.MuiAlert-colorInfo': { backgroundColor: light ? '#2B5C9B' : '#5BB0FF', color: light ? '#FFFFFF' : D.onCyan },
          },
          icon: { opacity: 0.9 },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.lg,
            backgroundColor: light ? DESIGN.inkSoft : pop.paper,
            color: light ? '#FFFFFF' : D.white,
            ...(light ? {} : { border: `1px solid ${pop.border}`, boxShadow: D.floatingGlow }),
            /* the action sits on the dark snackbar of light mode and on the glass of dark mode: white / aqua, never the accent that may be dark */
            '& .MuiSnackbarContent-action .MuiButton-root': { color: light ? '#FFFFFF' : D.aqua, textDecoration: 'underline', minHeight: 32 },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: DESIGN.radius.md,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: light ? DESIGN.inkSoft : c('#063C4C'),
            padding: '6px 10px',
            ...(light ? {} : { color: D.white, border: `1px solid ${c('#12647A')}`, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)' }),
          },
          arrow: { color: light ? DESIGN.inkSoft : c('#063C4C') },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, height: 6, backgroundColor: light ? line : '#244255' },
          bar: {
            borderRadius: 999,
            ...(light
              ? {}
              : {
                  '&.MuiLinearProgress-barColorPrimary': {
                    backgroundImage: c('linear-gradient(90deg, #00998E, #02F3E5)'),
                    boxShadow: `0 0 8px ${c('rgba(2, 243, 229, 0.45)')}`,
                  },
                }),
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: line } },
      },
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: 700, fontSize: 14, backgroundColor: light ? DESIGN.page : '#0A3C52', color: ink },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { borderRadius: DESIGN.radius.md } },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 999, ...(light ? {} : { backgroundColor: '#5C7A92', opacity: 0.6 }) },
        },
      },
    },
  });
}

/** The default the app opens with before anyone chooses. */
const theme = buildTheme(THEME_ACCENTS[0].color, 'light');

export default theme;
