/*
 * 7.1: the text on a calendar's colour chip reaches 4.5:1. The palette header
 * says every entry is checked rather than guessed; this is the check.
 */
import { describe, it, expect } from 'vitest';
import { CALENDAR_PALETTE, paletteContrastFailures } from './calendarPalette';

describe('the calendar palette', () => {
  it('has entries to check', () => {
    expect(CALENDAR_PALETTE.length).toBeGreaterThan(0);
  });

  it('keeps the text on every colour readable', () => {
    expect(paletteContrastFailures()).toEqual([]);
  });
});
