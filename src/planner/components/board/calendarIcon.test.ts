import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../IconSprite.generated';
import { CALENDAR_ICON_FALLBACK, calendarIconName } from './calendarIcon';

describe('calendarIconName (R20: icons by name keywords, neutral fallback, nothing hard-coded to one clinic)', () => {
  it.each([
    ['Ordinace 1', 'heart'],
    ['Diagnostika', 'gauge'],
    ['InBody', 'physio'],
    ['Balíčky', 'dumbbell'],
    ['BALÍČKY', 'dumbbell'],
    ['Spiroergometrie', 'gauge'],
  ])('%s -> %s', (name, icon) => expect(calendarIconName(name)).toBe(icon));

  it('the calendar name decides first, the služba name second', () => {
    expect(calendarIconName('Sál 3', 'Sportovní diagnostika')).toBe('gauge');
    expect(calendarIconName('Diagnostika', 'Zvýhodněné balíčky')).toBe('gauge');
  });

  it('an unknown name gets the neutral calendar icon', () => {
    expect(calendarIconName('Sál 3')).toBe(CALENDAR_ICON_FALLBACK);
    expect(calendarIconName('', null)).toBe('calendar');
    expect(calendarIconName(undefined)).toBe('calendar');
  });

  it('only ever names an icon of the planner set', () => {
    for (const n of ['Ordinace', 'Diagnostika', 'InBody', 'Balíčky', 'Klub', 'Trénink', 'xyz']) expect(ICON_NAMES).toContain(calendarIconName(n));
  });
});
