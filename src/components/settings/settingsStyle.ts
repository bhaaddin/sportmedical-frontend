import type { Theme } from '@mui/material';

/*
 * The look of every settings screen, in one place.
 *
 * Matko, 3. 10. 2026: "I click and can't tell what is a title, what a
 * subtitle, what I clicked. Strengthen the hierarchy - harder colours, end of
 * everything grey, a visible difference between levels."
 *
 * The scale is the Etapa 2 brief's, and a title and an item never differ by
 * colour alone - always size or weight too:
 *
 *   page title     28 / 700  full ink
 *   section title  18 / 700  full ink
 *   item name      15 / 600  full ink
 *   caption        14 / 400  the DARK grey (#4A5564, 7:1 on white - not the
 *                  mid-grey the rest of the app uses for hints)
 *   field label    11 / 700  uppercase, tracked, the same dark grey
 */

/** The caption grey: dark enough to read at a glance, still clearly below the ink. */
export const settingsGrey = (theme: Theme): string =>
  theme.palette.mode === 'light' ? '#4A5564' : '#B4BDC8';

/** A line harder than the app's hairline, so a row's edge is seen. */
export const settingsLine = (theme: Theme): string =>
  theme.palette.mode === 'light' ? '#C9D0D7' : '#3A444F';

/** What a hovered row turns: a visible tint, not a one-percent grey. */
export const settingsHover = (theme: Theme): string =>
  theme.palette.mode === 'light' ? '#E4EEEB' : 'rgba(255,255,255,0.08)';

/** What the row you are on (or have selected) rests on. */
export const settingsSelected = (theme: Theme): string =>
  theme.palette.mode === 'light' ? '#D7E9E5' : 'rgba(13,148,136,0.22)';

export const TYPE = {
  pageTitle: { fontSize: { xs: 24, md: 28 }, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.015em', color: 'text.primary' },
  sectionTitle: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'text.primary' },
  itemName: { fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: 'text.primary' },
  caption: { fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: settingsGrey },
  label: {
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: settingsGrey,
  },
} as const;

/** The 3px focus ring every link and button in settings shows on the keyboard. */
export const focusRing = {
  '&:focus-visible': {
    outline: '3px solid',
    outlineColor: 'primary.main',
    outlineOffset: 2,
  },
} as const;

/**
 * A large row: the shape of a group page's items, of the hub's search
 * results and of the nav's rows. Hover tints it, the active row carries the
 * 3px forest bar and the soft background, the keyboard gets the ring.
 */
export const rowSx = (active = false) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  minHeight: 64,
  px: 2.5,
  py: 1.75,
  textDecoration: 'none',
  color: 'text.primary',
  borderLeft: '3px solid',
  borderLeftColor: active ? 'primary.main' : 'transparent',
  bgcolor: active ? settingsSelected : 'transparent',
  '&:hover': { bgcolor: active ? settingsSelected : settingsHover },
  '&:focus-visible': {
    outline: '3px solid',
    outlineColor: 'primary.main',
    outlineOffset: -3,
  },
});

/** Widest a settings page's content grows. */
export const SETTINGS_MAX_WIDTH = 1240;

/** The three interfaces' edges (brief rule 3): phone to 767, iPad 768-1279, desktop from 1280. */
export const DESKTOP_UP = '@media (min-width: 1280px)';
export const TABLET_UP = '@media (min-width: 768px)';
export const PHONE_ONLY = '@media (max-width: 767px)';
