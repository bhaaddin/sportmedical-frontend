import { alpha, type Theme } from '@mui/material/styles';
import { DESIGN } from '../../theme';

/** The full sidebar's width, from the board (Main.dc.html: flex 0 0 258px). */
export const SIDEBAR_WIDTH = 258;
/** The tablet rail's resting width. */
export const RAIL_WIDTH = 72;
/** The phone's top bar and the bottom bar's content height. */
export const BAR_HEIGHT = 56;

/** The active entry's surface: the board's soft accent, kept readable in dark mode. */
export const activeBg = (t: Theme): string =>
  t.palette.mode === 'light' ? DESIGN.softPrimary.bg : alpha(t.palette.primary.main, 0.16);

/** The visible keyboard focus every navigation control shares. */
export const focusRing = {
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
} as const;
