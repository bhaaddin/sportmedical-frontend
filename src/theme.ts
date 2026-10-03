import { createTheme, alpha, type Theme } from '@mui/material/styles';

/*
 * The clinic's design language, taken from the board Matko handed over on
 * 3. 10. 2026 ("SportMedical — 10 směrů designu"): a calm, flat, bordered
 * surface in Public Sans, one dark accent, no gradients and no shadows except
 * on things that float (dialogs, menus). Every number here was measured on
 * that board, not invented; the tokens are exported so the calendar grid, the
 * status chips and the public pages draw from one place.
 */

/** The accent colours the doctor can pick for their own workspace (plan: styly). */
export interface ThemeAccent {
  key: string;
  label: string;
  color: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  { key: 'forest', label: 'Lesní zelená', color: '#0D5C52' },
  { key: 'slate', label: 'Břidlicová', color: '#2B3440' },
  { key: 'teal', label: 'Tyrkysová', color: '#0D9488' },
  { key: 'blue', label: 'Modrá', color: '#2563EB' },
  { key: 'purple', label: 'Fialová', color: '#7C3AED' },
  { key: 'orange', label: 'Oranžová', color: '#EA580C' },
];

export type ThemeMode = 'light' | 'dark';

/** The board's fixed values — surfaces, ink, lines, tones and the hatch patterns. */
export const DESIGN = {
  font: '"Public Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ink: '#1A1D21',
  inkSoft: '#14181C',
  muted: '#67707A',
  faint: '#B3B9C0',
  line: '#E2E6EA',
  lineStrong: '#DCE0E5',
  page: '#EFF1F4',
  paper: '#FFFFFF',
  head: '#F4F6F7',
  radius: { sm: 4, md: 8, lg: 10, xl: 12 },
  /** Soft status tones: chips, badges, KPI numbers. */
  tone: {
    green: { bg: '#E2EBE4', fg: '#27603A', line: '#C7DACB' },
    beige: { bg: '#FBF1E7', fg: '#8A5A2F', line: '#E7CBA9' },
    red: { bg: '#F5E0D8', fg: '#9B3B1B', line: '#E3C3BA' },
    grey: { bg: '#EFF1F4', fg: '#4A5564', line: '#DCE0E5' },
    blue: { bg: '#E3ECF7', fg: '#2B5C9B', line: '#C4D6EE' },
  },
  danger: '#9B3B1B',
  /** The red of the "now" line and its time pill. */
  now: '#C0392B',
  hatch: {
    closed: 'repeating-linear-gradient(135deg, #E4E7EB 0px, #E4E7EB 7px, #F3F5F7 7px, #F3F5F7 14px)',
    closedLine: '#CBD1D8',
    holiday: 'repeating-linear-gradient(135deg, #F2DEC8 0px, #F2DEC8 7px, #FBF1E7 7px, #FBF1E7 14px)',
    holidayLine: '#E7CBA9',
    holidayInk: '#8A5A2F',
  },
  appointment: { bg: '#EFF1F4', bgActive: '#DCE0E5', edge: '#4A5564' },
  selection: { bg: '#D7E9E5', line: '#0D5C52' },
  softPrimary: { bg: '#F4F8F7', line: '#C9D6D3' },
  shadow: {
    menu: '0 12px 32px rgba(20, 24, 28, 0.14)',
    dialog: '0 24px 60px rgba(20, 24, 28, 0.20)',
  },
} as const;

/**
 * The clinic's theme, built for a chosen accent and light/dark mode. The accent
 * is the one thing a doctor picks; the shape, typography and the colour of every
 * surface stay fixed, so a colour choice tunes the product without turning it
 * into a different one.
 */
