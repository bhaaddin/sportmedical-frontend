/* ══════════════════════════════════════════════════════════════
   THE PUBLIC SIDE'S IDENTITY

   Everything a patient sees — /objednat, /dotaznik, /rezervace, /portal, /klub,
   /hodnoceni, and the prerendered site under /web — wears the clinic's website: near-black header, warm-white content,
   Archivo + Public Sans (artboard V-Web2), one orange accent. The staff application wears the board's forest
   green and Public Sans; that is deliberately NOT this. The two must never be
   confused, so the public tokens live here, once, and every public page reads
   them rather than carrying its own copy.
   ══════════════════════════════════════════════════════════════ */

import { createTheme } from '@mui/material/styles';

export const BRAND = {
  ink: '#0E1013',
  inkSoft: '#16191E',
  accent: '#F0912E',
  accentDark: '#D97F1C',
  accentWash: 'rgba(240, 145, 46, 0.09)',
  accentEdge: 'rgba(240, 145, 46, 0.32)',
  page: '#FAF8F5',
  paper: '#FFFFFF',
  line: '#E6E1DA',
  lineStrong: 'rgba(21, 22, 26, 0.24)',
  text: '#15161A',
  muted: 'rgba(21, 22, 26, 0.62)',
  faint: 'rgba(21, 22, 26, 0.4)',
  onInk: '#B9BFC7',
  onInkLine: '#22262C',
  onInkWash: 'rgba(255,255,255,0.06)',
  success: '#1F7A4D',
  successWash: '#E4F3EA',
  warn: '#8A5A2F',
  warnWash: '#FBF1E7',
  shadow: '0 18px 50px rgba(14, 16, 19, 0.10)',
} as const;

export const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
/** The public site's faces (artboard V-Web2): Archivo for headings and numbers, Public Sans for text. */
export const ARCHIVO = '"Archivo", "Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const PUBLIC_SANS = '"Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The one MUI theme every public page renders under. */
export const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: BRAND.paper },
    text: { primary: BRAND.text, secondary: BRAND.muted },
    divider: BRAND.line,
    success: { main: BRAND.success },
    warning: { main: BRAND.warn },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: PUBLIC_SANS,
    h1: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.04em' },
    h2: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.035em' },
    h3: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.03em' },
    h4: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.015em' },
    h6: { fontFamily: ARCHIVO, fontWeight: 800, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20, minHeight: 42 },
        sizeLarge: { minHeight: 50, paddingInline: 26, fontSize: 15.5 },
        sizeSmall: { minHeight: 34, paddingInline: 14, fontSize: 13 },
        outlined: { borderColor: BRAND.line, color: BRAND.text, '&:hover': { borderColor: BRAND.lineStrong, backgroundColor: BRAND.page } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, border: `1px solid ${BRAND.line}`, boxShadow: 'none', backgroundImage: 'none' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: BRAND.paper,
          '& fieldset': { borderColor: BRAND.line },
          '&:hover fieldset': { borderColor: BRAND.lineStrong },
          '&.Mui-focused fieldset': { borderWidth: 2, borderColor: BRAND.accent },
        },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
  },
});

/** "2 200 Kč" (non-breaking spaces, Czech typography), or null for a price the clinic has not set. */
export const czk = (value: number | null | undefined): string | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString('cs-CZ').replace(/\p{Zs}/gu, String.fromCharCode(0xa0))}${String.fromCharCode(0xa0)}Kč`
    : null;

/** A UTC instant as the clinic's clock reads it: "pondělí 26. října 10:00". */
export const clinicMoment = (utc: string): string =>
  new Date(utc).toLocaleString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

/** The Prague clock time of a UTC instant. */
export const clinicTime = (utc: string): string =>
  new Date(utc).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' });

/** A YYYY-MM-DD as "pondělí 26. října". */
export const clinicDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** "+420 606 785 271" → "tel:+420606785271". */
export const telHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;

/** A Google Maps search for the clinic's address. */
export const mapsHref = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
