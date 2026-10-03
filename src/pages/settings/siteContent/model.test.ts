/*
 * What the "Média a texty" screen derives from the slot registry: pages, counters, search,
 * drafts, the "who changed it" line, and the pure list helpers of partners and FAQ.
 */
import { describe, it, expect } from 'vitest';
import { SLOTS_BY_PAGE } from '../../../site/siteSlots';
import { mediaSlot, textSlot } from '../../../site/slotTypes';
import {
  buildPages, changedLine, countSlots, draftChanges, draftProblem, effectiveText, formatWhen, isDirty, isFilled, isMultiline,
  matchesQuery, placeholderSentence, ALT_LIMIT, TEXT_LIMIT,
} from './model';
import { changedSort, moveItem } from './ListParts';

const text = textSlot('t.one', 'Věta jedna', 'Stránka › Sekce', 'Výchozí věta');
const photo = mediaSlot('p.one', 'Fotka jedna', 'Stránka › Sekce', 'spiroergometrie na ergometru', '1600 × 900 px', '16 / 9');
const clip = mediaSlot('v.one', 'Video jedna', 'Stránka › Sekce', 'testování v klubu', '1920 × 1080 px', '16 / 9', 'video');

describe('buildPages', () => {
  const pages = buildPages();

  it('lists every registry page that has slots, the shared footer last, then Partneři and Časté otázky', () => {
    const slotPages = pages.filter((p) => p.type === 'slots');
    const withSlots = Object.entries(SLOTS_BY_PAGE).filter(([, slots]) => slots.length > 0).map(([id]) => id);
    expect(slotPages.map((p) => p.id)).toEqual([
      ...withSlots.filter((id) => id !== 'spolecne'),
      ...(withSlots.includes('spolecne') ? ['spolecne'] : []),
    ]);
    expect(pages.slice(-2).map((p) => p.id)).toEqual(['partners', 'faq']);
    expect(pages.slice(-2).map((p) => p.label)).toEqual(['Partneři', 'Časté otázky']);
  });

  it('names a page by the part of the registry group before "›" and splits it into sections by the part after', () => {
    for (const page of pages) {
      if (page.type !== 'slots') continue;
      expect(page.label).not.toContain('›');
      expect(page.slots.every((slot) => slot.group.startsWith(page.label))).toBe(true);
      expect(page.sections.flatMap((s) => s.slots)).toEqual(page.slots);
      expect(page.sections.every((s) => s.title !== '' && !s.title.includes('›'))).toBe(true);
    }
  });

  it('every slot of the registry is reachable from exactly one page', () => {
    const listed = pages.flatMap((p) => (p.type === 'slots' ? p.slots.map((s) => s.key) : []));
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.length).toBe(Object.values(SLOTS_BY_PAGE).flat().length);
  });
});

describe('counters', () => {
  it('counts a text slot as filled when it has its own text and a media slot when a file is uploaded', () => {
    expect(isFilled(text, undefined)).toBe(false);
    expect(isFilled(text, { kind: 'text', text: '  ' })).toBe(false);
    expect(isFilled(text, { kind: 'text', text: 'Moje' })).toBe(true);
    expect(isFilled(photo, { kind: 'image', alt: 'jen popis' })).toBe(false);
    expect(isFilled(photo, { kind: 'image', mediaUrl: 'https://x/y.jpg' })).toBe(true);
  });

  it('sums filled and total, separately for media and texts', () => {
    const counter = countSlots([text, photo, clip], {
      't.one': { kind: 'text', text: 'Moje' },
      'v.one': { kind: 'video', mediaUrl: 'https://x/v.mp4' },
    });
    expect(counter).toEqual({ filled: 2, total: 3, mediaFilled: 1, mediaTotal: 2, textFilled: 1, textTotal: 1 });
  });
});

describe('search', () => {
  it('matches label, key, group, default text and caption, ignoring case and diacritics', () => {
    expect(matchesQuery(text, '')).toBe(true);
    expect(matchesQuery(text, 'VETA')).toBe(true);
    expect(matchesQuery(text, 't.one')).toBe(true);
    expect(matchesQuery(text, 'sekce')).toBe(true);
    expect(matchesQuery(text, 'vychozi')).toBe(true);
    expect(matchesQuery(photo, 'ergometru')).toBe(true);
    expect(matchesQuery(photo, 'ponorka')).toBe(false);
  });

  it('puts a long or line-broken default text in a multi-line editor', () => {
    expect(isMultiline(text)).toBe(false);
    expect(isMultiline(textSlot('k', 'L', 'G', 'a\nb'))).toBe(true);
    expect(isMultiline(textSlot('k', 'L', 'G', 'x'.repeat(71)))).toBe(true);
    expect(isMultiline(textSlot('k', 'L', 'G', 'krátké', { multiline: true }))).toBe(true);
  });
});

