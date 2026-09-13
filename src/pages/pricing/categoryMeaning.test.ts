/*
 * The word that stopped being a label.
 *
 * A price-list category used to be a colour on a card. Since 13. 9. 2026 a
 * required document hangs off it: a služba filed under `Prohlídka` makes the
 * patient bring a výpis, one under `Měření` does not. The chain is
 * `termín → činnost → služba → kategorie`, and the last link is a free-text
 * box the owner types into.
 *
 * The server compares it with `OrdinalIgnoreCase` and nothing else. So
 * `Prohlídky` is not `Prohlídka`, and one letter turns off a required medical
 * document for every service in that category - silently, because nothing on
 * screen mentioned that the category decided anything at all.
 *
 * The owner asked, looking straight at that field: "so there's no category
 * here?? but that's where you say what it belongs to?? I don't understand."
 */
import { describe, it, expect } from 'vitest';
import { categoryMeaning, nearMiss } from './categoryMeaning';

const RULES = [
  { templateName: 'Výpis ze zdravotní dokumentace', serviceCategory: 'Prohlídka' },
];
const KNOWN = ['Diagnostika', 'Měření', 'Prohlídka', 'Terapie'];

describe('what a category means', () => {
  it('says which documents a category requires', () => {
    expect(categoryMeaning('Prohlídka', RULES, KNOWN)).toEqual({
      kind: 'requires',
      documents: ['Výpis ze zdravotní dokumentace'],
    });
  });

  /* The server's own comparison is case-insensitive, so this screen must not
     be stricter than the rule it is describing. */
  it('matches the way the server matches — case makes no difference', () => {
    expect(categoryMeaning('prohlídka', RULES, KNOWN).kind).toBe('requires');
    expect(categoryMeaning('  Prohlídka  ', RULES, KNOWN).kind).toBe('requires');
  });

  it('says plainly when a known category requires nothing', () => {
    expect(categoryMeaning('Měření', RULES, KNOWN)).toEqual({ kind: 'known-no-rule' });
  });

  /*
   * The case the whole file is for. One letter, and the výpis is no longer
   * asked for - and on screen it looks exactly like deliberately inventing a
   * category, which is a thing the owner is allowed to do.
   */
  it('calls a mistyped category new, because that is what the server will call it', () => {
    expect(categoryMeaning('Prohlídky', RULES, KNOWN)).toEqual({ kind: 'new' });
  });

  it('says nothing about an empty box', () => {
    expect(categoryMeaning('', RULES, KNOWN)).toEqual({ kind: 'empty' });
    expect(categoryMeaning('   ', RULES, KNOWN)).toEqual({ kind: 'empty' });
  });

  it('lists every document when a category carries more than one', () => {
    const two = [...RULES, { templateName: 'Informovaný souhlas', serviceCategory: 'Prohlídka' }];
    expect(categoryMeaning('Prohlídka', two, KNOWN)).toMatchObject({
      documents: ['Výpis ze zdravotní dokumentace', 'Informovaný souhlas'],
    });
  });

  /* An empty list is a real answer: no rule exists. That is the state of the
     clinic today - the rules were wiped with the seed. */
  it('treats an empty rule list as a real "nothing required"', () => {
    expect(categoryMeaning('Prohlídka', [], KNOWN)).toEqual({ kind: 'known-no-rule' });
  });
});

/*
 * "Nothing is required here" and "I could not find out" are the same sentence
 * to anybody who cannot tell them apart - and the first is a reassurance while
 * the second is the absence of one.
 *
 * It stopped being hypothetical on 13. 9. 2026: the requirement moved off the
 * price-list category and onto a clinic service, so every rule this screen
 * reads will stop carrying a category. Without this state the dialog would
 * have gone on saying "nepojí se žádný povinný dokument" about everything,
 * confidently.
 */
describe('when the rules cannot be read', () => {
  it('says nothing while they are still loading', () => {
    expect(categoryMeaning('Prohlídka', undefined, KNOWN)).toEqual({ kind: 'unknown' });
  });

  it('says nothing when the request failed', () => {
    expect(categoryMeaning('Prohlídka', null, KNOWN)).toEqual({ kind: 'unknown' });
  });

  /* The shape the coming change produces: a rule that hangs off something
     this screen does not know about. */
  it('says nothing when a rule carries no category at all', () => {
    const moved = [{ templateName: 'Výpis', serviceCategory: undefined as unknown as string }];
    expect(categoryMeaning('Prohlídka', moved, KNOWN)).toEqual({ kind: 'unknown' });
  });

  /*
   * One unreadable rule is enough. The one that cannot be read may be the one
   * that matters, so a list half of which makes sense is not a list to answer
   * from.
   */
  it('says nothing when only one rule of several is unreadable', () => {
    const half = [
      { templateName: 'Výpis', serviceCategory: 'Prohlídka' },
      { templateName: 'Souhlas', serviceCategory: '' },
    ];
    expect(categoryMeaning('Prohlídka', half, KNOWN)).toEqual({ kind: 'unknown' });
  });

  /* And an empty box is still an empty box, whatever the rules are doing. */
  it('still says nothing about an empty box', () => {
    expect(categoryMeaning('', undefined, KNOWN)).toEqual({ kind: 'empty' });
  });
});

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
