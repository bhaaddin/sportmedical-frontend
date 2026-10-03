/* ══════════════════════════════════════════════════════════════
   PUBLIC WEB TOKENS — taken from the artboard V-Web2 (patient web)

   One place for every colour, size and face the public site uses, so the
   landing and the inner pages (Služby, Ceník, Kontakt, ...) cannot drift
   apart. Nothing here is a price or a text; those come from the admin.
   ══════════════════════════════════════════════════════════════ */

export const W = {
  /* Dark band: header, hero, club offer, footer. */
  ink: '#0E1013',
  inkCard: '#16191E',
  inkCardAlt: '#1C2026',
  inkLine: '#22262C',
  inkBorder: '#3A4049',
  onInk: '#B9BFC7',
  onInkNav: '#D8DCE1',
  onInkMuted: '#868D96',
  onInkPlaceholder: '#9AA1AA',
  /* The single accent. `orangeText` is the darker shade that passes contrast on white. */
  orange: '#F0912E',
  orangeText: '#A8560D',
  orangeTextHover: '#7E3F08',
  onOrange: '#1A1206',
  /* Light surfaces. */
  white: '#FFFFFF',
  warm: '#FAF8F5',
  warmHover: '#F4F1EB',
  text: '#15161A',
  body: '#4C5157',
  bodySoft: '#5C6067',
  muted: '#6E6960',
  mutedSoft: '#9A9185',
  line: '#EDE8E1',
  lineStrong: '#E6E1DA',
  /* Photo placeholder. */
  phBg: '#EFEAE2',
  phBorder: '#D3CBBE',
  phText: '#8A8176',
  /* Big step numerals. */
  numeral: '#E0D9CD',
} as const;

export const FONT_HEAD = "'Archivo', 'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONT_BODY = "'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Content width and side gutter (the artboard: 1320 px, 40 px; phone 20 px). */
export const MAX_WIDTH = 1320;

/*
 * The three interfaces, as media queries for `sx`. They are the same numbers as
 * src/layout/useDevice.ts (phone ≤767, tablet 768–1279, desktop ≥1280); CSS is
 * used instead of the hook so the prerendered HTML already has the right layout.
 */
export const MQ = {
  tablet: '@media (min-width: 768px)',
  desktop: '@media (min-width: 1280px)',
  /** The header folds into a menu below this width (eight links do not fit an iPad). */
  nav: '@media (min-width: 1100px)',
  phoneOnly: '@media (max-width: 767px)',
  reduceMotion: '@media (prefers-reduced-motion: reduce)',
} as const;

/** Side padding of every section: 20 px on a phone, 28 on an iPad, 40 on a desktop. */
export const GUTTER = { xs: '20px', sm: '28px', md: '40px' } as const;

export const WEB_BASE = '/web';
