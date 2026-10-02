/*
 * One word, one meaning.
 *
 * "Služba" meant two things in this application at once:
 *
 *     the price list   a billable row      "Komplexní prohlídka, 2 500 Kč"
 *     the calendars    a calendar          "Kalendář je služba, do které se
 *                                           objednává"
 *
 * It misled the owner three times in a day. He said "služba to je sportovní
 * lékařská prohlídka" meaning the second, while the question was about the
 * first, and he was not confused - the screens were. It is the same fault this
 * project spends its time removing, in the naming instead of in a table.
 *
 * The three words, kept apart:
 *
 *     činnost          what you schedule   "Komplexní prohlídka, 60 min, út"
 *     položka ceníku   what you bill       "Komplexní prohlídka, 2 500 Kč"
 *     kalendář         where and when      "Sportovní diagnostika"
 *
 * One visit is scheduled as a činnost and billed as one or more položky. They
 * are not synonyms and must not look like synonyms on screen.
 *
 * Only the Czech wording is held here. `api/services` and `ServiceItem` keep
 * their names in the code: renaming those would reach into booking's
 * `Activity.ServiceItemId` and into invoicing, and would gain nothing, because
 * it was the labels that misled and not the identifiers.
 */
import { describe, it, expect } from 'vitest';
import cs from '../i18n/locales/cs.json';
import cenikSource from '../pages/Cenik.tsx?raw';
import dialogSource from '../pages/pricing/ServiceDialog.tsx?raw';

const SLUZBA = /služb[aeuyoí]|službám|služeb/i;

const wording = cs as Record<string, unknown>;

function textsUnder(path: string): string[] {
  const node = path.split('.').reduce<unknown>(
    (o, part) => (o as Record<string, unknown> | undefined)?.[part],
    wording,
  );
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(node);
  return out;
}

describe('a calendar is not called a služba', () => {
  /* Guards the lookup: a path that quietly resolved to nothing would leave
     the assertion below true of an empty list. */
  it('finds the calendar wording at all', () => {
    const texts = textsUnder('booking.calendars');
    expect(texts.length).toBeGreaterThan(5);
    expect(texts.join(' ')).toMatch(/kalendář/i);
  });

  /*
   * `booking.calendars.empty` used to read "Kalendář je služba, do které se
   * objednává" - the sentence that taught the word its second meaning.
   */
  it('says kam se objednává, not služba', () => {
    for (const text of textsUnder('booking.calendars')) {
      expect(text, text).not.toMatch(SLUZBA);
    }
  });
});

describe('a price-list row is called a položka', () => {
  const screens = `${cenikSource as string}\n${dialogSource as string}`;

  it('finds the price-list screens at all', () => {
    expect(screens).toContain('Ceník');
    expect(screens.length).toBeGreaterThan(1000);
  });

  /*
   * Only what the reader sees.
   *
   * Comments are stripped first, and that is not a convenience: both files
   * explain this very history and have to use the old word to do it. A check
   * that forbade the word everywhere would forbid recording why it was
   * dropped - and the first version of this test did exactly that, reporting
   * three comment fragments alongside the one real label.
   */
  const withoutComments = screens
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

  it('still has the screens after the comments are taken out', () => {
    expect(withoutComments).toContain('Ceník');
    expect(withoutComments).toContain('položku');
  });

  it('offers no button or label calling a row a služba', () => {
    const labels = [
      ...withoutComments.matchAll(/(?:aria-label=\{?`|>|'|")([^'"`<>{}]*služb[^'"`<>{}]*)/gi),
    ].map((m) => m[1].trim()).filter((t) => t !== '');

    expect(labels, `nápisy se slovem služba: ${labels.join(' | ')}`).toEqual([]);
  });
});
