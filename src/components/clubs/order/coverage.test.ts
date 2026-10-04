import { describe, expect, it } from 'vitest';
import { activityNeed, computeCoverage } from './coverage';
import type { CoverageActivity } from './coverage';

const act = (over: Partial<CoverageActivity> = {}): CoverageActivity => ({
  activityId: 'a', name: 'Test', seats: 30, minutesPerSeat: 30, parallelCapacity: 1, ...over,
});

describe('computeCoverage', () => {
  it('30 players x 30 minutes need 900 minutes', () => {
    const c = computeCoverage([act()], 0);
    expect(c.neededMinutes).toBe(900);
    expect(c.remainingMinutes).toBe(900);
    expect(c.remainingSeats).toBe(30);
    expect(c.covered).toBe(false);
    expect(c.percent).toBe(0);
  });

  it('counts the covered players as time is picked', () => {
    const c = computeCoverage([act()], 300);
    expect(c.pickedMinutes).toBe(300);
    expect(c.remainingMinutes).toBe(600);
    expect(c.coveredSeats).toBe(10);
    expect(c.remainingSeats).toBe(20);
    expect(c.percent).toBe(33);
  });

  it('a partly covered player is not a covered player', () => {
    const c = computeCoverage([act()], 899);
    expect(c.coveredSeats).toBe(29);
    expect(c.remainingSeats).toBe(1);
    expect(c.remainingMinutes).toBe(1);
    expect(c.covered).toBe(false);
  });

  it('is covered exactly when the picked time reaches the need', () => {
    const c = computeCoverage([act()], 900);
    expect(c.covered).toBe(true);
    expect(c.remainingSeats).toBe(0);
    expect(c.remainingMinutes).toBe(0);
    expect(c.surplusMinutes).toBe(0);
    expect(c.percent).toBe(100);
  });

  it('divides by the parallel capacity', () => {
    const a = act({ parallelCapacity: 3 });
    expect(activityNeed(a)).toBe(300);
    const c = computeCoverage([a], 150);
    expect(c.neededMinutes).toBe(300);
    expect(c.coveredSeats).toBe(15);
  });

  it('rounds the total need up to a whole minute', () => {
    const c = computeCoverage([act({ seats: 5, minutesPerSeat: 20, parallelCapacity: 3 })], 0);
    expect(c.neededMinutes).toBe(34);
  });

  it('hands the picked time to the činnosti in the order listed (slots of one visit each)', () => {
    const list = [
      act({ activityId: 'a', name: 'Základní', seats: 12, minutesPerSeat: 30 }),
      act({ activityId: 'b', name: 'Komplexní', seats: 10, minutesPerSeat: 60 }),
    ];
    const none = computeCoverage(list, 0);
    expect(none.neededMinutes).toBe(960);
    expect(none.neededSlots).toBe(22);
    expect(none.remainingSlots).toBe(22);
    const some = computeCoverage(list, 330);
    expect(some.perActivity[0].coveredSlots).toBe(11);
    expect(some.perActivity[0].remainingSlots).toBe(1);
    expect(some.perActivity[1].coveredSlots).toBe(0);
    expect(some.remainingSlots).toBe(11);
    const more = computeCoverage(list, 360 + 120);
    expect(more.perActivity[0].remainingSlots).toBe(0);
    expect(more.perActivity[1].coveredSlots).toBe(2);
    expect(more.remainingSlots).toBe(8);
    expect(more.remainingSeats).toBe(8);
    const all = computeCoverage(list, 960);
    expect(all.covered).toBe(true);
    expect(all.remainingSlots).toBe(0);
    expect(all.coveredSlots).toBe(22);
  });

  it('a rest shorter than the next slot stays unspent and the slots fall one by one', () => {
    const list = [act({ activityId: 'a', seats: 4, minutesPerSeat: 30 }), act({ activityId: 'b', seats: 2, minutesPerSeat: 60 })];
    const c = computeCoverage(list, 45);
    expect(c.perActivity[0].coveredSlots).toBe(1);
    expect(c.perActivity[1].coveredSlots).toBe(0);
    expect(c.remainingSlots).toBe(5);
    expect(computeCoverage(list, 120).remainingSlots).toBe(2);
  });

  it('a slot of a činnost with parallel capacity carries that many players', () => {
    const a = act({ seats: 5, minutesPerSeat: 30, parallelCapacity: 2 });
    expect(computeCoverage([a], 0).neededSlots).toBe(3);
    expect(computeCoverage([a], 75).covered).toBe(true);
    expect(computeCoverage([a], 75).remainingSlots).toBe(0);
  });

  it('tracks the surplus past the need', () => {
    const c = computeCoverage([act()], 960);
    expect(c.surplusMinutes).toBe(60);
    expect(c.remainingMinutes).toBe(0);
    expect(c.covered).toBe(true);
    expect(c.percent).toBe(100);
  });

  it('nothing to cover is never covered', () => {
    const c = computeCoverage([], 100);
    expect(c.covered).toBe(false);
    expect(c.neededMinutes).toBe(0);
    expect(computeCoverage([act({ seats: 0 })], 100).covered).toBe(false);
  });

  it('treats a missing parallel capacity as 1', () => {
    expect(activityNeed(act({ parallelCapacity: 0 }))).toBe(900);
  });
});

