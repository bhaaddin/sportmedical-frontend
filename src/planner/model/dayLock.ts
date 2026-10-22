/*
 * R6 - what a LOCKED day looks like in the main calendar (a public holiday, a clinic closure, a weekend / day off).
 *
 *   holiday  a fixed strong RED family that does not depend on the accent (the accent shifts the board's own stylesheet
 *            colours; this colour is a literal, applied as an inline value, so it never moves). Editable in
 *            Nastavení > Kalendář a mřížka (`holidayColor`), but only to a colour that passes `holidayColorProblem`.
 *   closed   a weekend / day off / no period: one calm neutral grey, so a holiday is the thing that stands out.
 *
 * The look is one OPAQUE block over the whole day column: the fill is opaque, the ink on it reads at AA, and nothing of the
 * hour lines, the time labels, the hatch or the booking cards is drawn through it. Pure rules, no DOM; the board, the month
 * tile, the mini calendar, the phone strip and the legend all take their colours from here.
 */
import { AA, contrastRatio, parseColor, rgbToHsl } from '../../accent';
import { DARK_SURFACE, LIGHT_SURFACE, MIN_VISIBLE_RATIO, onDarkSurface, textOnColor, typedHex } from '../../colors/activityColor';
import type { DayMark } from './types';

/** The default holiday colour: a strong red, white ink on it reads at 5.6:1. */
export const DEFAULT_HOLIDAY_COLOR = '#C62828';
/** What the server used to open with (a beige): a stored value equal to it was never chosen by anybody, it is the old default. */
export const LEGACY_HOLIDAY_COLOR = '#E7CBA9';
/** The fill of a weekend / day off: neutral grey, white ink reads at 9.3:1. */
export const CLOSED_FILL = '#3F4852';

/** A closed day's number / flag text on the DARK board (reads at AA, calmer than any accent). */
export const CLOSED_DAY_TEXT = '#9AA7B4';

/** The colour to use for the holiday: the stored one when it is a deliberate, passing choice, else the default red. */
export function effectiveHolidayColor(stored: string | null | undefined): string {
  const hex = typedHex(stored);
  if (hex === null || hex === LEGACY_HOLIDAY_COLOR || holidayColorProblem(hex) !== null) return DEFAULT_HOLIDAY_COLOR;
  return hex;
}

export const HOLIDAY_GUARD_TEXT = {
  notHex: 'Zadejte barvu jako #RRGGBB, například #C62828.',
  text: 'Text na této barvě by byl špatně čitelný. Zvolte sytější a tmavší, nebo světlejší odstín.',
  dark: 'Na tmavém kalendáři by byl svátek špatně vidět. Zvolte světlejší barvu.',
  light: 'Na světlém pozadí by byl svátek špatně vidět. Zvolte tmavší barvu.',
  grey: 'Příliš šedá: svátek by splynul s víkendem a zavřenými dny. Zvolte výraznější barvu, nejlépe červenou.',
} as const;

/** The least colourfulness (HSL saturation, 0-100) a holiday colour needs to stand out from the grey of a closed day. */
export const HOLIDAY_MIN_SATURATION = 35;

/** Why `hex` cannot be the holiday colour (Czech, for the person choosing), or null when it can. */
export function holidayColorProblem(input: string | null | undefined): string | null {
  const hex = typedHex(input);
  if (hex === null) return HOLIDAY_GUARD_TEXT.notHex;
  if (textOnColor(hex).ratio < AA) return HOLIDAY_GUARD_TEXT.text;
  if (contrastRatio(hex, DARK_SURFACE) < MIN_VISIBLE_RATIO) return HOLIDAY_GUARD_TEXT.dark;
  if (contrastRatio(hex, LIGHT_SURFACE) < MIN_VISIBLE_RATIO) return HOLIDAY_GUARD_TEXT.light;
  const rgb = parseColor(hex);
  if (rgb === null || rgbToHsl(rgb).s < HOLIDAY_MIN_SATURATION) return HOLIDAY_GUARD_TEXT.grey;
  return null;
}

export type LockKind = 'holiday' | 'closed';

export interface LockedDayLook {
  kind: LockKind;
  /** Opaque `#RRGGBB` fill of the block. */
  fill: string;
  /** Text / icon colour on the fill (contrast >= AA). */
  ink: string;
  /** Contrast of the ink on the fill. */
  ratio: number;
  /** The block's one line: "Svátek · Den vzniku ..." / "Zavřeno". */
  label: string;
  /** A second, smaller line: why a closed day is closed (omitted when it only repeats the label). */
  reason: string | null;
}

/** The planner's mark of a day, as holiday or merely closed: `kind` when the data source says it, else a holiday when the day has a name. */
export function lockKindOf(mark: Pick<DayMark, 'kind' | 'label'> | undefined): LockKind {
  return mark?.kind ?? 'closed';
}

/** What the locked day shows. `mark.label` is the holiday's name / the closure's reason. */
export function lockedDayLook(mark: Pick<DayMark, 'kind' | 'label'>, holidayColor: string | null | undefined): LockedDayLook {
  const kind = lockKindOf(mark);
  const fill = kind === 'holiday' ? effectiveHolidayColor(holidayColor) : CLOSED_FILL;
  const ink = textOnColor(fill);
  const name = mark.label?.trim() ?? '';
  if (kind === 'holiday') {
    return { kind, fill, ink: ink.color, ratio: ink.ratio, label: name ? `Svátek · ${name}` : 'Svátek', reason: null };
  }
  return { kind, fill, ink: ink.color, ratio: ink.ratio, label: 'Zavřeno', reason: name && name !== 'Zavřeno' ? name : null };
}

/** A text colour for a holiday's name on the DARK board without a fill behind it (month tile flag, phone strip, mini calendar). */
export function holidayTextOnDark(holidayColor: string | null | undefined): string {
  return onDarkSurface(effectiveHolidayColor(holidayColor), AA);
}
