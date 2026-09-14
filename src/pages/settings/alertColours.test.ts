/*
 * The three colours, and the rule that outranks choosing them.
 *
 * The owner asked for these and was told he would have them; then the screen
 * was never built, and he found it: "bavili sme sa s backendom ze budem moct
 * nastavit i farby alertov ... nevidim to nikde". He was right - it existed as
 * an answer and not as anything he could open.
 *
 * What these guard is narrow on purpose. A colour is only paint: every place
 * it is used says the state in words and gives the date too, which is what
 * makes choosing it safe at all.
 */
import { describe, it, expect } from 'vitest';
import {
  COLOUR_PROBLEM_TEXT, COLOUR_SLOTS, badColours, colourIsValid,
  coloursAreValid, coloursChanged, normalise,
} from './alertColours';
import type { AlertColours } from '../../api/alertColours';

const colours = (over: Partial<AlertColours> = {}): AlertColours => ({
  valid: '#2e7d32',
  expiringSoon: '#ed6c02',
  notCovered: '#c62828',
  ...over,
});

describe('what counts as a colour', () => {
  it('takes both lengths the server takes', () => {
    expect(colourIsValid('#2e7d32')).toBe(true);
    expect(colourIsValid('#abc')).toBe(true);
  });

  it('is not fussy about capitals or stray spaces', () => {
    expect(colourIsValid('#2E7D32')).toBe(true);
    expect(colourIsValid('  #2e7d32 ')).toBe(true);
  });

  /* Measured against the server: `"red"` comes back 400, "Barva musí být ve
     tvaru #rrggbb". Caught here so the field says which one is wrong. */
  it('refuses a name, a missing hash and a wrong length', () => {
    expect(colourIsValid('red')).toBe(false);
    expect(colourIsValid('2e7d32')).toBe(false);
    expect(colourIsValid('#2e7d3')).toBe(false);
    expect(colourIsValid('')).toBe(false);
  });

  it('refuses something that only looks like hex', () => {
    expect(colourIsValid('#zzzzzz')).toBe(false);
  });
});

describe('whether the three may be saved', () => {
  it('accepts a good set', () => {
    expect(coloursAreValid(colours())).toBe(true);
    expect(badColours(colours())).toEqual([]);
  });

  /*
   * The server refuses all three when one is wrong, and that is the right
   * behaviour: a palette half applied is a screen wearing colours nobody
   * picked. This names which one so the message lands on the field.
   */
  it('names the one that is wrong', () => {
    expect(badColours(colours({ expiringSoon: 'oranžová' }))).toEqual(['expiringSoon']);
    expect(coloursAreValid(colours({ expiringSoon: 'oranžová' }))).toBe(false);
  });

  it('names all of them when all are wrong', () => {
    expect(badColours(colours({ valid: 'a', expiringSoon: 'b', notCovered: 'c' })))
      .toHaveLength(3);
  });

  it('has a sentence saying what a colour looks like', () => {
    expect(COLOUR_PROBLEM_TEXT).toMatch(/#rrggbb/);
  });
});

describe('whether saving would change anything', () => {
  it('says no when nothing moved', () => {
    expect(coloursChanged(colours(), colours())).toBe(false);
  });

  it('notices each of the three', () => {
    expect(coloursChanged(colours(), colours({ valid: '#000000' }))).toBe(true);
    expect(coloursChanged(colours(), colours({ expiringSoon: '#000000' }))).toBe(true);
    expect(coloursChanged(colours(), colours({ notCovered: '#000000' }))).toBe(true);
  });

  /*
   * The server stores them lower-cased, so `#2E7D32` typed over `#2e7d32` is
   * the same colour and not an edit. Without this the save button lights up
   * for a change that would write the row back exactly as it was.
   */
  it('does not count a change of capitals as a change', () => {
    expect(coloursChanged(colours(), colours({ valid: '#2E7D32' }))).toBe(false);
    expect(coloursChanged(colours(), colours({ valid: '  #2e7d32  ' }))).toBe(false);
  });
});

describe('what gets sent', () => {
  it('goes lower-cased and trimmed, the way the server keeps them', () => {
    expect(normalise(colours({ valid: '  #2E7D32 ' }))).toEqual({
      valid: '#2e7d32',
      expiringSoon: '#ed6c02',
      notCovered: '#c62828',
    });
  });
});

describe('what each colour is for', () => {
  /*
   * The one rule that outranks all the choosing: a colour never appears
   * alone. The preview has to show it beside the sentence it will really sit
   * next to, or this screen would be teaching somebody to read the paint.
   */
  it('carries the sentence each colour will sit beside', () => {
    for (const slot of COLOUR_SLOTS) {
      expect(slot.sample.trim()).not.toBe('');
      expect(slot.detail.trim()).not.toBe('');
    }
  });

  it('covers the three standings and nothing else', () => {
    expect(COLOUR_SLOTS.map((s) => s.key)).toEqual(['valid', 'expiringSoon', 'notCovered']);
  });

  /* Amber is the one that says something can still be done cheaply, so its
     sample has to carry a date rather than a verdict. */
  it('shows a date on the one that is still fixable', () => {
    const soon = COLOUR_SLOTS.find((s) => s.key === 'expiringSoon');
    expect(soon?.sample).toMatch(/platí do/);
  });
});
