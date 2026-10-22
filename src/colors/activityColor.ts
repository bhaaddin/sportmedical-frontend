/*
 * ONE colour per činnost, drawn the same everywhere (reviewer 2.6) - the board's cards, a club's windows, the mini calendar's rings
 * and dots, the činnost cards and pills, the month tiles, the day lists, the phone agenda, the legends, the order and club screens,
 * the dashboard. This file is the only place that decides which colour that is, and the one place that says what text goes on it.
 *
 * Where the colour comes from (Nastavení -> Barvy služeb a činností, saved with the činnost, `PUT /api/activities/{id}`):
 *
 *   1. `effectiveColorHex`  what the server draws it in: the činnost's own colour when it has one, else a shade of its služba's
 *   2. `colorHex`           the činnost's own colour (an older answer that carries no effective one)
 *   3. `color`              the legacy colour of the pre-C1 screens (kept only so an old record is not grey)
 *   4. the služba's colour  (`ClinicService.colorHex`)
 *   5. a neutral grey       a činnost nobody coloured anywhere
 *
 * There is no second palette: the colours a person can pick are the clinic's own palette (Nastavení, `serviceColors`), or any
 * #RRGGBB typed in; both pass the same guard (`guardActivityColor`) before they are saved.
 */
import { AA, contrastRatio } from '../accent';
import { defaultActivityColor } from './defaultActivityColors';

/** A činnost nobody coloured anywhere. */
export const NEUTRAL_ACTIVITY_COLOR = '#6E91A5';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** `#RRGGBB` as sent (the case is kept) or null - anything else counts as "no colour sent". */
export function cleanHex(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return HEX.test(v) ? v : null;
}

/** What a person typed into a colour box: "e9c46a", "#E9C46A" -> "#E9C46A"; anything that is not six hex digits -> null. */
export function typedHex(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  if (v === '') return null;
  const withHash = v.startsWith('#') ? v : `#${v}`;
  return HEX.test(withHash) ? withHash.toUpperCase() : null;
}

/** The colour fields of a činnost, as the API sends them (every one may be missing). */
export interface ActivityColourFields {
  /** With the id, a činnost nobody coloured gets its own DISTINCT default (`defaultActivityColors.ts`) instead of the služba's shade. */
  id?: string | null;
  effectiveColorHex?: string | null;
  colorHex?: string | null;
  /** The legacy colour of the pre-C1 screens. */
  color?: string | null;
}

/** The colour a činnost is drawn in everywhere. */
export function activityColor(
  activity: ActivityColourFields | null | undefined,
  serviceColor?: string | null,
  fallback: string = NEUTRAL_ACTIVITY_COLOR,
): string {
  return (
    activityColorOrNull(activity) ??
    cleanHex(serviceColor) ??
    cleanHex(fallback) ??
    NEUTRAL_ACTIVITY_COLOR
  );
}

/** The činnost's own colour in the order above, or null when the činnost itself carries none (the služba's / the caller's colour is then up to the caller). */
export function activityColorOrNull(activity: ActivityColourFields | null | undefined): string | null {
  const own = cleanHex(activity?.colorHex);
  if (own !== null) return own;
  /* R12: no colour of its own -> the distinct default of this id, never the služba's shade the server sends as `effectiveColorHex`. */
  const id = (activity?.id ?? '').trim();
  if (id !== '') return defaultActivityColor(id);
  return cleanHex(activity?.effectiveColorHex) ?? cleanHex(activity?.color);
}

/** The činnost's OWN colour (what the setting stores), or null when it takes its služba's shade. */
export const ownActivityColor = (activity: Pick<ActivityColourFields, 'colorHex'> | null | undefined): string | null => cleanHex(activity?.colorHex);

/* ------------------------------------------------------------------------------------------------ text on a colour */

/** The ink on a light fill and the white on a dark one: the two texts the planner's pills use; pure black only where neither reaches AA. */
export const INK = '#1A1D21';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

export type TextOnColor = { color: typeof INK | typeof WHITE | typeof BLACK; ratio: number };

