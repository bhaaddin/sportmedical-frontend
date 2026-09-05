import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows, transitions } from './spacing';

let theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary[500],
      light: colors.primary[300],
      dark: colors.primary[700],
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: colors.secondary[500],
      light: colors.secondary[300],
      dark: colors.secondary[700],
      contrastText: '#FFFFFF',
    },
    error: {
      main: colors.medical.error,
      light: '#FFCDD2',
      dark: '#D32F2F',
    },
    warning: {
      main: colors.medical.warning,
      light: '#FFE0B2',
      dark: '#F57C00',
    },
    info: {
      main: colors.medical.info,
      light: '#BBDEFB',
      dark: '#1565C0',
    },
    success: {
      main: colors.medical.success,
      light: '#C8E6C9',
      dark: '#388E3C',
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    divider: colors.border.light,
  },

  typography: {
    fontFamily: typography.fontFamily,
    h1: typography.h1,
    h2: typography.h2,
    h3: typography.h3,
    h4: typography.h4,
    h5: typography.h5,
    h6: typography.h6,
    body1: typography.body1,
    body2: typography.body2,
    subtitle1: typography.subtitle1,
    subtitle2: typography.subtitle2,
    caption: typography.caption,
    overline: typography.overline,
    button: typography.button,
  },

  spacing: (factor) => `${spacing.unit * factor}px`,

  shape: {
    borderRadius: parseInt(borderRadius.md),
  },

  shadows: [
    shadows.none,
    shadows.xs,
    shadows.sm,
    shadows.sm,
    shadows.md,
    shadows.md,
    shadows.md,
    shadows.lg,
    shadows.lg,
    shadows.lg,
    shadows.xl,
    shadows.xl,
    shadows.xl,
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
    shadows['2xl'],
  ] as any,

  transitions: {
    duration: transitions.duration,
    easing: transitions.easing,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: borderRadius.md,
          padding: '8px 16px',
          transition: `all ${transitions.duration.standard}ms ${transitions.easing.easeOut}`,
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: shadows.md,
          },
        },
        contained: {
          boxShadow: shadows.sm,
          '&:hover': {
            boxShadow: shadows.md,
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        },
        sizeSmall: {
          padding: '4px 10px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.lg,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.border.light}`,
          transition: `box-shadow ${transitions.duration.standard}ms ${transitions.easing.easeOut}`,
          '&:hover': {
            boxShadow: shadows.md,
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.md,
        },
        elevation1: {
          boxShadow: shadows.sm,
        },
        elevation2: {
          boxShadow: shadows.md,
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: borderRadius.md,
            transition: `border-color ${transitions.duration.shorter}ms ${transitions.easing.easeOut}`,
            '&:hover': {
              borderColor: colors.primary[300],
            },
            '&.Mui-focused': {
              borderColor: colors.primary[500],
              boxShadow: `0 0 0 3px ${colors.primary[50]}20`,
            },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.full,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            backgroundColor: colors.primary[100],
            color: colors.primary[700],
          },
          '&.MuiChip-colorSuccess': {
            backgroundColor: colors.medical.success + '20',
            color: '#1B5E20',
          },
          '&.MuiChip-colorWarning': {
            backgroundColor: colors.medical.warning + '20',
            color: '#E65100',
          },
          '&.MuiChip-colorError': {
            backgroundColor: colors.medical.error + '20',
            color: '#B71C1C',
          },
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            backgroundColor: colors.neutral[50],
            borderBottom: `2px solid ${colors.border.light}`,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          borderColor: colors.border.light,
        },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.875rem',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: borderRadius.lg,
          boxShadow: shadows['2xl'],
        },
      },
    },

    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            borderRadius: borderRadius.md,
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.neutral[800],
          fontSize: '0.75rem',
          borderRadius: borderRadius.sm,
          padding: '6px 12px',
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 1,
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            '& + .MuiSwitch-track': {
              backgroundColor: colors.primary[500],
              opacity: 1,
              border: 0,
            },
          },
        },
        thumb: {
          width: 22,
          height: 22,
        },
        track: {
          borderRadius: 13,
          border: `1px solid ${colors.neutral[300]}`,
          backgroundColor: colors.neutral[200],
          opacity: 1,
          transition: `background-color ${transitions.duration.shorter}ms ${transitions.easing.easeOut}`,
        },
      },
    },
  },
});

theme = responsiveFontSizes(theme);

export default theme;
