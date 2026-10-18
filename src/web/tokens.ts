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

/**
 * The width of the centred column on a screen of any size: the artboard's 1320 px up to a 1740 px window, then 76 % of the
 * window, never more than 2240 px (a 2560 monitor reads 1946 px, an ultrawide 2240 px, with equal gutters on both sides and
 * full-bleed bands behind). A computed value, so a section and the header/footer inside it always share one edge.
 */
export const SITE_MAX = 'min(100%, clamp(1320px, 76vw, 2240px))';

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
export const GUTTER = { xs: 'max(20px, env(safe-area-inset-left))', sm: '28px', md: 'clamp(40px, 2.4vw, 64px)' } as const;

/** The same gutters, written as the padding of a bar that spans the whole window (the application's public pages). */
export const WIDE_GUTTER = { pl: { xs: 'max(16px, env(safe-area-inset-left))', md: '32px', lg: '44px' }, pr: { xs: 'max(16px, env(safe-area-inset-right))', md: '32px', lg: '44px' } } as const;

export const WEB_BASE = '/web';

/**
 * A page that is nothing but reading text (the legal pages, the questions): its sections flow into columns of at least 560 px, so
 * a wide screen shows two or three of them side by side instead of one 860 px strip in the middle of the window.
 * `breakInside: avoid` on a section keeps it whole where it fits.
 */
export const READING_COLUMNS = { columnWidth: '560px', columnGap: 'clamp(32px, 4vw, 72px)' } as const;
