/*
 * Two categories one slip apart.
 *
 * "Prohlídka" and "Prohlídky" side by side in one price list are two names for
 * one thing, and nobody meant to create the second.
 *
 * This used to be more. A required document hung off the category, so a
 * mistyped one turned that requirement off silently, and this file guarded it.
 * On 13. 9. 2026 the requirement moved onto a clinic service - the chain is
 * `termín -> činnost -> služba -> pravidlo` and the price list is outside it -
 * so the guard went with the link and what is left is tidiness.
 *
 * Worth recording: the guard was correct and well built, and it was guarding a
 * list of categories nobody had asked for. They were seed data. The better it
 * looked, the more convincing the invented list looked with it.
 */
import { describe, it, expect } from 'vitest';
import { nearMiss } from './categoryMeaning';

const KNOWN = ['Diagnostika', 'Měření', 'Prohlídka', 'Terapie'];

describe('the category one slip away', () => {
  it('spots the plural of an existing one', () => {
    expect(nearMiss('Prohlídky', KNOWN)).toBe('Prohlídka');
  });

  it('spots a single wrong letter', () => {
    expect(nearMiss('Prohlidka', KNOWN)).toBe('Prohlídka');
    expect(nearMiss('Diagnostyka', KNOWN)).toBe('Diagnostika');
  });

  /* An exact match is not a near miss, whatever its case. */
  it('says nothing when the category is simply right', () => {
    expect(nearMiss('Prohlídka', KNOWN)).toBeNull();
    expect(nearMiss('prohlídka', KNOWN)).toBeNull();
  });

  /*
   * A category deliberately invented must not be nagged about. The owner
   * makes his own služby; "Rehabilitace" is a real answer, not a typo.
   */
  it('says nothing about a category that is genuinely different', () => {
    expect(nearMiss('Rehabilitace', KNOWN)).toBeNull();
    expect(nearMiss('Poradenství', KNOWN)).toBeNull();
  });

  /*
   * A word still being typed is not a mistake, and that is not the same thing
   * as a short word.
   *
   * This started as "say nothing under four letters", and the test that was
   * meant to prove it used only the four long categories - where nothing is
   * within two edits of a three-letter word anyway, so it passed with or
   * without the rule and proved neither. Adding a short category showed the
   * rule was wrong in both directions: silent about `Prohlí`, which is six
   * letters of somebody still typing, and silent about `EKX` against a real
   * `EKG`, which is a typo worth catching.
   *
   * What separates them is whether the typed word begins the other one.
   */
  it('keeps quiet while a word is still being typed', () => {
    /*
     * `Terapi` is the case that makes this rule earn its place: one letter
     * short of `Terapie`, so the edit distance is 1 and without the prefix
     * test the box would correct somebody who is mid-word. `Prohlí` and
     * `Diagnos` are further off and the distance alone already refuses them -
     * the first version of this test used only those two and so passed with
     * or without the rule it was meant to prove.
     */
    expect(nearMiss('Terapi', KNOWN)).toBeNull();
    expect(nearMiss('Prohlí', KNOWN)).toBeNull();
    expect(nearMiss('Diagnos', KNOWN)).toBeNull();
    expect(nearMiss('EK', [...KNOWN, 'EKG'])).toBeNull();
  });

  it('still catches a typo in a short name, which a length rule would not', () => {
    expect(nearMiss('EKX', [...KNOWN, 'EKG'])).toBe('EKG');
  });

  it('keeps quiet about two letters, which are not a word yet', () => {
    /*
     * `XK` is within two edits of `EKG` and is not the start of it, so the
     * prefix rule lets it through and only the length floor stops it. Two
     * letters are somebody still typing whatever they are near.
     */
    expect(nearMiss('XK', ['EKG'])).toBeNull();
    expect(nearMiss('ab', KNOWN)).toBeNull();
  });

  it('copes when there is nothing to compare against', () => {
    expect(nearMiss('Prohlídky', [])).toBeNull();
  });
});
