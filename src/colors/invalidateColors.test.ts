/*
 * Reviewer 2.6: a changed colour refreshes every screen that draws a činnost - the reads the board, the club windows, the mini
 * calendar, the lists and the legends are built from are marked stale at once, the unrelated ones are left alone.
 */
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { COLOR_KEYS, invalidateColorCaches } from './invalidateColors';

describe('invalidateColorCaches', () => {
  const client = () => {
    const c = new QueryClient();
    const seed: unknown[][] = [
      ['activities'], ['activities', 'list'], ['clinic-services'], ['club-block-activities'], ['calendars'],
      ['settings', 'service-colors', 'activities'], ['planner', 'api:club:1:abc', 'catalogue'], ['day-range', '2026-12-07'], ['blocks', 'c1'],
      ['patients', 'p1'], ['invoices'], ['public-site'],
    ];
    for (const key of seed) c.setQueryData(key, { key });
    return { c, seed };
  };
  const stale = (c: QueryClient, key: unknown[]) => c.getQueryState(key)!.isInvalidated;

  it('marks the reads that carry a činnost\'s or a služba\'s colour stale', async () => {
    const { c } = client();
    await invalidateColorCaches(c);
    for (const key of [['activities'], ['activities', 'list'], ['clinic-services'], ['club-block-activities'], ['settings', 'service-colors', 'activities'], ['planner', 'api:club:1:abc', 'catalogue'], ['day-range', '2026-12-07'], ['blocks', 'c1']]) {
      expect(stale(c, key), key.join('/')).toBe(true);
    }
  });

  it('leaves what has nothing to do with a colour alone', async () => {
    const { c } = client();
    await invalidateColorCaches(c);
    for (const key of [['patients', 'p1'], ['invoices'], ['public-site']]) expect(stale(c, key), key.join('/')).toBe(false);
  });

  it('names the planner and the activity catalogues among its keys', () => {
    expect(COLOR_KEYS).toEqual(expect.arrayContaining(['activities', 'clinic-services', 'club-block-activities', 'planner']));
  });
});
