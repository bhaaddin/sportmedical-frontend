import { describe, expect, it } from 'vitest';
import {
  calendarDayOpen,
  closedHolidayDates,
  dayMark,
  holidayDates,
  yearsBetween,
} from './dayMarks';

const openRow = { isOpen: true, closedBecause: null, offeredActivityIds: ['a1'] };
const closedRow = (because: string) => ({ isOpen: false, closedBecause: because, offeredActivityIds: [] });

const christmas = { date: '2026-12-24', name: 'Štědrý den', isHoliday: true, isStatutory: true };
const workedHoliday = { date: '2026-10-28', name: 'Den vzniku státu', isHoliday: false, isStatutory: true };
const clinicDayOff = { date: '2026-08-14', name: 'Firemní volno', isHoliday: true, isStatutory: false };

describe('dayMark', () => {
  it('shuts a public holiday: red number, shaded, "Státní svátek"', () => {
    expect(dayMark(christmas, [closedRow('holiday')])).toEqual({
      redNumber: true,
      closed: true,
      label: 'Státní svátek',
      detail: 'Štědrý den',
    });
  });

  it('shuts a holiday even where a calendar would otherwise be open', () => {
    expect(dayMark(christmas, [openRow]).closed).toBe(true);
  });

  it('keeps the red number but opens a holiday the administrator allowed work on', () => {
    expect(dayMark(workedHoliday, [openRow])).toEqual({
      redNumber: true,
      closed: false,
      label: 'Svátek – pracuje se',
      detail: 'Den vzniku státu',
    });
  });

  it('calls a clinic day off "Zavřeno", in red', () => {
    expect(dayMark(clinicDayOff, [])).toMatchObject({ redNumber: true, closed: true, label: 'Zavřeno' });
  });

  it('says why a day with no holiday is shut', () => {
    expect(dayMark(undefined, [closedRow('override')])).toMatchObject({ closed: true, label: 'Zavřeno', redNumber: false });
    expect(dayMark(undefined, [closedRow('notAWorkingDay')])).toMatchObject({ closed: true, label: 'Nepracovní den' });
    expect(dayMark(undefined, [closedRow('noPeriod')])).toMatchObject({ closed: true, label: 'Mimo období' });
    expect(dayMark(undefined, [closedRow('somethingNew')])).toMatchObject({ closed: true, label: 'Zavřeno' });
  });

  it('paints a day the preview shuts as a holiday red even before the holiday list arrives', () => {
    expect(dayMark(undefined, [closedRow('holiday')])).toMatchObject({ redNumber: true, label: 'Státní svátek' });
  });

  it('leaves an ordinary day alone', () => {
    expect(dayMark(undefined, [openRow])).toEqual({ redNumber: false, closed: false, label: null, detail: null });
  });

  it('does not call an open day with nothing to book shut', () => {
    expect(dayMark(undefined, [{ isOpen: true, closedBecause: 'noActivities', offeredActivityIds: [] }])).toMatchObject({
      closed: false,
      label: 'Bez činností',
    });
  });
});

describe('calendarDayOpen', () => {
  const ordinary = dayMark(undefined, [openRow]);

  it('offers the drag on an open calendar day', () => {
    expect(calendarDayOpen(ordinary, { isOpen: true })).toBe(true);
  });

  it('never on a shut day or a calendar that does not work that day', () => {
    expect(calendarDayOpen(dayMark(christmas, []), { isOpen: true })).toBe(false);
    expect(calendarDayOpen(ordinary, { isOpen: false })).toBe(false);
  });

  it('leaves the decision to the server when the preview is missing', () => {
    expect(calendarDayOpen(ordinary, undefined)).toBe(true);
  });
});

describe('holiday sets for the mini calendar', () => {
  it('reds every holiday, worked or not, and closes only the ones not worked', () => {
    const list = [christmas, workedHoliday, clinicDayOff];
    expect([...holidayDates(list)].sort()).toEqual(['2026-08-14', '2026-10-28', '2026-12-24']);
    expect([...closedHolidayDates(list)].sort()).toEqual(['2026-08-14', '2026-12-24']);
  });

  it('asks for both years of a week over New Year', () => {
    expect(yearsBetween('2026-12-28', '2027-01-03')).toEqual([2026, 2027]);
    expect(yearsBetween('2026-09-21', '2026-09-27')).toEqual([2026]);
  });
});
