import { describe, expect, it } from 'vitest';
import { ALL_FILTER, inFilter, normalizeFilter, plannerServices, serviceKey, usesServiceFilter } from './services';
import type { PlannerCategory } from './types';

const cat = (id: string, serviceId: string | null, serviceName: string, priceCzk: number | null = null): PlannerCategory => ({
  id, name: id, iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, priceCzk, ...(serviceId ? { serviceId, serviceName } : {}),
});
const categories: PlannerCategory[] = [
  cat('base', 's1', 'Sportovní lékařské prohlídky', 1600),
  cat('full', 's1', 'Sportovní lékařské prohlídky', 2200),
  cat('spiro', 's1', 'Sportovní lékařské prohlídky', 4000),
  cat('diag', 's2', 'Sportovní diagnostika', 1200),
  cat('twin', 's1b', 'sportovni lekarske prohlidky', 1600),
  cat('loose', null, ''),
];

describe('plannerServices (R1)', () => {
  it('lists each služba once, with all its činnosti and the price range; činnosti without a služba are not listed', () => {
    const list = plannerServices(categories);
    expect(list.map((s) => [s.id, s.name, s.categoryIds.join(',')])).toEqual([
      ['s1', 'Sportovní lékařské prohlídky', 'base,full,spiro,twin'],
      ['s2', 'Sportovní diagnostika', 'diag'],
    ]);
    expect([list[0]!.minCzk, list[0]!.maxCzk]).toEqual([1600, 4000]);
    expect([list[1]!.minCzk, list[1]!.maxCzk]).toEqual([1200, 1200]);
  });

  it('a služba whose činnosti have no price has none', () => {
    const only = plannerServices([cat('x', 's9', 'Bez ceníku')]);
    expect([only[0]!.minCzk, only[0]!.maxCzk]).toEqual([null, null]);
  });

  it('keys ignore accents, case and punctuation', () => {
    expect(serviceKey('Sportovní  lékařské-prohlídky')).toBe(serviceKey('sportovni lekarske prohlidky'));
  });
});

describe('inFilter / normalizeFilter (R1)', () => {
  it('"all" shows everything; a služba shows every činnost of it (also of its twin); another služba shows none of them', () => {
    expect(categories.every((c) => inFilter(categories, ALL_FILTER, c.id))).toBe(true);
    for (const id of ['base', 'full', 'spiro', 'twin']) expect(inFilter(categories, 's1', id)).toBe(true);
    expect(inFilter(categories, 's1', 'diag')).toBe(false);
    expect(inFilter(categories, 's2', 'diag')).toBe(true);
    expect(inFilter(categories, 's2', 'base')).toBe(false);
  });

  it('a činnost id still filters exactly that činnost (the club board), a stale id filters nothing', () => {
    expect(inFilter(categories, 'full', 'full')).toBe(true);
    expect(inFilter(categories, 'full', 'base')).toBe(false);
    expect(inFilter(categories, 'gone', 'base')).toBe(true);
  });

  it('a saved value that is no služba becomes "all"', () => {
    expect(normalizeFilter('s2', categories)).toBe('s2');
    expect(normalizeFilter('full', categories)).toBe('all');
    expect(normalizeFilter('gone', categories)).toBe('all');
    expect(normalizeFilter('', categories)).toBe('all');
    expect(normalizeFilter(null, categories)).toBe('all');
    expect(normalizeFilter(undefined, categories)).toBe('all');
  });
});

describe('usesServiceFilter (R1)', () => {
  it('the main planner filters by služba, a club board by činnost, and a catalogue without any služba keeps the činnost list', () => {
    expect(usesServiceFilter(categories, false)).toBe(true);
    expect(usesServiceFilter(categories, true)).toBe(false);
    expect(usesServiceFilter([cat('x', null, ''), cat('y', null, '')], false)).toBe(false);
  });
});
