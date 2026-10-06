import { describe, expect, it } from 'vitest';
import { computeAdditionalCoverage, computeCoverage } from './coverage';
import type { CoverageActivity } from './coverage';
import { allowedKey, allowedNames, allowsActivity, firstWord, namesOf, normalizeAllowed, toggleAllowed } from './routing';

const ALL = ['a1', 'a2', 'a3'];
const acts = [
  { activityId: 'a1', name: 'Základní sportovní prohlídka' },
  { activityId: 'a2', name: 'Komplexní sportovní prohlídka' },
  { activityId: 'a3', name: 'Spiroergometrie' },
];

describe('routing helpers (a window allows only some činnosti of its order)', () => {
  it('null / absent / everything / nothing known all read as "all"', () => {
    expect(normalizeAllowed(null, ALL)).toBeNull();
    expect(normalizeAllowed(undefined, ALL)).toBeNull();
    expect(normalizeAllowed(['a1', 'a2', 'a3'], ALL)).toBeNull();
    expect(normalizeAllowed(['zzz'], ALL)).toBeNull();
    expect(normalizeAllowed(['a3'], ALL)).toEqual(['a3']);
    expect(normalizeAllowed(['a3', 'a1', 'x'], ALL)).toEqual(['a1', 'a3']);
    /* an order with one činnost can never be restricted */
    expect(normalizeAllowed(['a1'], ['a1'])).toBeNull();
  });

  it('chips: all on by default, one press takes a činnost out, the last one stays on, pressing again puts it back', () => {
    let allowed = toggleAllowed(null, 'a2', ALL);
    expect(allowed).toEqual(['a1', 'a3']);
    allowed = toggleAllowed(allowed, 'a1', ALL);
    expect(allowed).toEqual(['a3']);
    /* the last one cannot go off */
    expect(toggleAllowed(allowed, 'a3', ALL)).toEqual(['a3']);
    /* back on: two again, then all again -> null */
    allowed = toggleAllowed(allowed, 'a2', ALL);
    expect(allowed).toEqual(['a2', 'a3']);
    expect(toggleAllowed(allowed, 'a1', ALL)).toBeNull();
  });

  it('keys, names and checks', () => {
    expect(allowedKey(null)).toBe('*');
    expect(allowedKey(['a3', 'a1'])).toBe('a1,a3');
    expect(allowsActivity(null, 'a1')).toBe(true);
    expect(allowsActivity(['a3'], 'a1')).toBe(false);
    expect(allowsActivity(['a3'], 'a3')).toBe(true);
    expect(allowedNames(null, acts)).toBeNull();
    expect(allowedNames(['a3'], acts)).toBe('Spiroergometrie');
    expect(allowedNames(['a1', 'a2'], acts, 'short')).toBe('Základní + Komplexní');
    expect(firstWord('Základní sportovní prohlídka')).toBe('Základní');
    expect(namesOf(['a3', 'zzz'], acts)).toEqual(['Spiroergometrie']);
  });
});

const basic: CoverageActivity = { activityId: 'basic', name: 'Základní', seats: 12, minutesPerSeat: 30, parallelCapacity: 1 };
const spiro: CoverageActivity = { activityId: 'spiro', name: 'Spiro', seats: 10, minutesPerSeat: 60, parallelCapacity: 1 };

