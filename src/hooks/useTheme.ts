import { useThemeMode } from '../providers/ThemeProvider';
import { useMediaQuery, useTheme as useMuiTheme } from '@mui/material';

export function useTheme() {
  const { mode, setMode, isDark } = useThemeMode();
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  return {
    mode,
    setMode,
    isDark,
    isMobile,
    isTablet,
    isDesktop,
    theme,
    colors: theme.palette,
    spacing: theme.spacing,
    typography: theme.typography,
    breakpoints: theme.breakpoints,
    shadows: theme.shadows,
    transitions: theme.transitions,
    shape: theme.shape,
  };
}
