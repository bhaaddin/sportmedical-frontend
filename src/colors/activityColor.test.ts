/*
 * Reviewer 2.6 - one colour per činnost, the same everywhere: where it comes from (the order), what text goes on it, and the guard
 * that refuses a colour nobody could see. Contrast tables are computed with the same WCAG formula the theme tests use.
 */
import { describe, expect, it } from 'vitest';
import { AA, contrastRatio } from '../accent';
import {
  BLACK, DARK_SURFACE, GUARD_TEXT, INK, LIGHT_SURFACE, NEUTRAL_ACTIVITY_COLOR, WHITE, activityColor, activityColorOrNull, cleanHex, guardActivityColor, ownActivityColor, textOnColor, typedHex,
} from './activityColor';

/* the clinic's own default palette (Nastavení -> serviceColors, as the dev API ships it) */
const CLINIC_PALETTE = ['#0D5C52', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#65A30D', '#DB2777', '#475569', '#92400E'];
/* the six accents of the desk (they are colours people pick for činnosti too) and a spread of awkward ones */
const AWKWARD = ['#E9C46A', '#F4D35E', '#FFEB3B', '#FFFFFF', '#000000', '#777777', '#767676', '#6E91A5', '#00E6E4', '#001421', '#E76F51', '#2A9D8F', '#264653'];

describe('cleanHex and typedHex', () => {
  it('cleanHex takes the #RRGGBB the API sends, as sent, and nothing else', () => {
    expect(cleanHex('#e9c46a')).toBe('#e9c46a');
    expect(cleanHex('  #0D5C52 ')).toBe('#0D5C52');
    for (const bad of ['E9C46A', '', '  ', '#fff', '#12345', '#1234567', '#GGGGGG', 'red', null, undefined]) expect(cleanHex(bad as string | null | undefined)).toBeNull();
  });

  it('typedHex takes what a person types: any case, with or without the #, normalised to upper case', () => {
    expect(typedHex('#e9c46a')).toBe('#E9C46A');
    expect(typedHex('E9C46A')).toBe('#E9C46A');
    expect(typedHex('  #0d5c52 ')).toBe('#0D5C52');
    for (const bad of ['', '  ', '#fff', '#12345', '#1234567', '#GGGGGG', 'red', null, undefined]) expect(typedHex(bad as string | null | undefined)).toBeNull();
  });
});

describe('where the colour of a činnost comes from', () => {
  const service = '#2563EB';
  it('the server\'s effective colour wins, then the own colour, then the legacy one, then the služba\'s, then grey', () => {
    expect(activityColor({ effectiveColorHex: '#111111', colorHex: '#222222', color: '#333333' }, service)).toBe('#111111');
    expect(activityColor({ effectiveColorHex: null, colorHex: '#222222', color: '#333333' }, service)).toBe('#222222');
    expect(activityColor({ colorHex: null, color: '#333333' }, service)).toBe('#333333');
    expect(activityColor({}, service)).toBe('#2563EB');
    expect(activityColor({}, null)).toBe(NEUTRAL_ACTIVITY_COLOR);
    expect(activityColor(null, undefined)).toBe(NEUTRAL_ACTIVITY_COLOR);
    expect(activityColor({}, null, '#B3B9C0')).toBe('#B3B9C0');
  });

  it('a colour that is not #RRGGBB is skipped, not drawn', () => {
    expect(activityColor({ effectiveColorHex: 'nope', colorHex: '#222222' }, service)).toBe('#222222');
    expect(activityColor({ effectiveColorHex: '', colorHex: '', color: 'green' }, service)).toBe('#2563EB');
  });

  it('activityColorOrNull is the činnost\'s own answer only: null leaves the služba\'s colour to the caller', () => {
    expect(activityColorOrNull({ effectiveColorHex: '#111111' })).toBe('#111111');
    expect(activityColorOrNull({ colorHex: null })).toBeNull();
    expect(activityColorOrNull(null)).toBeNull();
  });

  it('the own colour (what the setting stores) is the colorHex alone', () => {
    expect(ownActivityColor({ colorHex: '#e9c46a' })).toBe('#e9c46a');
    expect(ownActivityColor({ colorHex: null })).toBeNull();
  });

  it('is the one answer the planner, the calendar model and the club catalogue give (no second rule)', async () => {
    const { categoryOf } = await import('../planner/api/mappers');
    const { activityInfoOf, colourOfActivity } = await import('../components/booking/calendar/model');
    const base = { id: 'a1', name: 'Komplexní prohlídka', durationMinutes: 60, clinicServiceId: 's1', isActive: true, sortOrder: 0 } as never;
    const activity = { ...(base as object), effectiveColorHex: '#E9C46A', colorHex: '#E9C46A', color: '#00AA00' } as never;
    expect(categoryOf(activity, { id: 's1', colorHex: '#2563EB' } as never).color.toUpperCase()).toBe('#E9C46A');
    const info = activityInfoOf(activity);
    expect(info.colorHex?.toUpperCase()).toBe('#E9C46A');
    expect(colourOfActivity({ activities: new Map([['a1', info]]), services: new Map() }, 'a1', '#999999').toUpperCase()).toBe('#E9C46A');
    /* no colour on the činnost: both fall to the služba's, the calendar's own colour only when there is no služba colour either */
    const plain = { ...(base as object) } as never;
    expect(categoryOf(plain, { id: 's1', colorHex: '#2563EB' } as never).color.toUpperCase()).toBe('#2563EB');
    expect(colourOfActivity({ activities: new Map([['a1', activityInfoOf(plain)]]), services: new Map([['s1', { id: 's1', name: 'S', colorHex: '#2563EB', sortOrder: 0, isActive: true }]]) }, 'a1', '#999999')).toBe('#2563EB');
  });
});

describe('the text that goes on a colour', () => {
  it.each([...CLINIC_PALETTE, ...AWKWARD])('%s: the chosen text reads at AA on it', (fill) => {
    const { color, ratio } = textOnColor(fill);
    expect([INK, WHITE, BLACK]).toContain(color);
    expect(ratio).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(color, fill)).toBeCloseTo(ratio, 6);
  });

  it('picks ink on a light fill and white on a dark one', () => {
    expect(textOnColor('#E9C46A').color).toBe(INK);
    expect(textOnColor('#FFEB3B').color).toBe(INK);
    expect(textOnColor('#264653').color).toBe(WHITE);
    expect(textOnColor('#0D5C52').color).toBe(WHITE);
  });

  it('the worst case - the mid grey where ink and white meet - still reads at AA (black takes over where the ink falls short)', () => {
    expect(textOnColor('#777777').color).toBe(BLACK);
    let worst = Infinity;
    for (let v = 0; v <= 255; v += 1) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      worst = Math.min(worst, textOnColor(hex).ratio);
    }
    expect(worst).toBeGreaterThanOrEqual(AA);
  });
});