describe('the calculator respects the činnosti a window allows', () => {
  it('without a restriction the result is exactly the pooled one', () => {
    const plain = computeCoverage([basic, spiro], 330);
    const same = computeCoverage([basic, spiro], 330, [{ minutes: 330, activityIds: null }]);
    expect(same).toEqual(plain);
  });

  it('12 basic + 10 spiro, one spiro-only window of 480 min: spiro has 2 slots left, basic none covered', () => {
    const c = computeCoverage([basic, spiro], 480, [{ minutes: 480, activityIds: ['spiro'] }]);
    const by = Object.fromEntries(c.perActivity.map((a) => [a.activityId, a]));
    expect(by.spiro.coveredSlots).toBe(8);
    expect(by.spiro.remainingSlots).toBe(2);
    expect(by.basic.coveredSlots).toBe(0);
    expect(by.basic.remainingSlots).toBe(12);
    expect(c.covered).toBe(false);
    /* nobody allows the basic exam in any picked window: flagged */
    expect(by.basic.noWindow).toBe(true);
    expect(by.spiro.noWindow).toBe(false);
  });

  it('a spiro-only window of 600 min plus an open window of 360 min covers everything', () => {
    const c = computeCoverage([basic, spiro], 960, [
      { minutes: 600, activityIds: ['spiro'] },
      { minutes: 360, activityIds: null },
    ]);
    expect(c.covered).toBe(true);
    expect(c.remainingSlots).toBe(0);
    expect(c.perActivity.every((a) => !a.noWindow)).toBe(true);
  });

  it('the most restricted window is served first, even when the činnost it allows is listed last', () => {
    /* 360 open + 600 spiro-only: if the open one fed spiro first, 600 spiro-only minutes would be wasted */
    const c = computeCoverage([spiro, basic], 960, [
      { minutes: 360, activityIds: null },
      { minutes: 600, activityIds: ['spiro'] },
    ]);
    expect(c.covered).toBe(true);
  });

  it('a window naming every činnost counts as open', () => {
    const c = computeCoverage([basic, spiro], 330, [{ minutes: 330, activityIds: ['basic', 'spiro'] }]);
    expect(c).toEqual(computeCoverage([basic, spiro], 330));
  });

  it('noWindow is only set once something is picked', () => {
    expect(computeCoverage([basic, spiro], 0, []).perActivity.every((a) => !a.noWindow)).toBe(true);
  });
});

describe('enlarging an order: only the ADDITIONAL need is shown', () => {
  const short: CoverageActivity = { activityId: 'q', name: 'Rychlá', seats: 10, minutesPerSeat: 10, parallelCapacity: 1 };

  it('nobody added = nothing to show', () => {
    expect(computeAdditionalCoverage([short], [short], 100)).toBeNull();
    expect(computeAdditionalCoverage([{ ...short, seats: 8 }], [short], 100)).toBeNull();
  });

  it('7 more players of a 10-minute činnost = 7 slots of 10 min, however long the existing windows are', () => {
    const before = { ...short, seats: 3 };
    const c = computeAdditionalCoverage([short], [before], 30);
    expect(c?.remainingSlots).toBe(7);
    expect(c?.neededMinutes).toBe(70);
    expect(c?.additional).toBe(true);
    /* 70 more minutes painted: done */
    expect(computeAdditionalCoverage([short], [before], 100)?.covered).toBe(true);
    /* a surplus the old windows already had counts towards the new players */
    expect(computeAdditionalCoverage([short], [before], 60)?.remainingSlots).toBe(4);
  });

  it('7 more players of a 60-minute činnost = 7 x 60 min, mixed činnosti each by its own length', () => {
    const c = computeAdditionalCoverage(
      [{ ...basic, seats: 15 }, { ...spiro, seats: 17 }],
      [basic, spiro],
      960,
    );
    expect(c?.neededMinutes).toBe(3 * 30 + 7 * 60);
    expect(c?.remainingSlots).toBe(10);
    expect(c?.perActivity.map((a) => [a.activityId, a.seats, a.remainingSlots])).toEqual([['basic', 3, 3], ['spiro', 7, 7]]);
  });

  it('with a restricted window only what the added players cost is shown (an old shortage stays out of it)', () => {
    const b: CoverageActivity = { activityId: 'basic', name: 'Základní', seats: 4, minutesPerSeat: 40, parallelCapacity: 1 };
    const s: CoverageActivity = { activityId: 'spiro', name: 'Spiro', seats: 2, minutesPerSeat: 60, parallelCapacity: 1 };
    const windows = [{ minutes: 135, activityIds: ['spiro'] }, { minutes: 135, activityIds: ['basic'] }];
    /* the saved order already lacks one basic slot (3 x 40 in 135 min) */
    const c = computeAdditionalCoverage([b, { ...s, seats: 5 }], [b, s], 270, windows);
    expect(c?.remainingSlots).toBe(3);
    expect(c?.perActivity.map((a) => a.activityId)).toEqual(['spiro']);
    expect(c?.covered).toBe(false);
  });
});
