/*
 * The discount rules away from the screen: reading a typed percentage, what
 * makes a row wrong, how the server's refusals find their row, and what a
 * headcount comes to.
 */
import { describe, it, expect } from 'vitest';
import {
  dearestPriced, exampleLine, formatPercent, hasErrors, headcountSentence, initialHeadcount, isOwnerRole, parsePercent,
  placeServerErrors, rangeFor, rangeText, roleLabel, signature, tierRanges, toDraft, toPayload, validateDraft,
} from './discountLogic';

const SETTINGS = {
  tiers: [{ minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 10, percent: 15 }],
  packageDiscounts: [{ activityId: 'a-1', percent: 8 }],
  roleLimits: [{ role: 'Reception', maxManualPercent: 5 }],
};

describe('parsePercent', () => {
  it('reads comma or dot, at most two decimals', () => {
    expect(parsePercent('10')).toBe(10);
    expect(parsePercent('12,5')).toBe(12.5);
    expect(parsePercent('12.25 %')).toBe(12.25);
    expect(parsePercent('12,345')).toBeNull();
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('-1')).toBeNull();
    expect(parsePercent('abc')).toBeNull();
  });
});

describe('validateDraft', () => {
  it('accepts what the server sent', () => {
    expect(hasErrors(validateDraft(toDraft(SETTINGS)))).toBe(false);
  });

  it('finds duplicates, a percentage over 100 and a missing činnost', () => {
    const draft = toDraft(SETTINGS);
    draft.tiers[2].min = '6';
    draft.tiers[0].percent = '100,5';
    draft.packages.push({ key: 'x', activityId: '', percent: '3' });
    const errors = validateDraft(draft);
    expect(errors.tiers[draft.tiers[2].key].min).toBe('Tuto hranici už má jiná hladina.');
    expect(errors.tiers[draft.tiers[0].key].percent).toBe('Procento je od 0 do 100.');
    expect(errors.packages.x.activity).toBe('Vyberte činnost.');
  });
});

describe('toPayload and signature', () => {
  it('sorts the tiers ascending and remembers which row each came from', () => {
    const draft = toDraft(SETTINGS);
    draft.tiers.reverse();
    const { settings, keys } = toPayload(draft);
    expect(settings.tiers.map((t) => t.minPersons)).toEqual([4, 6, 10]);
    expect(keys.tiers).toEqual([draft.tiers[2].key, draft.tiers[1].key, draft.tiers[0].key]);
  });

  it('is the same text for the same content, whatever the keys', () => {
    expect(signature(toDraft(SETTINGS))).toBe(signature(toDraft(SETTINGS)));
    const changed = toDraft(SETTINGS);
    changed.tiers[0].percent = '6';
    expect(signature(changed)).not.toBe(signature(toDraft(SETTINGS)));
  });
});

describe('placeServerErrors', () => {
  it('puts each sentence on the row it names, in either case, and the rest in general', () => {
    const keys = { tiers: ['t0', 't1'], packages: ['p0'], roles: ['r0'] };
    const placed = placeServerErrors(
      {
        'tiers[1].minPersons': 'Překrývá se.',
        'Tiers[0].Percent': 'Moc.',
        'packageDiscounts[0].activityId': 'Neexistuje.',
        'roleLimits[0].maxManualPercent': 'Nad strop.',
        tiers: 'Aspoň jedna hladina.',
        'tiers[9].percent': 'Ztracená.',
      },
      keys,
    );
    expect(placed.tiers.t1).toEqual({ min: 'Překrývá se.' });
    expect(placed.tiers.t0).toEqual({ percent: 'Moc.' });
    expect(placed.packages.p0).toEqual({ activity: 'Neexistuje.' });
    expect(placed.roles.r0).toEqual({ percent: 'Nad strop.' });
    expect(placed.general).toEqual(['Aspoň jedna hladina.', 'Ztracená.']);
  });
});

describe('the preview', () => {
  const ranges = tierRanges(toDraft(SETTINGS));

  it('turns tiers into ranges: each runs until the next one starts', () => {
    expect(ranges).toEqual([{ from: 4, to: 5, percent: 5 }, { from: 6, to: 9, percent: 10 }, { from: 10, to: null, percent: 15 }]);
    expect(ranges.map((r) => rangeText(r).replace(/\s/g, ' '))).toEqual(['4–5 osob', '6–9 osob', 'od 10 osob']);
  });

  it('ignores a half-typed or duplicate row', () => {
    const draft = toDraft(SETTINGS);
    draft.tiers.push({ key: 'n', min: '', percent: '' }, { key: 'd', min: '6', percent: '99' });
    expect(tierRanges(draft)).toEqual(ranges);
  });

  it('says what a headcount pays', () => {
    expect(rangeFor(ranges, 6)?.percent).toBe(10);
    expect(rangeFor(ranges, 3)).toBeNull();
    expect(headcountSentence(ranges, 6)).toMatch(/^Pro 6\sosob platí 10\s%\.$/);
    expect(headcountSentence(ranges, 12)).toMatch(/15\s%/);
    expect(headcountSentence(ranges, 3)).toMatch(/neuplatní — první hladina začíná od 4\sosob/);
    expect(headcountSentence([], 3)).toMatch(/Bez hladin/);
  });

  it('opens on the second tier start, the first when there is only one, nothing when there is none', () => {
    expect(initialHeadcount(ranges)).toBe('6');
    expect(initialHeadcount(ranges.slice(0, 1))).toBe('4');
    expect(initialHeadcount([])).toBe('');
  });

  it('prices the example on the dearest činnost on offer', () => {
    const dearest = dearestPriced([
      { name: 'a', priceCzk: 1000, isActive: true },
      { name: 'b', priceCzk: 3000, isActive: false },
      { name: 'c', priceCzk: 2000, isActive: true },
      { name: 'd', priceCzk: null, isActive: true },
    ]);
    expect(dearest?.name).toBe('c');
    expect(exampleLine(ranges[1], 6, 2000)).toEqual({ subtotal: 12000, discount: 1200, total: 10800 });
    expect(exampleLine(null, 3, 2000)).toEqual({ subtotal: 6000, discount: 0, total: 6000 });
  });

  it('writes percentages the Czech way', () => {
    expect(formatPercent(12.5)).toMatch(/^12,5\s%$/);
  });
});

describe('roles', () => {
  it('names the roles the way the clinic says them and keeps a role it does not know', () => {
    expect(roleLabel('Reception')).toBe('Recepce');
    expect(roleLabel('Doctor')).toBe('Lékař');
    expect(roleLabel('Administrator')).toBe('Admin');
    expect(roleLabel('Fyzioterapeut')).toBe('Fyzioterapeut');
    expect(isOwnerRole('Owner')).toBe(true);
    expect(isOwnerRole('Admin')).toBe(false);
  });
});
