/*
 * The shelf's look, as functions of the MUI theme - so the picked accent (Nastavení -> Osobní -> Vzhled), light and dark
 * mode and the planner's glass all reach it without one colour typed here (`src/accent.guard.test.ts` holds that line).
 *
 * The one memorable thing: every shelf has a RAIL, a hairline in the accent that fades out to the right, under its row
 * of cards. The cards stand on it. Everything else is quiet: one radius, one border, glass only in dark.
 */
import type { SxProps, Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DARK, darkOf, toneColors, tintsOf } from '../../theme';

export type ShelfTone = 'green' | 'beige' | 'red' | 'grey' | 'blue' | 'primary';

/** One radius for everything on a shelf: its cards, its boards and the cards a `free` shelf wraps. */
export const CARD_RADIUS = 16;

export const accentOf = (t: Theme): string => (t.palette.mode === 'dark' ? darkOf(t).cyan : t.palette.primary.main);

/** Foreground / background / line of a tone, `primary` being the picked accent. */
export function toneOf(t: Theme, tone: ShelfTone): { fg: string; bg: string; line: string } {
  if (tone !== 'primary') return toneColors(t, tone);
  const dark = t.palette.mode === 'dark';
  return {
    fg: dark ? t.palette.primary.light : t.palette.primary.main,
    bg: alpha(accentOf(t), dark ? 0.14 : 0.1),
    line: alpha(accentOf(t), dark ? 0.5 : 0.35),
  };
}

/** The surface of a card standing on a shelf. `interactive` adds hover, focus and press. */
export function cardSurface(t: Theme, interactive: boolean): Record<string, unknown> {
  const dark = t.palette.mode === 'dark';
  const d = darkOf(t);
  return {
    position: 'relative',
    minWidth: 0,
    borderRadius: `${CARD_RADIUS}px`,
    border: '1px solid',
    borderColor: dark ? alpha(d.cyan, 0.34) : t.palette.divider,
    backgroundColor: t.palette.background.paper,
    ...(dark ? { backgroundImage: DARK.panel } : {}),
    color: 'text.primary',
    textDecoration: 'none',
    transition: 'border-color 140ms, box-shadow 140ms, background-color 140ms, translate var(--sm-dur-quick, 140ms) var(--sm-ease-pop, ease), scale var(--sm-dur-quick, 140ms) var(--sm-ease-pop, ease)',
    ...(interactive
      ? {
          cursor: 'pointer',
          '&:hover': {
            borderColor: dark ? d.panelLine : tintsOf(t).softLine,
            boxShadow: dark ? `0 0 18px ${alpha(d.cyan, 0.18)}` : '0 6px 18px rgba(20, 24, 28, 0.08)',
          },
          '&:focus-visible': { outline: `2px solid ${accentOf(t)}`, outlineOffset: 2 },
          /* A card lifts a hair on hover, only when motion is fully on (the setting is on <html data-motion>). */
          'html[data-motion="full"] &:hover': { translate: '0 -2px' },
          /* Pressed: the card dips (the kit's --sm-press is 1, no dip, when motion is off). */
          '&:active': { scale: 'var(--sm-press, 1)' },
        }
      : {}),
  };
}

/** The rail: a hairline in the accent that fades out, with a faint glow under it. */
export function railSx(t: Theme): SxProps<Theme> {
  const a = accentOf(t);
  return {
    height: '2px',
    borderRadius: 2,
    background: `linear-gradient(90deg, ${alpha(a, 0.9)} 0%, ${alpha(a, 0.35)} 38%, ${alpha(a, 0)} 92%)`,
    boxShadow: t.palette.mode === 'dark' ? `0 0 10px ${alpha(a, 0.35)}` : 'none',
  };
}

/** Quiet text under a title. */
export const MUTED_SX = { color: 'text.secondary' } as const;

/** One touch target: 44 px under 1280, 32 px above (a pointer is precise). */
export const TARGET_SX = { minHeight: 32, '@media (max-width: 1279.95px)': { minHeight: 44, minWidth: 44 } } as const;
