/*
 * R6 - the locked day: the contrast table (fill, ink and visibility on both surfaces, for every accent and both themes), the guard that
 * refuses a failing holiday colour, and the rule that the default does not move with the accent.
 */
import { describe, expect, it } from 'vitest';
import { AA, contrastRatio, deriveShift, shiftColor } from '../../accent';
import { DARK_SURFACE, LIGHT_SURFACE, MIN_VISIBLE_RATIO } from '../../colors/activityColor';
import { THEME_ACCENTS, buildTheme } from '../../theme';
import {
  CLOSED_DAY_TEXT,
  CLOSED_FILL,
  DEFAULT_HOLIDAY_COLOR,
  LEGACY_HOLIDAY_COLOR,
  effectiveHolidayColor,
  holidayColorProblem,
  holidayTextOnDark,
  lockedDayLook,
} from './dayLock';

const MODES = ['light', 'dark'] as const;
const COMBOS = THEME_ACCENTS.flatMap((a) => MODES.map((mode) => [a.key, a.color, mode] as const));

describe('the locked-day contrast table (6 accents x 2 themes)', () => {
  it.each(COMBOS)('%s (%s) %s: the ink reads on the holiday and the closed fill, and both blocks show on the surface', (_key, color, mode) => {
    const theme = buildTheme(color, mode);
    const surface = theme.palette.background.paper;
    for (const kind of ['holiday', 'closed'] as const) {
      const look = lockedDayLook({ kind, label: 'Den vzniku samostatného československého státu' }, undefined);
      expect(contrastRatio(look.ink, look.fill)).toBeGreaterThanOrEqual(AA);
      expect(look.ratio).toBeGreaterThanOrEqual(AA);
      /* the block is a shape on the surface it sits on (the planner's own minimum visibility is 1.6) */
      expect(contrastRatio(look.fill, DARK_SURFACE)).toBeGreaterThanOrEqual(MIN_VISIBLE_RATIO);
      expect(contrastRatio(look.fill, LIGHT_SURFACE)).toBeGreaterThanOrEqual(MIN_VISIBLE_RATIO);
      expect(contrastRatio(look.fill, surface)).toBeGreaterThanOrEqual(MIN_VISIBLE_RATIO);
    }
  });

  it('the holiday red does not depend on the accent: the look takes none, and the accent shift leaves a red alone', () => {
    const base = lockedDayLook({ kind: 'holiday', label: 'x' }, undefined);
    expect(base.fill).toBe(DEFAULT_HOLIDAY_COLOR);
    for (const a of THEME_ACCENTS) {
      expect(shiftColor(DEFAULT_HOLIDAY_COLOR, deriveShift(a.color)).toUpperCase()).toBe(DEFAULT_HOLIDAY_COLOR);
      expect(lockedDayLook({ kind: 'holiday', label: 'x' }, undefined).fill).toBe(base.fill);
    }
  });

  it('a holiday is red and a closed day is grey, and they read differently', () => {
    expect(contrastRatio(DEFAULT_HOLIDAY_COLOR, CLOSED_FILL)).toBeGreaterThan(1.2);
    const holiday = lockedDayLook({ kind: 'holiday', label: 'Nový rok' }, undefined);
    const closed = lockedDayLook({ kind: 'closed', label: 'Nepracovní den' }, undefined);
    expect(holiday.label).toBe('Svátek · Nový rok');
    expect(closed.label).toBe('Zavřeno');
    expect(closed.reason).toBe('Nepracovní den');
    expect(lockedDayLook({ kind: 'closed', label: 'Zavřeno' }, undefined).reason).toBeNull();
    expect(lockedDayLook({ kind: 'holiday', label: null }, undefined).label).toBe('Svátek');
    expect(lockedDayLook({ label: 'x' }, undefined).kind).toBe('closed');
  });

  it('the text colours on the dark board read at AA', () => {
    expect(contrastRatio(CLOSED_DAY_TEXT, DARK_SURFACE)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(holidayTextOnDark(undefined), DARK_SURFACE)).toBeGreaterThanOrEqual(AA);
  });
});

describe('the holiday colour guard', () => {
  it('accepts the default and other strong reds', () => {
    for (const c of [DEFAULT_HOLIDAY_COLOR, '#B71C1C', '#D32F2F', '#C2185B', '#E53935']) expect(holidayColorProblem(c)).toBeNull();
  });

  it('refuses what is not a colour', () => {
    expect(holidayColorProblem('červená')).toMatch(/#RRGGBB/);
    expect(holidayColorProblem('')).toMatch(/#RRGGBB/);
  });

  it('refuses a colour the board cannot show on the dark and on the light surface', () => {
    expect(holidayColorProblem('#112233')).toMatch(/tmavém/);
    expect(holidayColorProblem(LEGACY_HOLIDAY_COLOR)).toMatch(/světlém/); // the old beige: 1.5:1 on white
    expect(holidayColorProblem('#FFFF00')).toMatch(/světlém/);
  });

  it('refuses a grey (it would merge with the weekend)', () => {
    expect(holidayColorProblem('#777777')).toMatch(/šedá/);
    expect(holidayColorProblem(CLOSED_FILL)).not.toBeNull();
  });

  it('every colour that passes has AA ink on it (the guard is the contrast table)', () => {
    let accepted = 0;
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
          if (holidayColorProblem(hex) === null) {
            accepted += 1;
            expect(lockedDayLook({ kind: 'holiday', label: 'x' }, hex).ratio).toBeGreaterThanOrEqual(AA);
          }
        }
      }
    }
    expect(accepted).toBeGreaterThan(5);
  });
});

describe('the colour that is drawn', () => {
  it('a stored colour that passes is kept (upper-cased); the old beige and a failing colour become the red', () => {
    expect(effectiveHolidayColor('#b71c1c')).toBe('#B71C1C');
    expect(effectiveHolidayColor(LEGACY_HOLIDAY_COLOR)).toBe(DEFAULT_HOLIDAY_COLOR);
    expect(effectiveHolidayColor('#112233')).toBe(DEFAULT_HOLIDAY_COLOR);
    expect(effectiveHolidayColor(null)).toBe(DEFAULT_HOLIDAY_COLOR);
    expect(effectiveHolidayColor('nonsense')).toBe(DEFAULT_HOLIDAY_COLOR);
  });
});
