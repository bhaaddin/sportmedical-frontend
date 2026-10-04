import { describe, expect, it } from 'vitest';
import { activityNeed, computeCoverage, pickAllowance } from './coverage';
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

  it('pools two činnosti and shares the picked time in proportion to need', () => {
    const list = [
      act({ activityId: 'a', name: 'A', seats: 10, minutesPerSeat: 30 }),
      act({ activityId: 'b', name: 'B', seats: 10, minutesPerSeat: 60, parallelCapacity: 2 }),
    ];
    const c = computeCoverage(list, 300);
    expect(c.neededMinutes).toBe(600);
    expect(c.perActivity[0].neededMinutes).toBe(300);
    expect(c.perActivity[1].neededMinutes).toBe(300);
    expect(c.perActivity[0].coveredSeats).toBe(5);
    expect(c.perActivity[1].coveredSeats).toBe(5);
    expect(c.coveredSeats).toBe(10);
    expect(c.remainingSeats).toBe(10);
    expect(computeCoverage(list, 600).covered).toBe(true);
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

describe('pickAllowance', () => {
  it('allows only what is missing, so painting stops when everybody is covered', () => {
    expect(pickAllowance(computeCoverage([act()], 600), false)).toBe(300);
    expect(pickAllowance(computeCoverage([act()], 900), false)).toBe(0);
  });

  it('allows any amount with the reserve toggle', () => {
    expect(pickAllowance(computeCoverage([act()], 900), true)).toBe(Number.POSITIVE_INFINITY);
  });

  it('allows nothing while there is nothing to cover', () => {
    expect(pickAllowance(computeCoverage([], 0), true)).toBe(0);
  });
});
