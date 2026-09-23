import { describe, expect, it } from 'vitest';
import {
  dragRange,
  formatMinutes,
  localDateTime,
  parseTimeOfDay,
  pragueMinuteOfDay,
  rangeLabel,
  rangeToInstants,
  spanOnDay,
  touchesDay,
  visibleHours,
} from './timeRange';

const DAY = { start: 7 * 60, end: 19 * 60 };

describe('wall-clock minutes', () => {
  it('reads an instant as Prague wall-clock time, summer and winter', () => {
    expect(pragueMinuteOfDay('2026-09-23T06:30:00Z')).toBe(8 * 60 + 30); // CEST, +2
    expect(pragueMinuteOfDay('2026-12-01T07:15:00Z')).toBe(8 * 60 + 15); // CET, +1
  });

  it('is the label on the row on the day the clocks go back', () => {
    /* 08:00 on 25. 10. 2026 is nine elapsed hours after midnight, and the row says 08:00. */
    expect(pragueMinuteOfDay('2026-10-25T07:00:00Z')).toBe(8 * 60);
  });

  it('formats and parses', () => {
    expect(formatMinutes(8 * 60 + 5)).toBe('08:05');
    expect(formatMinutes(24 * 60)).toBe('24:00');
    expect(parseTimeOfDay('07:30:00')).toBe(450);
    expect(parseTimeOfDay('7:30')).toBe(450);
    expect(parseTimeOfDay(null)).toBeNull();
    expect(parseTimeOfDay('later')).toBeNull();
  });
});

describe('dragRange', () => {
  it('covers the slot it started in and the slot the pointer is in', () => {
    expect(dragRange(8 * 60 + 10, 9 * 60 + 40, 30, DAY)).toEqual({ start: 480, end: 600 });
  });

  it('works dragged upwards too', () => {
    expect(dragRange(9 * 60 + 40, 8 * 60 + 10, 30, DAY)).toEqual({ start: 480, end: 600 });
  });

  it('is one slot for a click without movement', () => {
    expect(dragRange(8 * 60 + 10, 8 * 60 + 10, 30, DAY)).toEqual({ start: 480, end: 510 });
    expect(dragRange(8 * 60 + 10, 8 * 60 + 10, 15, DAY)).toEqual({ start: 480, end: 495 });
  });

  it('stops at the edges of what the grid draws', () => {
    expect(dragRange(18 * 60 + 40, 23 * 60, 30, DAY)).toEqual({ start: 1110, end: 1140 });
    expect(dragRange(7 * 60 + 20, 2 * 60, 30, DAY)).toEqual({ start: 420, end: 450 });
  });

  it('falls back to half-hour slots when the calendar has no step', () => {
    expect(dragRange(8 * 60, 8 * 60, 0, DAY)).toEqual({ start: 480, end: 510 });
  });

  it('labels the range the way the owner asked', () => {
    expect(rangeLabel({ start: 480, end: 570 })).toBe('od 08:00 – do 09:30');
  });
});

describe('from the grid to the booking and the block', () => {
  it('writes clinic local time for the booking dialog', () => {
    expect(localDateTime('2026-09-23', 8 * 60 + 30)).toBe('2026-09-23T08:30');
    expect(localDateTime('2026-12-31', 24 * 60)).toBe('2027-01-01T00:00');
  });

  it('turns a range into the right instants, clock change included', () => {
    const summer = rangeToInstants('2026-09-23', { start: 480, end: 540 });
    expect(summer.startUtc.toISOString()).toBe('2026-09-23T06:00:00.000Z');
    expect(summer.endUtc.toISOString()).toBe('2026-09-23T07:00:00.000Z');

    const changeDay = rangeToInstants('2026-10-25', { start: 13 * 60, end: 14 * 60 });
    expect(changeDay.startUtc.toISOString()).toBe('2026-10-25T12:00:00.000Z');
    expect(changeDay.endUtc.toISOString()).toBe('2026-10-25T13:00:00.000Z');
  });
});

describe('placing things on a day', () => {
  it('cuts a range that crosses midnight to the day', () => {
    expect(spanOnDay('2026-09-23T06:00:00Z', '2026-09-23T07:00:00Z', '2026-09-23')).toEqual({
      start: 480,
      end: 540,
    });
    expect(spanOnDay('2026-09-22T20:00:00Z', '2026-09-23T07:00:00Z', '2026-09-23')).toEqual({
      start: 0,
      end: 540,
    });
    expect(spanOnDay('2026-09-23T20:00:00Z', '2026-09-24T07:00:00Z', '2026-09-23')).toEqual({
      start: 22 * 60,
      end: 24 * 60,
    });
  });

  it('knows which days a range touches', () => {
    expect(touchesDay('2026-09-23T06:00:00Z', '2026-09-23T07:00:00Z', '2026-09-23')).toBe(true);
    expect(touchesDay('2026-09-23T06:00:00Z', '2026-09-23T07:00:00Z', '2026-09-24')).toBe(false);
    expect(touchesDay('2026-09-22T06:00:00Z', '2026-09-24T07:00:00Z', '2026-09-23')).toBe(true);
    /* Ends exactly at midnight Prague: the next day is not touched. */
    expect(touchesDay('2026-09-22T20:00:00Z', '2026-09-22T22:00:00Z', '2026-09-23')).toBe(false);
  });

  it('draws the working hours with an hour either side', () => {
    expect(visibleHours([{ start: 480, end: 1020 }], [])).toEqual({ start: 7, end: 18 });
    expect(visibleHours([{ start: 480, end: 1050 }], [])).toEqual({ start: 7, end: 19 });
  });

  it('widens to an appointment outside the hours instead of losing it', () => {
    expect(visibleHours([{ start: 480, end: 1020 }], [{ start: 6 * 60 + 30, end: 7 * 60 }])).toEqual({
      start: 6,
      end: 18,
    });
  });

  it('shows the usual day with nothing to go by', () => {
    expect(visibleHours([], [])).toEqual({ start: 7, end: 19 });
  });
});
