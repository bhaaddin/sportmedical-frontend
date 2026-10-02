import { describe, it, expect } from 'vitest';
import {
  dearestPriced,
  discountPreview,
  sampleHeadcount,
  tierIndexFor,
  tierName,
} from './groupDiscountPreview';

const TIERS = [
  { minHeadcount: 5, maxHeadcount: 9, percent: 5 },
  { minHeadcount: 10, maxHeadcount: 19, percent: 10 },
  { minHeadcount: 20, maxHeadcount: null, percent: 20 },
];

describe('which tier a group falls into', () => {
  it('finds the band by headcount, inclusive at both ends', () => {
    expect(tierIndexFor(TIERS, 5)).toBe(0);
    expect(tierIndexFor(TIERS, 9)).toBe(0);
    expect(tierIndexFor(TIERS, 10)).toBe(1);
    expect(tierIndexFor(TIERS, 19)).toBe(1);
  });

  it('treats an empty upper bound as open-ended', () => {
    expect(tierIndexFor(TIERS, 20)).toBe(2);
    expect(tierIndexFor(TIERS, 500)).toBe(2);
  });

  it('answers -1 below the first band and in a gap', () => {
    expect(tierIndexFor(TIERS, 1)).toBe(-1);
    expect(tierIndexFor([{ minHeadcount: 5, maxHeadcount: 9, percent: 5 }, { minHeadcount: 12, maxHeadcount: null, percent: 10 }], 10)).toBe(-1);
  });
});

describe('the sample order', () => {
  it('is twelve people, as on the board, when a tier reaches twelve', () => {
    expect(sampleHeadcount(TIERS)).toBe(12);
  });

  it('moves to the first tier when none reaches twelve, so a discount is shown', () => {
    expect(sampleHeadcount([{ minHeadcount: 20, maxHeadcount: null, percent: 20 }])).toBe(20);
  });

  it('stays at twelve with no tiers at all', () => {
    expect(sampleHeadcount([])).toBe(12);
  });

  it('comes to the subtotal less the tier, rounded to the crown', () => {
    const p = discountPreview(TIERS, 2200, 12);
    expect(p).toMatchObject({ subtotal: 26_400, tierIndex: 1, percent: 10, discount: 2_640, total: 23_760 });
    expect(discountPreview(TIERS, 333, 5).discount).toBe(83);
  });

  it('takes nothing off when no tier applies', () => {
    expect(discountPreview(TIERS, 2200, 2)).toMatchObject({ tierIndex: -1, percent: 0, discount: 0, total: 4_400 });
  });
});

describe('what the sample is priced on', () => {
  it('is the dearest active činnost that has a price', () => {
    const dearest = dearestPriced([
      { name: 'Základní', priceCzk: 1600, isActive: true },
      { name: 'Komplexní', priceCzk: 2200, isActive: true },
      { name: 'Retired', priceCzk: 9000, isActive: false },
      { name: 'Unpriced', priceCzk: null, isActive: true },
    ]);
    expect(dearest?.name).toBe('Komplexní');
  });

  it('is nothing when no činnost carries a price', () => {
    expect(dearestPriced([{ name: 'Unpriced', priceCzk: null, isActive: true }])).toBeNull();
  });

  /* The API has no tier names; the screen must not invent "Malá skupina". */
  it('calls a tier by its place, not by a name nobody typed', () => {
    expect(tierName(0)).toBe('Hladina 1');
    expect(tierName(2)).toBe('Hladina 3');
  });
});
