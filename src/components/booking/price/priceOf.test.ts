import { describe, expect, it } from 'vitest';
import { normalizeName, priceFor, priceOf } from './priceOf';
import fixture from '../../../../tests/fixtures/website-prices.json';
import { comparePrices, flattenPriceList } from '../../../../scripts/check-prices-lib.mjs';

const items = [
  { id: 'i1', name: 'Základní sportovní prohlídka', priceCzk: 1600, isActive: true },
  { id: 'i2', name: 'Základní diagnostika', priceCzk: 1200, isActive: true },
  { id: 'i3', name: 'Základní diagnostika', priceCzk: 999, isActive: false },
  { id: 'i4', name: 'VO₂max analýza', priceCzk: 3500, isActive: true },
];

describe('priceOf (R8) - the one answer to "what does this činnost cost"', () => {
  it('keeps the figure the server read through the link', () => {
    expect(priceOf({ name: 'x', priceCzk: 2200, serviceItemId: 'i1' }, items)).toBe(2200);
    expect(priceFor({ name: 'x', priceCzk: 0 }, items)).toEqual({ priceCzk: 0, via: 'own' });
  });

  it('follows the link to the priced item when the figure is missing', () => {
    expect(priceFor({ name: 'Cokoli', priceCzk: null, serviceItemId: 'i1' }, items)).toEqual({ priceCzk: 1600, via: 'link' });
  });

  it('follows the name when the činnost was never linked (the live case)', () => {
    expect(priceFor({ name: 'Základní sportovní prohlídka', priceCzk: null, serviceItemId: null }, items)).toEqual({ priceCzk: 1600, via: 'name' });
    expect(priceOf({ name: 'zakladni SPORTOVNI prohlidka' }, items)).toBe(1600);
    expect(priceOf({ name: 'VO2max analýza' }, items)).toBe(3500);
  });

  it('prefers an active item when two carry the name', () => {
    expect(priceOf({ name: 'Základní diagnostika' }, items)).toBe(1200);
  });

  it('is null only when the price list truly has no figure', () => {
    expect(priceOf({ name: 'Něco jiného', priceCzk: null }, items)).toBeNull();
    expect(priceOf({ name: 'Základní sportovní prohlídka', serviceItemId: 'gone' }, [{ id: 'i9', name: 'Jiná', priceCzk: 1 }])).toBeNull();
    expect(priceOf({ name: 'Základní sportovní prohlídka' })).toBeNull();
    expect(priceOf({ name: '', priceCzk: null }, items)).toBeNull();
  });

  it('normalises accents, case and punctuation', () => {
    expect(normalizeName('  Komplexní  Diagnostika + VO₂max ')).toBe(normalizeName('komplexni diagnostika + vo2max'));
  });
});

describe('website price fixture (R8)', () => {
  const ours = [
    ['Základní sportovní prohlídka', 1600], ['Komplexní sportovní prohlídka', 2200], ['Spiroergometrické vyšetření', 4000],
    ['Základní diagnostika', 1200], ['Komplexní diagnostika', 2000], ['Komplexní diagnostika + VO₂max analýza', 5000], ['VO₂max analýza', 3500],
    ['Individuální videoinstruovaný kompenzační plán', 1000], ['Základní InBody měření', 500], ['InBody komplexní měření + odborná konzultace', 1200],
    ['Sestavení personalizovaného výživového plánu', 2500], ['Zvýhodněný balíček 5 měření InBody (základní)', 2000], ['Spiroergometrie + Základní diagnostika', 4800],
  ].map(([name, priceCzk]) => ({ name: name as string, priceCzk: priceCzk as number }));

  it('lists the 12 website prices from the owner (1 600 ... 5 000)', () => {
    expect(fixture.items).toHaveLength(12);
    expect(fixture.items.map((i) => i.priceCzk).sort((a, b) => a - b)).toEqual([500, 1000, 1200, 1200, 1600, 2000, 2000, 2200, 2500, 3500, 4000, 5000]);
  });

  it('is equal to a list that carries the same prices; combination packages are only reported', () => {
    const result = comparePrices(ours, fixture);
    expect(result.ok).toBe(true);
    expect(result.extra).toEqual(['Spiroergometrie + Základní diagnostika']);
  });

  it('names a different price and a missing item', () => {
    const drifted = ours.filter((i) => i.name !== 'VO₂max analýza').map((i) => (i.name === 'Komplexní diagnostika + VO₂max analýza' ? { ...i, priceCzk: 5500 } : i));
    const result = comparePrices(drifted, fixture);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual([{ item: 'Komplexní diagnostika + Vo2max', ours: 5500, website: 5000 }]);
    expect(result.missing).toEqual(['Vo2max']);
  });

  it('reads the public list shape (category > items)', () => {
    expect(flattenPriceList([{ category: 'A', items: [{ name: 'X', priceCzk: 10 }, { name: 'Y', priceCzk: null }] }])).toEqual([{ name: 'X', priceCzk: 10 }, { name: 'Y', priceCzk: null }]);
  });
});
