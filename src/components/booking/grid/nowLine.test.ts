import { describe, expect, it } from 'vitest';
import { isWorkingToday, nowLinePlacement, resolveNowLineColor, workingSpan } from './nowLine';

const open = (startTime: string, endTime: string) => ({ isOpen: true, startTime, endTime });
const shut = { isOpen: false, startTime: null, endTime: null };

/* 10:15 in Prague on Wednesday 23. 9. 2026. */
const NOW = new Date('2026-09-23T08:15:00Z');
const TODAY = '2026-09-23';

describe('workingSpan', () => {
  it('runs from the earliest opening to the latest closing among open calendars', () => {
    expect(workingSpan([open('08:00', '14:00'), open('10:00:00', '17:30:00'), shut])).toEqual({
      start: 480,
      end: 1050,
    });
  });

  it('is nothing when nobody works', () => {
    expect(workingSpan([shut])).toBeNull();
    expect(workingSpan([])).toBeNull();
  });
});

describe('the now-line', () => {
  it('is drawn on today, a working day, within working hours', () => {
    expect(
      nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows: [open('08:00', '16:00')], closed: false }),
    ).toEqual({ minute: 10 * 60 + 15, span: { start: 480, end: 960 }, verticalLines: true });
  });

  it('has vertical lines in the week and none in the day view', () => {
    const rows = [open('08:00', '16:00')];
    expect(nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows, closed: false })?.verticalLines).toBe(true);
    expect(nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'day', rows, closed: false })?.verticalLines).toBe(false);
  });

  it('is not drawn on another day', () => {
    expect(
      nowLinePlacement({ now: NOW, dayKey: '2026-09-24', view: 'week', rows: [open('08:00', '16:00')], closed: false }),
    ).toBeNull();
  });

  it('is not drawn before opening or from closing time on', () => {
    const rows = [open('11:00', '16:00')];
    expect(nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows, closed: false })).toBeNull();
    expect(
      nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows: [open('07:00', '10:15')], closed: false }),
    ).toBeNull();
  });

  it('is not drawn on a closed day, whatever the hours say', () => {
    expect(nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows: [shut], closed: false })).toBeNull();
    expect(
      nowLinePlacement({ now: NOW, dayKey: TODAY, view: 'week', rows: [open('08:00', '16:00')], closed: true }),
    ).toBeNull();
  });

  it('uses the clinic date, not the browser date', () => {
    /* 23:30 UTC on the 22nd is already the 23rd in Prague. */
    const lateUtc = new Date('2026-09-22T23:30:00Z');
    expect(isWorkingToday({ now: lateUtc, dayKey: TODAY, rows: [open('00:00', '23:59')], closed: false })).toBe(true);
  });
});

describe("today's highlighted column", () => {
  it('is today when it is a working day, at any hour', () => {
    expect(isWorkingToday({ now: NOW, dayKey: TODAY, rows: [open('14:00', '18:00')], closed: false })).toBe(true);
  });

  it('is not highlighted on a closed today or on another day', () => {
    expect(isWorkingToday({ now: NOW, dayKey: TODAY, rows: [shut], closed: false })).toBe(false);
    expect(isWorkingToday({ now: NOW, dayKey: TODAY, rows: [open('08:00', '16:00')], closed: true })).toBe(false);
    expect(isWorkingToday({ now: NOW, dayKey: '2026-09-22', rows: [open('08:00', '16:00')], closed: false })).toBe(false);
  });
});

describe('the colour', () => {
  it('takes the setting when it is a colour that can be made translucent', () => {
    expect(resolveNowLineColor('#1565C0', 'red')).toBe('#1565C0');
    expect(resolveNowLineColor(' #abc ', 'red')).toBe('#abc');
    expect(resolveNowLineColor('rgb(10, 20, 30)', 'red')).toBe('rgb(10, 20, 30)');
  });

  it('falls back to the theme colour otherwise', () => {
    expect(resolveNowLineColor(undefined, '#D32F2F')).toBe('#D32F2F');
    expect(resolveNowLineColor('', '#D32F2F')).toBe('#D32F2F');
    expect(resolveNowLineColor('red', '#D32F2F')).toBe('#D32F2F');
    expect(resolveNowLineColor('#12', '#D32F2F')).toBe('#D32F2F');
    expect(resolveNowLineColor('url(javascript:x)', '#D32F2F')).toBe('#D32F2F');
  });
});
