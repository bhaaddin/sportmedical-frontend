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

import { nextFreeSlotAcrossDays, type DayFacts } from './nextFreeSlot';

describe('the next free slot across days', () => {
  const open = (busy: DayFacts['busy'] = []): DayFacts => ({ open: true, bounds: DAY, busy });
  const shut: DayFacts = { open: false, bounds: null, busy: [] };

  it('skips a closed Saturday and Sunday and lands on Monday at opening time', () => {
    const facts: Record<string, DayFacts> = {
      '2026-09-26': shut,
      '2026-09-27': shut,
      '2026-09-28': open(),
    };
    expect(nextFreeSlotAcrossDays({ dayKey: '2026-09-26', minute: 10 * 60 + 15 }, 30, (d) => facts[d])).toEqual({
      kind: 'found',
      dayKey: '2026-09-28',
      slot: { start: 480, end: 510 },
    });
  });

  it('stays on today when today still has room, counting from now', () => {
    expect(nextFreeSlotAcrossDays({ dayKey: '2026-09-23', minute: 10 * 60 + 15 }, 30, () => open())).toEqual({
      kind: 'found',
      dayKey: '2026-09-23',
      slot: { start: 630, end: 660 },
    });
  });

  it('goes to the next open day when today is full or over', () => {
    const facts: Record<string, DayFacts> = {
      '2026-09-23': open([{ start: 10 * 60 + 30, end: 16 * 60 }]),
      '2026-09-24': open([{ start: 8 * 60, end: 9 * 60 }]),
    };
    expect(nextFreeSlotAcrossDays({ dayKey: '2026-09-23', minute: 10 * 60 + 15 }, 30, (d) => facts[d])).toEqual({
      kind: 'found',
      dayKey: '2026-09-24',
      slot: { start: 540, end: 570 },
    });
  });

  it('stops at the first day it knows nothing about instead of guessing', () => {
    const facts: Record<string, DayFacts> = { '2026-09-26': shut, '2026-09-27': shut };
    expect(nextFreeSlotAcrossDays({ dayKey: '2026-09-26', minute: 600 }, 30, (d) => facts[d])).toEqual({
      kind: 'unknown',
      dayKey: '2026-09-28',
    });
  });

  it('gives up after the horizon when every known day is shut', () => {
    expect(nextFreeSlotAcrossDays({ dayKey: '2026-09-26', minute: 600 }, 30, () => shut, 30, 5)).toEqual({ kind: 'none' });
  });
});
