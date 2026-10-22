import { describe, expect, it } from 'vitest';
import { lunchOutcomeText } from './lunchActions';
import { LUNCH_TEXT, checkLunchMove, clockOf, draggedStart, lunchBandLabel, lunchBandOf, lunchLength, startMinutesOf } from './lunchModel';

describe('R17: the band a day mark describes', () => {
  it('weekly, moved (with where it was) and removed (the ghost)', () => {
    expect(lunchBandOf('2026-10-23', { date: '2026-10-23', closed: false, lunch: { from: '12:00', to: '12:30' } })).toEqual({ day: '2026-10-23', from: '12:00', to: '12:30', state: 'weekly', original: null });
    expect(lunchBandOf('2026-10-23', { date: '2026-10-23', closed: false, lunch: { from: '13:00', to: '13:30', moved: true, original: { from: '12:00', to: '12:30' } } })).toMatchObject({ state: 'moved', from: '13:00', original: { from: '12:00', to: '12:30' } });
    expect(lunchBandOf('2026-10-23', { date: '2026-10-23', closed: false, lunch: null, lunchRemoved: { from: '12:00', to: '12:30' } })).toMatchObject({ state: 'removed', from: '12:00' });
  });

  it('no band on a closed day, without a lunch, or without a day mark', () => {
    expect(lunchBandOf('d', { date: 'd', closed: true, lunch: { from: '12:00', to: '12:30' } })).toBeNull();
    expect(lunchBandOf('d', { date: 'd', closed: false, lunch: null })).toBeNull();
    expect(lunchBandOf('d', undefined)).toBeNull();
  });

  it('says "OBĚD · přesunut" / "OBĚD · smazán dnes"', () => {
    expect(lunchBandLabel('weekly')).toBe('Oběd');
    expect(lunchBandLabel('moved')).toBe('Oběd · přesunut');
    expect(lunchBandLabel('removed')).toBe('Oběd · smazán dnes');
  });
});

describe('R17: moving the lunch - any time of the day, same length, never over a booking', () => {
  const base = { length: 30, hours: { from: '08:00', to: '16:00' }, bookings: [{ start: 9 * 60, end: 10 * 60 }] };

  it('12:00 to 16:00 is not fine when the day ends at 16:00, but 15:30 is (any time of the day, the length stays)', () => {
    expect(checkLunchMove({ ...base, start: 15 * 60 + 30 })).toBeNull();
    expect(checkLunchMove({ ...base, start: 16 * 60 })).toBe('Oběd musí zůstat v pracovní době (08:00–16:00).');
    expect(checkLunchMove({ ...base, start: 7 * 60 + 45 })).toBe('Oběd musí zůstat v pracovní době (08:00–16:00).');
    expect(checkLunchMove({ ...base, start: 13 * 60 })).toBeNull();
  });

  it('refuses an overlap with a booking, but back-to-back is fine', () => {
    expect(checkLunchMove({ ...base, start: 9 * 60 + 30 })).toBe(LUNCH_TEXT.overlapBooking);
    expect(checkLunchMove({ ...base, start: 8 * 60 + 45 })).toBe(LUNCH_TEXT.overlapBooking);
    expect(checkLunchMove({ ...base, start: 10 * 60 })).toBeNull(); // starts when the booking ends
    expect(checkLunchMove({ ...base, start: 8 * 60 + 30 })).toBeNull(); // ends when the booking starts
  });

  it('reads the typed start leniently and measures the lunch', () => {
    expect(startMinutesOf('13:00')).toBe(780);
    expect(startMinutesOf('9:30')).toBe(570);
    expect(startMinutesOf('1300')).toBe(780);
    expect(startMinutesOf('25:00')).toBeNull();
    expect(startMinutesOf('')).toBeNull();
    expect(lunchLength({ from: '12:00', to: '12:30' })).toBe(30);
    expect(clockOf(795)).toBe('13:15');
  });

  it('a dragged lunch snaps to the grid step and stays inside the day', () => {
    expect(draggedStart(720, 62, 15, 30)).toBe(780); // 12:00 + 62 min -> 13:00 on a 15 minute grid
    expect(draggedStart(720, -2000, 15, 30)).toBe(0);
    expect(draggedStart(720, 5000, 15, 30)).toBe(24 * 60 - 30);
    expect(draggedStart(720, 7, 5, 30)).toBe(725);
  });
});

describe('R17: what the desk is told after a write', () => {
  const ok = { done: 2, total: 2, errors: [], routesMissing: false };
  it('success, partial success and a refusal worded by its code', () => {
    expect(lunchOutcomeText(ok, LUNCH_TEXT.done.moved)).toEqual({ text: LUNCH_TEXT.done.moved, tone: 'info' });
    expect(lunchOutcomeText({ done: 1, total: 2, errors: [new Error('x')], routesMissing: false }, 'ok')).toEqual({ text: LUNCH_TEXT.partial(1, 2), tone: 'error' });
    expect(lunchOutcomeText({ done: 0, total: 2, errors: [new Error('x')], routesMissing: false }, 'ok').tone).toBe('error');
  });
});
