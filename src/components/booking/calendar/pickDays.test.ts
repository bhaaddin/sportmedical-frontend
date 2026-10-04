import { describe, expect, it } from 'vitest';
import type { Calendar, PreviewDay } from '../../../api/bookingContracts';
import { ceilToStep, firstBookableDay, formatFree, freeBlocksOfCalendar, freeBlocksOfDay, minutesOfBlocks } from './pickDays';
import { withPastTime } from './pickLogic';
import type { PickedRange } from './multiSelect';

const row = (over: Partial<NonNullable<Parameters<typeof freeBlocksOfCalendar>[0]['row']>> = {}) => ({
  isOpen: true, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00', ...over,
});
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const base = { dayKey: '2026-09-24', appointments: [], blocks: [], picks: [], today: '2026-09-23', nowMinute: h(10), minLength: 30 };

describe('freeBlocksOfCalendar', () => {
  it('is the working time without the break', () => {
    expect(freeBlocksOfCalendar({ ...base, row: row() })).toEqual([{ start: h(8), end: h(12) }, { start: h(12, 30), end: h(16) }]);
  });

  it('leaves out bookings and blocks, and cancelled bookings do not count', () => {
    const free = freeBlocksOfCalendar({
      ...base,
      row: row({ breakStart: null, breakEnd: null }),
      appointments: [
        { startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T08:00:00Z', status: 0 }, // 09:00-10:00 Prague
        { startUtc: '2026-09-24T09:00:00Z', endUtc: '2026-09-24T10:00:00Z', status: 4 }, // cancelled
      ],
      blocks: [{ startUtc: '2026-09-24T11:00:00Z', endUtc: '2026-09-24T12:00:00Z' }], // 13:00-14:00
    });
    expect(free.every((r) => r.end - r.start >= 30)).toBe(true);
    expect(free).toEqual([{ start: h(8), end: h(9) }, { start: h(10), end: h(13) }, { start: h(14), end: h(16) }]);
  });

  it('a closed or unknown day has nothing, and a past day too', () => {
    expect(freeBlocksOfCalendar({ ...base, row: row({ isOpen: false }) })).toEqual([]);
    expect(freeBlocksOfCalendar({ ...base })).toEqual([]);
    expect(freeBlocksOfCalendar({ ...base, row: row(), dayKey: '2026-09-22' })).toEqual([]);
  });

  it('today is closed up to the current minute', () => {
    const free = freeBlocksOfCalendar({ ...base, dayKey: '2026-09-23', row: row(), nowMinute: h(10, 15) });
    expect(free[0]).toEqual({ start: h(10, 30), end: h(12) });
    expect(freeBlocksOfCalendar({ ...base, dayKey: '2026-09-23', row: row(), nowMinute: h(17) })).toEqual([]);
  });

  it('drops gaps shorter than the step', () => {
    const free = freeBlocksOfCalendar({
      ...base,
      row: row({ breakStart: null, breakEnd: null }),
      appointments: [{ startUtc: '2026-09-24T06:15:00Z', endUtc: '2026-09-24T14:00:00Z', status: 0 }], // 08:15-16:00
    });
    expect(free).toEqual([]);
  });
});

describe('firstBookableDay', () => {
  it('names the first day with free time, or null', () => {
    const free = (d: string) => (d >= '2026-09-26' ? 120 : 0);
    expect(firstBookableDay('2026-09-23', 14, free)).toBe('2026-09-26');
    expect(firstBookableDay('2026-09-23', 2, free)).toBeNull();
  });
});

describe('freeBlocksOfDay', () => {
  const cal = { id: 'c1', displayStepMinutes: 30 } as Calendar;
  const preview = new Map<string, Map<string, PreviewDay>>([
    ['c1', new Map([['2026-09-24', { date: '2026-09-24', isOpen: true, startTime: '08:00:00', endTime: '12:00:00', breakStart: null, breakEnd: null } as PreviewDay]])],
  ]);
  const data = { calendars: [cal], previewByCalendar: preview, appointmentsByDay: new Map(), blocksByCalendar: new Map(), picks: [] as PickedRange[], today: '2026-09-23', nowMinute: 0 };

  it('picks already made count as taken, so a day cannot be picked twice', () => {
    expect(minutesOfBlocks(freeBlocksOfDay('2026-09-24', data))).toBe(240);
    const picks: PickedRange[] = [{ id: 'p', kind: 'time', columnKey: 'c1', calendarId: 'c1', activityId: null, dayKey: '2026-09-24', range: { start: h(8), end: h(10) } }];
    expect(freeBlocksOfDay('2026-09-24', { ...data, picks })).toEqual([{ calendarId: 'c1', range: { start: h(10), end: h(12) } }]);
  });
});

describe('small helpers', () => {
  it('withPastTime merges the gone time into the taken intervals', () => {
    expect(withPastTime([{ start: h(9), end: h(10) }], h(9, 30))).toEqual([{ start: 0, end: h(10) }]);
    expect(withPastTime([{ start: h(12), end: h(13) }], 0)).toEqual([{ start: h(12), end: h(13) }]);
  });
  it('formats free time and rounds up to a step', () => {
    expect(formatFree(300)).toBe('5 h');
    expect(formatFree(90)).toBe('1 h 30 min');
    expect(formatFree(45)).toBe('45 min');
    expect(ceilToStep(h(10, 15), 30)).toBe(h(10, 30));
  });
});
