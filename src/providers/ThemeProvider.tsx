import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from '../theme';
import { darkModeTheme } from '../styles/darkMode';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  setMode: () => {},
  isDark: false,
});

export const useThemeMode = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode = 'light' }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode') as ThemeMode;
    return saved || defaultMode;
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const checkMode = () => {
      if (mode === 'system') {
        setIsDark(mediaQuery.matches);
      } else {
        setIsDark(mode === 'dark');
      }
    };

    checkMode();
    mediaQuery.addEventListener('change', checkMode);

    return () => mediaQuery.removeEventListener('change', checkMode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [mode, isDark]);

  const currentTheme = isDark
    ? {
        ...theme,
        ...darkModeTheme,
        palette: {
          ...theme.palette,
          ...darkModeTheme.palette,
        },
        components: {
          ...theme.components,
          ...darkModeTheme.components,
        },
      }
    : theme;

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark }}>
      <MuiThemeProvider theme={currentTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
