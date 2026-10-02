import { describe, expect, it } from 'vitest';
import { nextFreeSlot } from './nextFreeSlot';

const DAY = { start: 8 * 60, end: 16 * 60 };

describe('the next free half hour', () => {
  it('rounds now up to the grid step', () => {
    expect(nextFreeSlot(10 * 60 + 15, 30, [], 30, DAY)).toEqual({ start: 630, end: 660 });
    expect(nextFreeSlot(10 * 60, 30, [], 30, DAY)).toEqual({ start: 600, end: 630 });
    expect(nextFreeSlot(10 * 60 + 1, 15, [], 30, DAY)).toEqual({ start: 615, end: 645 });
  });

  it('skips what is already booked, blocked or lunch', () => {
    const busy = [
      { start: 10 * 60 + 30, end: 11 * 60 },
      { start: 11 * 60, end: 11 * 60 + 20 },
    ];
    expect(nextFreeSlot(10 * 60 + 15, 30, busy, 30, DAY)).toEqual({ start: 690, end: 720 });
  });

  it('starts at opening before the clinic opens and gives up after it closes', () => {
    expect(nextFreeSlot(6 * 60, 30, [], 30, DAY)).toEqual({ start: 480, end: 510 });
    expect(nextFreeSlot(15 * 60 + 45, 30, [], 30, DAY)).toBeNull();
  });
});
