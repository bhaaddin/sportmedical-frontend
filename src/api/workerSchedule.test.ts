/*
 * Reading a rota back as sentences.
 *
 * ── What is worth testing here ──
 *
 * Not the fetch — one line, and the server decides what it means. What is
 * worth pinning down is the wording, because every one of these is a way to
 * quietly mislead somebody reading a colleague's week:
 *
 *   * a break shown when there is none, or lost when there is one;
 *   * "každý 2. týden" printed on every row of a clinic that has no
 *     alternating weeks, which is fourteen lines of noise nobody can act on;
 *   * the wrong weekday, because .NET numbers Sunday 0 and a reader who
 *     assumes Monday 0 is off by one all week;
 *   * a service counted twice because somebody works it on two days.
 */
import { describe, it, expect } from 'vitest';
import { currentServices, dayLine, shortTime, weekdayName } from './workerSchedule';
import type { WhereSomebodyWorksEntry, WorkingDayOfSomebody } from './workerSchedule';

const day = (over: Partial<WorkingDayOfSomebody> = {}): WorkingDayOfSomebody => ({
  dayOfWeek: 1,
  startTime: '08:00:00',
  endTime: '16:00:00',
  repeatEveryNWeeks: 1,
  weekOffset: 0,
  breakStart: null,
  breakEnd: null,
  ...over,
});

const entry = (over: Partial<WhereSomebodyWorksEntry> = {}): WhereSomebodyWorksEntry => ({
  calendarId: 'c1',
  calendarName: 'Prohlídky',
  calendarColour: '#336699',
  clinicServiceId: 's1',
  clinicServiceName: 'Sportovní prohlídka',
  schedulePeriodId: 'p1',
  schedulePeriodName: 'Podzim 2026',
  validFrom: '2026-09-01',
  validTo: null,
  isCurrent: true,
  days: [day()],
  ...over,
});

describe('the weekday', () => {
  it('numbers Sunday zero, the way the server does', () => {
    // .NET's DayOfWeek and JavaScript's getDay() agree on this, and a reader
    // who assumes Monday is 0 is wrong on every single row.
    expect(weekdayName(0)).toBe('Neděle');
    expect(weekdayName(1)).toBe('Pondělí');
    expect(weekdayName(6)).toBe('Sobota');
  });

  it('says the number back rather than nothing when it is out of range', () => {
    expect(weekdayName(9)).toBe('9');
  });
});

describe('the time', () => {
  it('drops the seconds and the leading zero, as a rota is read aloud', () => {
    expect(shortTime('08:00:00')).toBe('8:00');
    expect(shortTime('16:30:00')).toBe('16:30');
  });
});

describe('one day as a line', () => {
  it('is just the day and the hours when there is nothing else to say', () => {
    expect(dayLine(day())).toBe('Pondělí 8:00–16:00');
  });

  it('adds the break when there is one', () => {
    expect(dayLine(day({ breakStart: '12:00:00', breakEnd: '12:30:00' })))
      .toBe('Pondělí 8:00–16:00 (pauza 12:00–12:30)');
  });

  it('says nothing about a break that is only half set', () => {
    // A start with no end is not a break anybody can read; printing
    // "pauza 12:00–" would be worse than leaving it out.
    expect(dayLine(day({ breakStart: '12:00:00' }))).toBe('Pondělí 8:00–16:00');
    expect(dayLine(day({ breakEnd: '12:30:00' }))).toBe('Pondělí 8:00–16:00');
  });

  it('mentions an alternating week only when the week alternates', () => {
    expect(dayLine(day())).not.toContain('týden');

    expect(dayLine(day({ repeatEveryNWeeks: 2 })))
      .toBe('Pondělí 8:00–16:00 (každý 2. týden)');
  });

  it('puts the break and the cycle in one bracket, not two', () => {
    expect(dayLine(day({ repeatEveryNWeeks: 2, breakStart: '12:00:00', breakEnd: '12:30:00' })))
      .toBe('Pondělí 8:00–16:00 (pauza 12:00–12:30, každý 2. týden)');
  });
});

describe('what somebody currently does', () => {
  it('names a service once however many days it is worked', () => {
    const services = currentServices([
      entry({ days: [day({ dayOfWeek: 1 })] }),
      entry({ schedulePeriodId: 'p2', days: [day({ dayOfWeek: 2 })] }),
    ]);

    expect(services).toEqual(['Sportovní prohlídka']);
  });

  it('leaves out a period that has ended', () => {
    const services = currentServices([
      entry(),
      entry({
        clinicServiceName: 'Sportovní diagnostika',
        isCurrent: false,
        validTo: '2026-06-30',
      }),
    ]);

    // Shown in the list, but not in "nyní dělá" — it is what he used to do.
    expect(services).toEqual(['Sportovní prohlídka']);
  });

  it('is empty for somebody whose every period is over', () => {
    expect(currentServices([entry({ isCurrent: false })])).toEqual([]);
  });
});
