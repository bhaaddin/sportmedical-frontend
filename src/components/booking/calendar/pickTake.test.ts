import { describe, expect, it } from 'vitest';
import type { CoverageActivity } from '../../clubs/order/coverage';
import type { FreeBlock } from './pickDays';
import { subtractRanges, takeNeeded, type TakeState } from './pickTake';

const act = (activityId: string, seats: number, minutesPerSeat: number, parallelCapacity = 1): CoverageActivity => ({
  activityId, name: activityId.toUpperCase(), seats, minutesPerSeat, parallelCapacity,
});
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const day = (from = h(8), to = h(15, 30), calendarId = 'c1'): FreeBlock[] => [{ calendarId, range: { start: from, end: to } }]; // 450 min
/* A picked window of `minutes` (at the start of a day), for the činnosti given (all when absent). */
const win = (minutes: number, activityIds?: string[]): TakeState['windows'][number] => ({ range: { start: 0, end: minutes }, activityIds: activityIds ?? null });
const state = (activities: CoverageActivity[], _pickedMinutes = 0, windows: { minutes: number; activityIds?: string[] }[] = []): TakeState => ({
  activities,
  windows: windows.map((w) => win(w.minutes, w.activityIds)),
});

describe('takeNeeded - the one-tap shortcut takes only the missing time', () => {
  it('three days of 450 min for a 1 020 min need: 450 + 450 + 120 (the last one trimmed to a whole slot)', () => {
    const a = [act('a', 34, 30)]; // 34 x 30 = 1 020
    const first = takeNeeded(state(a), day());
    expect(first).toMatchObject({ minutes: 450, trimmed: false, covered: false });
    const second = takeNeeded(state(a, 450, [{ minutes: 450 }]), day());
    expect(second).toMatchObject({ minutes: 450, trimmed: false });
    const third = takeNeeded(state(a, 900, [{ minutes: 450 }, { minutes: 450 }]), day());
    expect(third.minutes).toBe(120);
    expect(third.trimmed).toBe(true);
    expect(third.blocks).toEqual([{ calendarId: 'c1', range: { start: h(8), end: h(10) } }]);
    /* ...and with that the order is done - nothing is left to add. */
    expect(takeNeeded(state(a, 1020, [{ minutes: 450 }, { minutes: 450 }, { minutes: 120 }]), day())).toMatchObject({ covered: true, minutes: 0, blocks: [] });
  });

  it('mixed lengths round up to the shortest slot that still misses', () => {
    /* 20 min x 1 + 45 min x 1 = 65 min; the shortest missing slot is 20, so 80 min are taken, not 65. */
    const a = [act('a', 1, 20), act('b', 1, 45)];
    expect(takeNeeded(state(a), day()).minutes).toBe(80);
    /* The 20-minute činnost is covered: only the 45-minute slot is missing now, and exactly 45 min are taken. */
    expect(takeNeeded(state(a, 20, [{ minutes: 20 }]), day()).minutes).toBe(45);
    /* A 10-minute and a 60-minute činnost: 6 x 10 + 2 x 60 = 180, a multiple of both. */
    expect(takeNeeded(state([act('a', 6, 10), act('b', 2, 60)]), day()).minutes).toBe(180);
  });

  it('a need that is already covered adds nothing', () => {
    const r = takeNeeded(state([act('a', 10, 30)], 300, [{ minutes: 300 }]), day());
    expect(r).toMatchObject({ covered: true, minutes: 0, blocks: [] });
  });

  it('a surplus picked by hand also means covered: nothing is added behind it', () => {
    expect(takeNeeded(state([act('a', 10, 30)], 600, [{ minutes: 600 }]), day()).covered).toBe(true);
  });

  it('takes everything when the free time is shorter than the need', () => {
    const r = takeNeeded(state([act('a', 34, 30)]), day(h(8), h(9, 40)));
    expect(r).toMatchObject({ minutes: 100, trimmed: false, covered: false });
    expect(r.blocks[0].range).toEqual({ start: h(8), end: h(9, 40) });
  });

  it('a need that is exactly the day (the 30 Oct case) books the whole day', () => {
    const r = takeNeeded(state([act('a', 15, 30)]), day()); // 450 = the whole day
    expect(r).toMatchObject({ minutes: 450, trimmed: false });
    expect(takeNeeded(state([act('a', 28, 30)]), day())).toMatchObject({ minutes: 450, trimmed: false }); // 840 > the day
  });

  it('never crosses a break: the take continues into the next free block, early to late', () => {
    const blocks: FreeBlock[] = [
      { calendarId: 'c1', range: { start: h(8), end: h(12) } },
      { calendarId: 'c1', range: { start: h(12, 30), end: h(16) } },
    ];
    const long = takeNeeded(state([act('a', 14, 30)]), blocks); // 420 min: 240 + 180
    expect(long.blocks).toEqual([
      { calendarId: 'c1', range: { start: h(8), end: h(12) } },
      { calendarId: 'c1', range: { start: h(12, 30), end: h(15, 30) } },
    ]);
    const short = takeNeeded(state([act('a', 6, 30)]), blocks); // 180 min, all in the morning
    expect(short.blocks).toEqual([{ calendarId: 'c1', range: { start: h(8), end: h(11) } }]);
    expect(short.trimmed).toBe(true);
  });

  it('respects the činnosti a picked window is restricted to', () => {
    /* A: 2 x 30, B: 2 x 60. A 200 min window allows only A: it covers A (60 min) and the rest is wasted on A. */
    const a = [act('a', 2, 30), act('b', 2, 60)];
    const windows = [{ minutes: 200, activityIds: ['a'] }];
    /* Naively 180 - 200 < 0 would say "covered"; the restricted window gives B nothing, so 120 min for B are missing. */
    const r = takeNeeded(state(a, 200, windows), day());
    expect(r.covered).toBe(false);
    expect(r.minutes).toBe(120);
    /* Without the restriction the same 200 minutes would cover everything. */
    expect(takeNeeded(state(a, 200, [{ minutes: 200 }]), day()).covered).toBe(true);
  });

  it('enlarging an order: only what the added players cost is missing', () => {
    const baseline = [act('a', 10, 30)];
    const grown = [act('a', 14, 30)]; // 4 more players = 120 min on top of the saved 300
    const r = takeNeeded({ activities: grown, baseline, windows: [win(300)] }, day());
    expect(r.minutes).toBe(120);
    expect(r.trimmed).toBe(true);
  });

  it('with no players (no known need) the blocks are taken whole, as before', () => {
    const r = takeNeeded(state([act('a', 0, 30)]), day());
    expect(r).toMatchObject({ minutes: 450, trimmed: false, covered: false });
  });
});

describe('subtractRanges', () => {
  it('cuts picks out of a block', () => {
    expect(subtractRanges({ start: 480, end: 960 }, [{ start: 480, end: 600 }])).toEqual([{ start: 600, end: 960 }]);
    expect(subtractRanges({ start: 480, end: 960 }, [{ start: 600, end: 660 }])).toEqual([{ start: 480, end: 600 }, { start: 660, end: 960 }]);
    expect(subtractRanges({ start: 480, end: 960 }, [{ start: 0, end: 1000 }])).toEqual([]);
    expect(subtractRanges({ start: 480, end: 960 }, [{ start: 1000, end: 1100 }])).toEqual([{ start: 480, end: 960 }]);
  });
});
