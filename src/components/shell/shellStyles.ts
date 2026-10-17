import { alpha, type Theme } from '@mui/material/styles';
import { DARK, DESIGN } from '../../theme';

/** The full sidebar's width, from the board (Main.dc.html: flex 0 0 258px). */
export const SIDEBAR_WIDTH = 258;
/** The tablet rail's resting width. */
export const RAIL_WIDTH = 72;
/** The phone's top bar and the bottom bar's content height. */
export const BAR_HEIGHT = 56;

/** The active entry's surface: the board's soft accent, kept readable in dark mode. */
export const activeBg = (t: Theme): string =>
  t.palette.mode === 'light' ? DESIGN.softPrimary.bg : alpha(t.palette.primary.main, 0.16);

/** The lit edge of the active entry in the dark theme (the prototype's cyan glow); nothing in light. */
export const activeGlow = (t: Theme, active: boolean): string =>
  t.palette.mode === 'dark' && active ? `inset 0 0 0 1px ${alpha(DARK.cyan, 0.38)}, 0 0 14px ${alpha(DARK.cyan, 0.14)}` : 'none';

/**
 * The glass of the sidebar and the tablet rail in the dark theme: the panel
 * gradient, a teal edge on the side that meets the page, a faint outer glow.
 * Light keeps the board's flat white.
 */
export const sideGlass = (t: Theme) =>
  t.palette.mode === 'light'
    ? {}
    : {
        backgroundImage: DARK.panel,
        borderColor: DARK.panelLine,
        boxShadow: `0 0 24px ${alpha(DARK.cyan, 0.1)}, inset -1px 0 0 ${alpha(DARK.cyan, 0.12)}`,
      };

/** The phone's top and bottom bars in dark: the page's navy, nearly opaque, with the prototype's teal edge. */
export const barGlass = (t: Theme) =>
  t.palette.mode === 'light'
    ? {}
    : { bgcolor: 'rgba(0, 19, 33, 0.94)', backdropFilter: 'blur(14px)', borderColor: DARK.lineLight };

/** A round or square primary action ("Nová objednávka" as an icon): flat accent in light, the lit aqua gradient in dark. */
export const primaryIconSx = (t: Theme) =>
  t.palette.mode === 'light'
    ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }
    : {
        background: DARK.primaryFill,
        color: DARK.onCyan,
        border: `1px solid ${DARK.primaryLine}`,
        boxShadow: DARK.primaryGlow,
        '&:hover': { background: DARK.primaryFillHover, boxShadow: DARK.primaryGlowHover },
      };

/** The visible keyboard focus every navigation control shares. */
export const focusRing = {
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
} as const;