describe('the guard', () => {
  it('accepts the clinic\'s whole palette and the owner\'s yellow', () => {
    for (const hex of [...CLINIC_PALETTE, '#E9C46A', '#E76F51']) {
      const g = guardActivityColor(hex);
      expect(g.ok, hex).toBe(true);
      expect(g.problems).toEqual([]);
      expect(g.textAA).toBe(true);
      expect(g.hex).toBe(hex.toUpperCase());
      expect(g.text?.ratio ?? 0).toBeGreaterThanOrEqual(AA);
    }
  });

  it('refuses what is not a colour and says what a colour looks like', () => {
    for (const bad of ['', 'abc', '#12', 'zzzzzz']) {
      const g = guardActivityColor(bad);
      expect(g).toMatchObject({ ok: false, hex: null, text: null, onDark: null, onLight: null });
      expect(g.problems).toEqual([GUARD_TEXT.notHex]);
    }
  });

  it('refuses a colour that vanishes on the dark calendar, and one that vanishes on the light page', () => {
    expect(guardActivityColor(DARK_SURFACE).problems).toEqual([GUARD_TEXT.tooDark]);
    expect(guardActivityColor('#000000').problems).toContain(GUARD_TEXT.tooDark);
    expect(guardActivityColor('#03101C').ok).toBe(false);
    expect(guardActivityColor(LIGHT_SURFACE).problems).toEqual([GUARD_TEXT.tooLight]);
    expect(guardActivityColor('#FDFDFD').ok).toBe(false);
  });

  it('reports the contrast against both surfaces and the text colour for the preview', () => {
    const g = guardActivityColor('e9c46a');
    expect(g.hex).toBe('#E9C46A');
    expect(g.onDark).toBeCloseTo(contrastRatio('#E9C46A', DARK_SURFACE), 6);
    expect(g.onLight).toBeCloseTo(contrastRatio('#E9C46A', LIGHT_SURFACE), 6);
    expect(g.text?.color).toBe(INK);
  });
});
