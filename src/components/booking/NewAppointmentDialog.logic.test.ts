import { describe, expect, it } from 'vitest';
import {
  endClock,
  isCompleteMoment,
  isStartOffered,
  normalizeTime,
  parseLocalDateTime,
  pragueClock,
  rangeLabel,
  selectionMinutes,
  toStartUtc,
} from './NewAppointmentDialog.logic';

describe('the time the grid hands over', () => {
  it('reads local clinic time yyyy-MM-ddTHH:mm', () => {
    expect(parseLocalDateTime('2026-09-24T09:00')).toEqual({ date: '2026-09-24', time: '09:00' });
    expect(parseLocalDateTime('2026-09-24T09:15:00')).toEqual({ date: '2026-09-24', time: '09:15' });
  });

  it('refuses what is not a time', () => {
    expect(parseLocalDateTime(undefined)).toBeNull();
    expect(parseLocalDateTime('')).toBeNull();
    expect(parseLocalDateTime('2026-09-24')).toBeNull();
    expect(parseLocalDateTime('2026-09-24T25:00')).toBeNull();
    expect(parseLocalDateTime('zítra v devět')).toBeNull();
  });
});

describe('the dragged range', () => {
  const start = { date: '2026-09-24', time: '09:00' };

  it('is the minutes between start and end on the same day', () => {
    expect(selectionMinutes(start, { date: '2026-09-24', time: '10:00' })).toBe(60);
    expect(selectionMinutes(start, { date: '2026-09-24', time: '09:15' })).toBe(15);
  });

  it('is nothing when the end is missing, earlier, equal or on another day', () => {
    expect(selectionMinutes(start, null)).toBeNull();
    expect(selectionMinutes(start, { date: '2026-09-24', time: '08:30' })).toBeNull();
    expect(selectionMinutes(start, { date: '2026-09-24', time: '09:00' })).toBeNull();
    expect(selectionMinutes(start, { date: '2026-09-25', time: '10:00' })).toBeNull();
  });

  it('is said the way the owner asked', () => {
    expect(rangeLabel('09:00', '10:00')).toBe('od 09:00 do 10:00');
  });
});

describe('clinic time to the instant the server wants', () => {
  it('is UTC+2 in summer and UTC+1 in winter', () => {
    expect(toStartUtc({ date: '2026-09-24', time: '09:00' })).toBe('2026-09-24T07:00:00.000Z');
    expect(toStartUtc({ date: '2026-11-24', time: '09:00' })).toBe('2026-11-24T08:00:00.000Z');
  });

  it('is right on the day the clocks go back', () => {
    // 25. 10. 2026: 03:00 CEST becomes 02:00 CET, so 13:00 is already winter time.
    expect(toStartUtc({ date: '2026-10-25', time: '13:00' })).toBe('2026-10-25T12:00:00.000Z');
  });

  it('reads back as the same wall clock, always two digits', () => {
    expect(pragueClock('2026-09-24T07:00:00Z')).toBe('09:00');
    expect(pragueClock('2026-11-24T07:05:00Z')).toBe('08:05');
  });
});

describe('when the appointment ends', () => {
  it('is the start plus the činnost, not the drag', () => {
    expect(endClock({ date: '2026-09-24', time: '09:00' }, 30)).toBe('09:30');
    expect(endClock({ date: '2026-09-24', time: '09:40' }, 45)).toBe('10:25');
  });

  it('counts elapsed time across the clock change', () => {
    // 01:30 + 90 min of real time on 25. 10. 2026 lands at 02:00 winter time.
    expect(endClock({ date: '2026-10-25', time: '01:30' }, 90)).toBe('02:00');
  });
});

describe('a time typed by hand', () => {
  it('keeps HH:mm and drops seconds', () => {
    expect(normalizeTime('09:05')).toBe('09:05');
    expect(normalizeTime('09:05:00')).toBe('09:05');
  });

  it('is empty when it is not a time', () => {
    expect(normalizeTime('')).toBe('');
    expect(normalizeTime('9:5')).toBe('');
    expect(normalizeTime('24:00')).toBe('');
  });

  it('completes a moment only with both a date and a time', () => {
    expect(isCompleteMoment({ date: '2026-09-24', time: '09:00' })).toBe(true);
    expect(isCompleteMoment({ date: '2026-09-24', time: '' })).toBe(false);
    expect(isCompleteMoment({ date: '', time: '09:00' })).toBe(false);
  });
});

describe('whether the server offered the start', () => {
  const slots = [
    { startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z' },
    { startUtc: '2026-09-24T07:30:00Z', endUtc: '2026-09-24T08:00:00Z' },
  ];

  it('compares instants, whatever their spelling', () => {
    expect(isStartOffered(slots, '2026-09-24T07:00:00.000Z')).toBe(true);
    expect(isStartOffered(slots, '2026-09-24T09:30:00+02:00')).toBe(true);
  });

  it('says no to a start that was not offered, or to nothing', () => {
    expect(isStartOffered(slots, '2026-09-24T07:15:00.000Z')).toBe(false);
    expect(isStartOffered(undefined, '2026-09-24T07:00:00.000Z')).toBe(false);
    expect(isStartOffered(slots, null)).toBe(false);
  });
});
