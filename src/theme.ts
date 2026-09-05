import { createTheme } from '@mui/material/styles';

const isDark = localStorage.getItem('theme') === 'dark';

const theme = createTheme({
  palette: {
    mode: isDark ? 'dark' : 'light',
    primary: { main: '#0D7377', light: '#14A3A8', dark: '#095456' },
    secondary: { main: '#1A1A2E', light: '#16213E', dark: '#0F0F1A' },
    background: isDark
      ? { default: '#121212', paper: '#1E1E1E' }
      : { default: '#F0F4F8', paper: '#FFFFFF' },
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
        contained: { boxShadow: '0 2px 8px rgba(13,115,119,0.3)' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: isDark ? { bgcolor: '#1A1A1A', borderRight: '1px solid rgba(255,255,255,0.06)' } : {},
      },
    },
  },
});

export default theme;
