/*
 * Prague wall clock to instant, across both clock changes.
 *
 * This exists because the first version of the blocked-time screen computed
 * `startOfPragueDay(date) + hours * 3600000`, which is right on the 363 days
 * that have 24 wall-clock hours and an hour out on the two that do not. It was
 * found by blocking 13:00 on 25. 10. 2026 against the running API and reading
 * back 12:00 - not by reasoning about it.
 *
 * What would have to break for these to fail: going back to elapsed-hour
 * arithmetic, dropping the second correction pass, or hard-coding a +1/+2
 * offset instead of asking the zone.
 */
import { describe, it, expect } from 'vitest';
import { pragueWallClockToInstant, startOfPragueDay, hoursInPragueDay } from './time';

const pragueClock = (d: Date) =>
  new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

describe('pragueWallClockToInstant', () => {
  it('is +2 in summer (CEST)', () => {
    expect(pragueWallClockToInstant('2026-09-29', '13:00').toISOString()).toBe(
      '2026-09-29T11:00:00.000Z',
    );
  });

  it('is +1 in winter (CET)', () => {
    expect(pragueWallClockToInstant('2026-01-15', '13:00').toISOString()).toBe(
      '2026-01-15T12:00:00.000Z',
    );
  });

  /* The 25-hour day. The naive arithmetic stored 11:00Z here; 12:00Z is right. */
  it('holds on the autumn clock change, when the day has 25 hours', () => {
    expect(hoursInPragueDay('2026-10-25')).toBe(25);
    expect(pragueWallClockToInstant('2026-10-25', '13:00').toISOString()).toBe(
      '2026-10-25T12:00:00.000Z',
    );
  });

  /* The 23-hour day. */
  it('holds on the spring clock change, when the day has 23 hours', () => {
    expect(hoursInPragueDay('2026-03-29')).toBe(23);
    expect(pragueWallClockToInstant('2026-03-29', '13:00').toISOString()).toBe(
      '2026-03-29T11:00:00.000Z',
    );
  });

  it('round-trips: what the operator typed is what they read back, every day of the year', () => {
    for (const date of [
      '2026-01-15',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-09-29',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]) {
      for (const time of ['00:30', '08:00', '13:00', '23:30']) {
        expect(pragueClock(pragueWallClockToInstant(date, time))).toBe(time);
      }
    }
  });

  it('agrees with startOfPragueDay at midnight, including on the clock-change days', () => {
    for (const date of ['2026-03-29', '2026-10-25', '2026-06-01']) {
      expect(pragueWallClockToInstant(date, '00:00').toISOString()).toBe(
        startOfPragueDay(date).toISOString(),
      );
    }
  });
});
