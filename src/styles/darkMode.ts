// Dark mode color overrides and utilities

export const darkModeColors = {
  primary: {
    50: '#0D2137',
    100: '#1A3A5C',
    200: '#265381',
    300: '#336CA6',
    400: '#4085CB',
    500: '#4D9EF0',
    600: '#6AABF3',
    700: '#87B8F6',
    800: '#A4C5F9',
    900: '#C1D2FC',
  },
  secondary: {
    500: '#9C27B0',
  },
  background: {
    default: '#121212',
    paper: '#1E1E1E',
    subtle: '#2D2D2D',
    muted: '#3D3D3D',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    disabled: '#666666',
  },
  border: {
    light: '#404040',
    medium: '#606060',
    dark: '#808080',
  },
};

export const darkModeTheme = {
  palette: {
    mode: 'dark' as const,
    primary: {
      main: darkModeColors.primary[500],
      light: darkModeColors.primary[300],
      dark: darkModeColors.primary[700],
    },
    secondary: {
      main: darkModeColors.secondary[500],
    },
    background: {
      default: darkModeColors.background.default,
      paper: darkModeColors.background.paper,
    },
    text: {
      primary: darkModeColors.text.primary,
      secondary: darkModeColors.text.secondary,
      disabled: darkModeColors.text.disabled,
    },
    divider: darkModeColors.border.light,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: darkModeColors.background.paper,
          borderColor: darkModeColors.border.light,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: darkModeColors.background.paper,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: darkModeColors.border.light,
        },
        head: {
          backgroundColor: darkModeColors.background.subtle,
        },
      },
    },
  },
};

export function useDarkMode() {
  const toggleDarkMode = () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';

    if (isDark) {
      html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  const getTheme = () => {
    return localStorage.getItem('theme') || 'light';
  };

  const isDarkMode = () => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  };

  return { toggleDarkMode, getTheme, isDarkMode };
}
