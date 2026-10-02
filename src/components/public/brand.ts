/* ══════════════════════════════════════════════════════════════
   THE PUBLIC SIDE'S IDENTITY

   Everything a patient sees — /objednat, /dotaznik, /rezervace, /portal, /klub,
   /hodnoceni — wears the clinic's website: near-black header, white content,
   Inter, one orange accent. The staff application wears the board's forest
   green and Public Sans; that is deliberately NOT this. The two must never be
   confused, so the public tokens live here, once, and every public page reads
   them rather than carrying its own copy.
   ══════════════════════════════════════════════════════════════ */

import { createTheme } from '@mui/material/styles';

export const BRAND = {
  ink: '#0B0B0C',
  inkSoft: '#17171A',
  accent: '#FF9D00',
  accentDark: '#E08A00',
  accentWash: 'rgba(255, 157, 0, 0.09)',
  accentEdge: 'rgba(255, 157, 0, 0.32)',
  page: '#F4F4F6',
  paper: '#FFFFFF',
  line: '#E5E5E9',
  lineStrong: 'rgba(17, 17, 17, 0.24)',
  text: '#111111',
  muted: 'rgba(17, 17, 17, 0.58)',
  faint: 'rgba(17, 17, 17, 0.36)',
  onInk: 'rgba(255,255,255,0.72)',
  onInkLine: 'rgba(255,255,255,0.14)',
  onInkWash: 'rgba(255,255,255,0.05)',
  success: '#1F7A4D',
  successWash: '#E4F3EA',
  warn: '#8A5A2F',
  warnWash: '#FBF1E7',
  shadow: '0 18px 50px rgba(11, 11, 12, 0.10)',
} as const;

export const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
    fontFamily: INTER,
    h3: { fontWeight: 800, letterSpacing: '-0.02em' },
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 800, letterSpacing: '-0.015em' },
    h6: { fontWeight: 800, letterSpacing: '-0.01em' },
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

/** "2 200 Kč", or null for a price the clinic has not set. */
export const czk = (value: number | null | undefined): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('cs-CZ')} Kč` : null;

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