export function buildTheme(accentColor: string, mode: ThemeMode): Theme {
  const light = mode === 'light';
  const line = light ? DESIGN.line : '#262D36';
  const page = light ? DESIGN.page : '#0F1317';
  const paper = light ? DESIGN.paper : '#171C22';
  const ink = light ? DESIGN.ink : '#E8ECF0';
  const muted = light ? DESIGN.muted : '#9AA4AF';
  const head = light ? DESIGN.head : '#1C222A';
  const hover = light ? '#F4F6F7' : '#1F262E';

  return createTheme({
    palette: {
      mode,
      primary: { main: accentColor, contrastText: '#FFFFFF' },
      secondary: { main: light ? '#2B3440' : '#CBD5E1' },
      background: { default: page, paper },
      text: { primary: ink, secondary: muted, disabled: light ? DESIGN.faint : '#5C6670' },
      success: { main: '#27603A', light: DESIGN.tone.green.bg, contrastText: '#FFFFFF' },
      warning: { main: '#8A5A2F', light: DESIGN.tone.beige.bg, contrastText: '#FFFFFF' },
      error: { main: '#9B3B1B', light: DESIGN.tone.red.bg, contrastText: '#FFFFFF' },
      info: { main: '#2B5C9B', light: DESIGN.tone.blue.bg, contrastText: '#FFFFFF' },
      divider: line,
      action: {
        hover: alpha(ink, 0.04),
        selected: alpha(accentColor, 0.08),
        focus: alpha(accentColor, 0.12),
      },
    },
    shape: { borderRadius: DESIGN.radius.lg },
    typography: {
      fontFamily: DESIGN.font,
      fontSize: 14,
      h1: { fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h2: { fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h3: { fontWeight: 700, fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.2 },
      h4: { fontWeight: 800, fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.25 },
      h5: { fontWeight: 800, fontSize: 21, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h6: { fontWeight: 700, fontSize: 18, letterSpacing: '-0.005em', lineHeight: 1.35 },
      subtitle1: { fontWeight: 600, fontSize: 15 },
      subtitle2: { fontWeight: 600, fontSize: 13 },
      body1: { fontSize: 15, lineHeight: 1.5 },
      body2: { fontSize: 14, lineHeight: 1.5 },
      caption: { fontSize: 12, lineHeight: 1.4 },
      overline: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
      },
      button: { fontWeight: 600, letterSpacing: 0, textTransform: 'none', fontSize: 14 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: page,
            color: ink,
            fontFamily: DESIGN.font,
          },
          '::selection': { backgroundColor: alpha(accentColor, 0.18) },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.lg,
            textTransform: 'none',
            fontWeight: 600,
            paddingInline: 16,
            minHeight: 40,
            boxShadow: 'none',
          },
          sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: 13 },
          sizeLarge: { minHeight: 48, paddingInline: 22, fontSize: 15 },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          outlined: {
            borderColor: line,
            backgroundColor: paper,
            color: ink,
            '&:hover': { backgroundColor: hover, borderColor: light ? DESIGN.lineStrong : '#334050' },
            '&.MuiButton-colorPrimary': { color: accentColor, borderColor: alpha(accentColor, 0.35) },
            '&.MuiButton-colorError': { color: DESIGN.danger, borderColor: DESIGN.tone.red.line },
          },
          text: { '&:hover': { backgroundColor: hover } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: DESIGN.radius.md },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ ownerState }) => ({
            backgroundImage: 'none',
            borderRadius: DESIGN.radius.xl,
            ...(ownerState.elevation !== undefined && ownerState.elevation >= 16
              ? { boxShadow: DESIGN.shadow.dialog }
              : ownerState.elevation !== undefined && ownerState.elevation >= 8
                ? { boxShadow: DESIGN.shadow.menu, border: `1px solid ${line}` }
                : ownerState.variant === 'outlined'
                  ? { boxShadow: 'none', borderColor: line }
                  : { boxShadow: 'none', border: `1px solid ${line}` }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.xl,
            border: `1px solid ${line}`,
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: {
          root: {
            backgroundColor: paper,
            color: ink,
            borderBottom: `1px solid ${line}`,
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRadius: 0, backgroundImage: 'none', boxShadow: 'none' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 14, border: 'none', boxShadow: DESIGN.shadow.dialog },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: 20, fontWeight: 700, padding: '20px 24px 8px' } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '8px 24px 16px' } },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '12px 24px 20px', gap: 8, borderTop: `1px solid ${line}` },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: DESIGN.radius.lg, boxShadow: DESIGN.shadow.menu, border: `1px solid ${line}` },
          list: { padding: 6 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { borderRadius: DESIGN.radius.md, fontSize: 14, minHeight: 36, '&:hover': { backgroundColor: hover } },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: { borderRadius: DESIGN.radius.lg, boxShadow: DESIGN.shadow.menu, border: `1px solid ${line}` },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 600, fontSize: 12, height: 24 },
          sizeSmall: { height: 22, fontSize: 11 },
          label: { paddingInline: 10 },
          outlined: { borderColor: line },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.lg,
            backgroundColor: paper,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(accentColor, 0.5) },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: accentColor },
          },
          input: { paddingTop: 11, paddingBottom: 11 },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: 14 } },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 2 } },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: DESIGN.radius.xl } },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: muted,
              backgroundColor: head,
              borderBottom: `1px solid ${line}`,
              paddingTop: 10,
              paddingBottom: 10,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${line}`, padding: '12px 16px', fontSize: 14 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:last-child td': { borderBottom: 0 }, '&.MuiTableRow-hover:hover': { backgroundColor: hover } },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: { backgroundColor: paper, borderRadius: DESIGN.radius.lg },
          grouped: {
            border: `1px solid ${line}`,
            '&:not(:first-of-type)': { marginLeft: -1, borderLeft: `1px solid ${line}` },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            color: ink,
            paddingInline: 14,
            minHeight: 38,
            '&.Mui-selected': {
              backgroundColor: accentColor,
              color: '#FFFFFF',
              borderColor: accentColor,
              '&:hover': { backgroundColor: accentColor },
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44, borderBottom: `1px solid ${line}` },
          indicator: { height: 2, backgroundColor: accentColor },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 14,
            minHeight: 44,
            color: muted,
            '&.Mui-selected': { color: accentColor },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: DESIGN.radius.md,
            '&.Mui-selected': {
              backgroundColor: light ? DESIGN.softPrimary.bg : alpha(accentColor, 0.14),
              color: accentColor,
              '&:hover': { backgroundColor: light ? DESIGN.softPrimary.bg : alpha(accentColor, 0.18) },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: DESIGN.radius.lg, fontSize: 14, alignItems: 'center' },
          standard: {
            '&.MuiAlert-colorSuccess': { backgroundColor: DESIGN.tone.green.bg, color: DESIGN.tone.green.fg },
            '&.MuiAlert-colorWarning': { backgroundColor: DESIGN.tone.beige.bg, color: DESIGN.tone.beige.fg },
            '&.MuiAlert-colorError': { backgroundColor: DESIGN.tone.red.bg, color: DESIGN.tone.red.fg },
            '&.MuiAlert-colorInfo': {
              backgroundColor: light ? DESIGN.softPrimary.bg : alpha(accentColor, 0.12),
              color: light ? ink : '#E8ECF0',
            },
          },
          icon: { opacity: 0.9 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: DESIGN.radius.md,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: DESIGN.inkSoft,
            padding: '6px 10px',
          },
          arrow: { color: DESIGN.inkSoft },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, height: 6, backgroundColor: line },
          bar: { borderRadius: 999 },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: line } },
      },
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: 700, fontSize: 14, backgroundColor: light ? DESIGN.page : '#262D36', color: ink },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { borderRadius: DESIGN.radius.md } },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 999 },
        },
      },
    },
  });
}

/** The default the app opens with before anyone chooses. */
const theme = buildTheme(THEME_ACCENTS[0].color, 'light');

export default theme;
