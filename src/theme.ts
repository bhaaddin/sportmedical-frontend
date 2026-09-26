import { createTheme, type Theme } from '@mui/material/styles';

/** The accent colours the doctor can pick for their own workspace (plan: styly). */
export interface ThemeAccent {
  key: string;
  label: string;
  color: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  { key: 'teal', label: 'Tyrkysová', color: '#0D7377' },
  { key: 'blue', label: 'Modrá', color: '#1565C0' },
  { key: 'green', label: 'Zelená', color: '#2E7D32' },
  { key: 'purple', label: 'Fialová', color: '#6A1B9A' },
  { key: 'orange', label: 'Oranžová', color: '#E8830C' },
];

export type ThemeMode = 'light' | 'dark';

/**
 * The clinic's theme, built for a chosen accent and light/dark mode. Everything
 * that is not the accent — the shape, the typography, the component rounding —
 * stays fixed, so a colour choice never turns into a different-looking product.
 */
export function buildTheme(accentColor: string, mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: accentColor },
      secondary: { main: '#1A1A2E' },
      background:
        mode === 'light'
          ? { default: '#F0F4F8', paper: '#FFFFFF' }
          : { default: '#0F1720', paper: '#161E28' },
      success: { main: '#2E7D32' },
      warning: { main: '#ED6C02' },
      error: { main: '#D32F2F' },
      info: { main: '#0288D1' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
    },
  });
}

/** The default the app opens with before anyone chooses. */
const theme = buildTheme('#0D7377', 'light');

export default theme;