describe('placeholder sentence', () => {
  it('says what belongs there and at what size, from the registry', () => {
    expect(placeholderSentence(photo)).toBe('Sem patří fotka — doporučeno 1600 × 900 px');
    expect(placeholderSentence(clip)).toBe('Sem patří video — doporučeno 1920 × 1080 px');
    expect(placeholderSentence({ ...photo, recommended: undefined })).toBe('Sem patří fotka');
  });
});

describe('drafts', () => {
  it('the text a slot shows is the admin text, else the default', () => {
    expect(effectiveText(text, undefined)).toBe('Výchozí věta');
    expect(effectiveText(text, { kind: 'text', text: '' })).toBe('Výchozí věta');
    expect(effectiveText(text, { kind: 'text', text: 'Moje' })).toBe('Moje');
  });

  it('a draft is a change only when it differs from what is stored', () => {
    expect(isDirty(text, undefined, undefined)).toBe(false);
    expect(isDirty(text, undefined, { text: 'Výchozí věta' })).toBe(false);
    expect(draftChanges(text, undefined, { text: 'Jiná' })).toEqual({ text: 'Jiná' });
    expect(draftChanges(text, { kind: 'text', text: 'Moje' }, { text: 'Moje' })).toEqual({});
    expect(draftChanges(photo, { kind: 'image', alt: 'a' }, { alt: 'b' })).toEqual({ alt: 'b' });
    expect(draftChanges(photo, undefined, { alt: '' })).toEqual({});
    // a text draft on a media slot is ignored
    expect(draftChanges(photo, undefined, { text: 'x' })).toEqual({});
  });

  it('refuses an empty or too long text and too long an alt, in words', () => {
    expect(draftProblem(text, { text: '   ' })).toContain('Text nesmí být prázdný.');
    expect(draftProblem(text, { text: 'x'.repeat(TEXT_LIMIT + 1) })).toContain('příliš dlouhý');
    expect(draftProblem(photo, { alt: 'x'.repeat(ALT_LIMIT + 1) })).toContain('příliš dlouhý');
    expect(draftProblem(text, { text: 'fajn' })).toBeUndefined();
  });
});

describe('who changed it, and when', () => {
  it('writes the time in Prague, Czech style', () => {
    expect(formatWhen('2026-10-03T12:05:00Z')).toBe('3. 10. 2026 14:05');
    expect(formatWhen('2026-01-15T23:30:00Z')).toBe('16. 1. 2026 00:30');
    expect(formatWhen('not a date')).toBe('');
    expect(formatWhen(undefined)).toBe('');
  });

  it('builds the sentence from whatever the server sent', () => {
    expect(changedLine({ kind: 'text', updatedBy: 'Jana', updatedAtUtc: '2026-10-03T12:05:00Z' })).toBe('Změnil Jana · 3. 10. 2026 14:05');
    expect(changedLine({ kind: 'text', updatedAtUtc: '2026-10-03T12:05:00Z' })).toBe('Změnil · 3. 10. 2026 14:05');
    expect(changedLine({ kind: 'text', updatedBy: 'Jana' })).toBe('Změnil Jana');
    expect(changedLine({ kind: 'text' })).toBe('');
    expect(changedLine(undefined)).toBe('');
  });
});

describe('moving and ordering list items', () => {
  const list = [{ id: 'a', sort: 5 }, { id: 'b', sort: 9 }, { id: 'c', sort: 12 }];

  it('moves one place and renumbers 1…n', () => {
    expect(moveItem(list, 'b', -1)).toEqual([{ id: 'b', sort: 1 }, { id: 'a', sort: 2 }, { id: 'c', sort: 3 }]);
    expect(moveItem(list, 'b', 1)).toEqual([{ id: 'a', sort: 1 }, { id: 'c', sort: 2 }, { id: 'b', sort: 3 }]);
  });

  it('stays in place at the ends and for an unknown id', () => {
    expect(moveItem(list, 'a', -1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(list, 'c', 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(list, 'zzz', 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('lists only the items whose sort changed — what a reorder has to write', () => {
    const tidy = [{ id: 'a', sort: 1 }, { id: 'b', sort: 2 }, { id: 'c', sort: 3 }];
    expect(changedSort(tidy, moveItem(tidy, 'a', 1)).map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(changedSort(tidy, tidy)).toEqual([]);
  });
});
