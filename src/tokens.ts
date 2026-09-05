/* ══════════════════════════════════════════════════════════════
   DESIGN TOKENS — TypeScript Exports
   Mirrors theme.css CSS variables for type-safe usage in JS/TS
   ══════════════════════════════════════════════════════════════ */

/* ── Color Palette ── */
export const colors = {
  /* Background */
  bg: {
    base: 'var(--color-bg)',
    paper: 'var(--color-bg-paper)',
    elevated: 'var(--color-bg-elevated)',
    hover: 'var(--color-bg-hover)',
    active: 'var(--color-bg-active)',
  },
  /* Text */
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    inverse: 'var(--color-text-inverse)',
  },
  /* Border */
  border: {
    default: 'var(--color-border)',
    strong: 'var(--color-border-strong)',
  },
  /* Primary (Teal) */
  primary: {
    base: 'var(--color-primary)',
    light: 'var(--color-primary-light)',
    dark: 'var(--color-primary-dark)',
    bg: 'var(--color-primary-bg)',
    hover: 'var(--color-primary-hover)',
    active: 'var(--color-primary-active)',
    disabled: 'var(--color-primary-disabled)',
  },
  /* Secondary (Navy) */
  secondary: {
    base: 'var(--color-secondary)',
    light: 'var(--color-secondary-light)',
    dark: 'var(--color-secondary-dark)',
    hover: 'var(--color-secondary-hover)',
    active: 'var(--color-secondary-active)',
    disabled: 'var(--color-secondary-disabled)',
  },
  /* Success */
  success: {
    base: 'var(--color-success)',
    light: 'var(--color-success-light)',
    bg: 'var(--color-success-bg)',
    hover: 'var(--color-success-hover)',
    active: 'var(--color-success-active)',
    disabled: 'var(--color-success-disabled)',
  },
  /* Warning */
  warning: {
    base: 'var(--color-warning)',
    light: 'var(--color-warning-light)',
    bg: 'var(--color-warning-bg)',
    hover: 'var(--color-warning-hover)',
    active: 'var(--color-warning-active)',
    disabled: 'var(--color-warning-disabled)',
  },
  /* Critical / Error */
  critical: {
    base: 'var(--color-critical)',
    light: 'var(--color-critical-light)',
    bg: 'var(--color-critical-bg)',
    hover: 'var(--color-critical-hover)',
    active: 'var(--color-critical-active)',
    disabled: 'var(--color-critical-disabled)',
  },
  /* Info */
  info: {
    base: 'var(--color-info)',
    light: 'var(--color-info-light)',
    bg: 'var(--color-info-bg)',
    hover: 'var(--color-info-hover)',
    active: 'var(--color-info-active)',
    disabled: 'var(--color-info-disabled)',
  },
  /* SPD (Sports Medicine) */
  spd: {
    base: 'var(--color-spd)',
    light: 'var(--color-spd-light)',
    bg: 'var(--color-spd-bg)',
    hover: 'var(--color-spd-hover)',
    active: 'var(--color-spd-active)',
    disabled: 'var(--color-spd-disabled)',
  },
  /* ZAT (Zatěž / Load) */
  zat: {
    base: 'var(--color-zat)',
    light: 'var(--color-zat-light)',
    bg: 'var(--color-zat-bg)',
    hover: 'var(--color-zat-hover)',
    active: 'var(--color-zat-active)',
    disabled: 'var(--color-zat-disabled)',
  },
  /* Contrast */
  contrast: {
    textOnPrimary: 'var(--contrast-text-on-primary)',
    textOnSuccess: 'var(--contrast-text-on-success)',
    textOnWarning: 'var(--contrast-text-on-warning)',
    textOnCritical: 'var(--contrast-text-on-critical)',
    mutedOnBg: 'var(--contrast-muted-on-bg)',
  },
} as const;

/* ── Typography ── */
export const typography = {
  fontFamily: 'var(--font-family)',
  size: {
    micro: 'var(--font-size-micro)',   // 11px — micro labels
    xs: 'var(--font-size-xs)',          // 12px — captions
    sm: 'var(--font-size-sm)',          // 13px — small text
    base: 'var(--font-size-base)',      // 14px — body default
    md: 'var(--font-size-md)',          // 15px — body large
    lg: 'var(--font-size-lg)',          // 18px — sub-headers
    xl: 'var(--font-size-xl)',          // 20px — section headers
    '2xl': 'var(--font-size-2xl)',      // 24px — page headers
    '3xl': 'var(--font-size-3xl)',      // clamp(24px, 3vw, 32px) — hero
    '4xl': 'var(--font-size-4xl)',      // clamp(28px, 4vw, 40px) — display
  },
  weight: {
    normal: 'var(--font-weight-normal)',
    medium: 'var(--font-weight-medium)',
    semibold: 'var(--font-weight-semibold)',
    bold: 'var(--font-weight-bold)',
  },
  lineHeight: {
    tight: 'var(--line-height-tight)',
    normal: 'var(--line-height-normal)',
    relaxed: 'var(--line-height-relaxed)',
  },
  /** Use for numbers that must align in columns (clocks, calendars, tables) */
  tabularNums: 'font-variant-numeric: tabular-nums;',
} as const;

/* ── Spacing (4px base scale) ── */
export const spacing = {
  0: 'var(--space-0)',
  1: 'var(--space-1)',   // 4px
  2: 'var(--space-2)',   // 8px
  3: 'var(--space-3)',   // 12px
  4: 'var(--space-4)',   // 16px
  5: 'var(--space-5)',   // 20px
  6: 'var(--space-6)',   // 24px
  8: 'var(--space-8)',   // 32px
  10: 'var(--space-10)', // 40px
  12: 'var(--space-12)', // 48px
  16: 'var(--space-16)', // 64px
} as const;

/* ── Border Radius ── */
export const radius = {
  sm: 'var(--radius-sm)',     // 4px
  md: 'var(--radius-md)',     // 8px
  lg: 'var(--radius-lg)',     // 12px
  xl: 'var(--radius-xl)',     // 16px
  '2xl': 'var(--radius-2xl)', // 24px
  full: 'var(--radius-full)', // 9999px
} as const;

/* ── Shadows ── */
export const shadows = {
  resting: 'var(--shadow-resting)',
  elevated: 'var(--shadow-elevated)',
  modal: 'var(--shadow-modal)',
  dragged: 'var(--shadow-dragged)',
  glow: 'var(--shadow-glow)',
} as const;

/* ── Transitions ── */
export const transitions = {
  fast: 'var(--transition-fast)',     // 150ms
  normal: 'var(--transition-normal)', // 250ms
  slow: 'var(--transition-slow)',     // 350ms
} as const;

/* ── Layout ── */
export const layout = {
  headerHeight: 'var(--header-height)',           // 64px
  sidebarWidth: 'var(--sidebar-width)',           // 260px
  sidebarCollapsedWidth: 'var(--sidebar-collapsed-width)', // 64px
  drawerWidth: 'var(--drawer-width)',             // 480px
  hourHeight: 'var(--hour-height)',               // 80px
} as const;

/* ── Z-Index Layers ── */
export const zIndex = {
  sidebar: 100,
  header: 200,
  drawer: 300,
  modalBackdrop: 400,
  modal: 500,
  toast: 600,
} as const;

/* ── Utility: Tabular numerals CSS style object ── */
export const tabularNumsStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};