/** The text colour that reads best on `fill`, and how well it reads (WCAG contrast ratio). Always >= 4.5: black stands in for the ink on the few mid colours where the ink falls just short. */
export function textOnColor(fill: string): TextOnColor {
  const hex = cleanHex(fill) ?? typedHex(fill) ?? NEUTRAL_ACTIVITY_COLOR;
  const ink = contrastRatio(INK, hex);
  const white = contrastRatio(WHITE, hex);
  const best: TextOnColor = ink >= white ? { color: INK, ratio: ink } : { color: WHITE, ratio: white };
  if (best.ratio >= AA) return best;
  const black = contrastRatio(BLACK, hex);
  return black > best.ratio ? { color: BLACK, ratio: black } : best;
}

/* ------------------------------------------------------------------------------------------------------ the guard */

/** The planner's dark board and the light pages the colour is drawn on. */
export const DARK_SURFACE = '#001421';
export const LIGHT_SURFACE = '#FFFFFF';

/** A colour must be at least this visible against the surface it is drawn on (the line / dot of a non-text mark: WCAG 1.4.11 asks 3:1; the fill carries its own text). */
export const MIN_VISIBLE_RATIO = 1.6;

export interface ActivityColorGuard {
  /** A valid colour that can be saved. */
  ok: boolean;
  /** The normalised `#RRGGBB`, null while the text is not a colour. */
  hex: string | null;
  /** The ink or white that goes ON the colour, and its contrast. */
  text: TextOnColor | null;
  /** The text on the colour reads at AA (always true for a valid colour: see `textOnColor`). */
  textAA: boolean;
  /** Contrast of the colour against the dark board / the light page. */
  onDark: number | null;
  onLight: number | null;
  /** What is wrong, in Czech, for the person choosing. Empty when `ok`. */
  problems: string[];
}

export const GUARD_TEXT = {
  notHex: 'Zadejte barvu jako #RRGGBB, například #E9C46A.',
  tooDark: 'Příliš tmavá: na tmavém kalendáři by nebyla vidět. Zvolte světlejší.',
  tooLight: 'Příliš světlá: na světlém pozadí by nebyla vidět. Zvolte tmavší.',
} as const;

export function guardActivityColor(input: string): ActivityColorGuard {
  const hex = typedHex(input);
  if (hex === null) {
    return { ok: false, hex: null, text: null, textAA: false, onDark: null, onLight: null, problems: [GUARD_TEXT.notHex] };
  }
  const text = textOnColor(hex);
  const onDark = contrastRatio(hex, DARK_SURFACE);
  const onLight = contrastRatio(hex, LIGHT_SURFACE);
  const problems: string[] = [];
  if (onDark < MIN_VISIBLE_RATIO) problems.push(GUARD_TEXT.tooDark);
  if (onLight < MIN_VISIBLE_RATIO) problems.push(GUARD_TEXT.tooLight);
  return { ok: problems.length === 0, hex, text, textAA: text.ratio >= AA, onDark, onLight, problems };
}

/* ------------------------------------------------------------------------------------- a colour that shows on the dark stage */

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * The činnost's colour as a mark (dot, stripe, bar) on a dark surface: the colour itself when it already stands out
 * (`min` is the WCAG 1.4.11 ratio for a graphic), otherwise the same hue lightened step by step until it does. A very
 * dark shade of a služba's colour (#09423B) is otherwise invisible on the dark stage, so three činnosti read as one.
 */
export function onDarkSurface(color: string, min = 3, surface: string = DARK_SURFACE): string {
  const hex = cleanHex(color) ?? NEUTRAL_ACTIVITY_COLOR;
  if (contrastRatio(hex, surface) >= min) return hex.toUpperCase();
  const base = channels(hex);
  for (let step = 1; step <= 20; step++) {
    const mixed = toHex(base.map((v) => v + ((255 - v) * step) / 20));
    if (contrastRatio(mixed, surface) >= min) return mixed;
  }
  return '#FFFFFF';
}
