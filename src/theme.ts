import { createTheme, alpha, type Theme } from '@mui/material/styles';

/** The accent colours the doctor can pick for their own workspace (plan: styly). */
export interface ThemeAccent {
  key: string;
  label: string;
  color: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  { key: 'teal', label: 'Tyrkysová', color: '#0D9488' },
  { key: 'blue', label: 'Modrá', color: '#2563EB' },
  { key: 'green', label: 'Zelená', color: '#16A34A' },
  { key: 'purple', label: 'Fialová', color: '#7C3AED' },
  { key: 'orange', label: 'Oranžová', color: '#EA580C' },
  { key: 'pink', label: 'Růžová', color: '#DB2777' },
  { key: 'indigo', label: 'Indigo', color: '#4F46E5' },
];

export type ThemeMode = 'light' | 'dark';

/**
 * The clinic's theme, built for a chosen accent and light/dark mode. The accent
 * is the one thing a doctor picks; the shape, depth, typography and colour of
 * every surface stay fixed, so a colour choice tunes the product without turning
 * it into a different one.
 *
 * Redrawn 2026-09-27 for more life on screen — a tinted page ground, layered
 * soft shadows, gradient headers and coloured chips — without giving up the
 * legibility a medical screen needs.
 */
export function buildTheme(accentColor: string, mode: ThemeMode): Theme {
  const light = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: { main: accentColor },
      secondary: { main: light ? '#1E293B' : '#CBD5E1' },
      background: light
        ? { default: '#EEF3F9', paper: '#FFFFFF' }
        : { default: '#0B1220', paper: '#141C2A' },
      text: light
        ? { primary: '#14202B', secondary: '#5B6B7B' }
        : { primary: '#E8EEF5', secondary: '#94A3B8' },
      success: { main: '#16A34A' },
      warning: { main: '#F59E0B' },
      error: { main: '#E11D48' },
      info: { main: '#0EA5E9' },
      divider: light ? '#E3EAF2' : '#243141',
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h3: { fontWeight: 800, letterSpacing: '-0.02em' },
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 800, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 700 },
      button: { fontWeight: 700, letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            /* A ground with a little depth rather than a flat grey, so the white
               cards on top read as raised. */
            background: light
              ? 'radial-gradient(1200px 600px at 100% -5%, ' + alpha(accentColor, 0.10) + ' 0%, rgba(0,0,0,0) 55%), #EEF3F9'
              : 'radial-gradient(1200px 600px at 100% -5%, ' + alpha(accentColor, 0.16) + ' 0%, rgba(0,0,0,0) 55%), #0B1220',
            backgroundAttachment: 'fixed',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 10, textTransform: 'none', fontWeight: 700, paddingInline: 16 },
          contained: {
            boxShadow: `0 6px 16px ${alpha(accentColor, 0.28)}`,
            '&:hover': { boxShadow: `0 8px 22px ${alpha(accentColor, 0.4)}` },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            border: `1px solid ${light ? '#E7EDF4' : '#243141'}`,
            boxShadow: light
              ? '0 1px 2px rgba(16,32,48,0.04), 0 12px 28px -12px rgba(16,32,48,0.18)'
              : '0 1px 2px rgba(0,0,0,0.4), 0 12px 30px -12px rgba(0,0,0,0.6)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 14, backgroundImage: 'none' },
          outlined: { borderColor: light ? '#E3EAF2' : '#243141' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: `linear-gradient(100deg, ${accentColor} 0%, ${shade(accentColor, -18)} 100%)`,
            boxShadow: `0 8px 24px -10px ${alpha(accentColor, 0.55)}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 700 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: light ? '#FFFFFF' : alpha('#FFFFFF', 0.03),
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(accentColor, 0.5) },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 800,
              color: light ? '#41505F' : '#B7C4D2',
              backgroundColor: light ? '#F4F7FB' : '#111A27',
              borderBottom: `1px solid ${light ? '#E3EAF2' : '#243141'}`,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { borderRadius: 10, fontSize: 12, fontWeight: 600 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 999 } },
      },
    },
  });
}

/** Lighten (positive) or darken (negative) a #rrggbb colour by a percentage. */
function shade(hex: string, percent: number): string {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** The default the app opens with before anyone chooses. */
const theme = buildTheme('#0D9488', 'light');

export default theme;
