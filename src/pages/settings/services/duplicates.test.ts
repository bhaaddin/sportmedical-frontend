import { describe, it, expect } from 'vitest';
import { findDuplicateGroups, normalizeName } from './duplicates';
import { usageLine } from './DeleteFlow';

const item = (id: string, name: string, svc = 's1') => ({ id, name, isActive: true, svc });

describe('normalizeName', () => {
  it('ignores case, diacritics, punctuation and word order', () => {
    expect(normalizeName('Základní sportovní prohlídka')).toBe(normalizeName('sportovní PROHLÍDKA, základní'));
    expect(normalizeName('  ')).toBe('');
  });
});

describe('findDuplicateGroups', () => {
  it('groups reordered and de-accented names, leaves unique ones out', () => {
    const groups = findDuplicateGroups([
      item('1', 'Základní sportovní prohlídka'),
      item('2', 'Sportovní prohlídka základní'),
      item('3', 'zakladni sportovni prohlidka'),
      item('4', 'Spiroergometrie'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('with a scope, the same name in two služby is not a duplicate', () => {
    const items = [item('1', 'Prohlídka', 's1'), item('2', 'Prohlídka', 's2'), item('3', 'prohlidka', 's1')];
    const groups = findDuplicateGroups(items, (i) => i.svc);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(['1', '3']);
  });
});

describe('usageLine', () => {
  it('hides zero counts and inflects Czech plurals', () => {
    expect(usageLine({ appointments: 12, clubOrders: 3, clubBlocks: 0, priceItems: 1, calendars: 2, activities: 0 }))
      .toBe('12 objednávek, 3 klubové objednávky, 1 položka ceníku, 2 kalendáře');
  });
});
