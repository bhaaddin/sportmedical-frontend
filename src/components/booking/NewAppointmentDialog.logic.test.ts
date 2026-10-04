import { describe, expect, it } from 'vitest';
import {
  drawerTitle,
  endClock,
  formatCzk,
  foundPatientsWord,
  initials,
  isCompleteMoment,
  isQuickDraftComplete,
  isStartOffered,
  minutesWord,
  normalizePhone,
  normalizeTime,
  parseLocalDateTime,
  pragueClock,
  quickDraftProblems,
  rangeLabel,
  selectionMinutes,
  slotSubtitle,
  slotTitle,
  splitFullName,
  stepSubtitle,
  toStartUtc,
  weekdayName,
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

describe('the drawer\'s words (board 2026-10-03)', () => {
  it('writes money and minutes the way the board does', () => {
    expect(formatCzk(2200)).toBe('2 200 Kč');
    expect(formatCzk(500)).toBe('500 Kč');
    expect(formatCzk(null)).toBe('—');
    expect(minutesWord(1)).toBe('1 minuta');
    expect(minutesWord(3)).toBe('3 minuty');
    expect(minutesWord(60)).toBe('60 minut');
  });

  it('names the slot: weekday, date, the dragged range', () => {
    expect(weekdayName('2026-10-26')).toBe('Pondělí');
    expect(slotTitle('2026-10-26', '10:00', '11:00')).toBe('Pondělí 26. 10. 2026 · 10:00 — 11:00');
    expect(slotTitle('2026-10-26', '10:00', null)).toBe('Pondělí 26. 10. 2026 · od 10:00');
    expect(slotTitle('2026-10-26', '', null)).toBe('Pondělí 26. 10. 2026');
    expect(slotTitle('nope', '10:00', null)).toBe('');
    expect(slotSubtitle(60)).toBe('60 minut volno');
    expect(slotSubtitle(null)).toBe('');
  });

  it('makes initials and splits a name typed in one box', () => {
    expect(initials('Bohumil Komárek')).toBe('BK');
    expect(initials('  filip  ')).toBe('F');
    expect(initials('')).toBe('');
    expect(splitFullName('Filip Fehér')).toEqual({ firstName: 'Filip', lastName: 'Fehér' });
    expect(splitFullName('Jan van Dyk')).toEqual({ firstName: 'Jan', lastName: 'van Dyk' });
    expect(splitFullName('Filip')).toBeNull();
    expect(splitFullName('   ')).toBeNull();
  });

  it('sends a telephone with its dialling code', () => {
    expect(normalizePhone('773 539 001')).toBe('+420773539001');
    expect(normalizePhone('0773 539 001')).toBe('+420773539001');
    expect(normalizePhone('+421 908 123 456')).toBe('+421908123456');
    expect(normalizePhone('00421 908 123 456')).toBe('+421908123456');
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });

  it('needs exactly four things for a quick registration, and a date of birth is not one of them', () => {
    const draft = { name: 'Filip Fehér', phone: '+420773539001', email: 'f@x.cz', activityId: 'a1' };
    expect(isQuickDraftComplete(draft)).toBe(true);
    expect(isQuickDraftComplete({ ...draft, name: 'Filip' })).toBe(false);
    expect(isQuickDraftComplete({ ...draft, phone: '' })).toBe(false);
    expect(isQuickDraftComplete({ ...draft, email: 'bez-zavinace' })).toBe(false);
    expect(isQuickDraftComplete({ ...draft, activityId: '' })).toBe(false);
    /* There is no such field on the draft at all. */
    expect(Object.keys(draft)).not.toContain('dateOfBirth');
  });

  it('says what is plainly wrong in the four boxes before the server does', () => {
    expect(quickDraftProblems({ name: 'Filip', phone: '', email: '', activityId: '' })).toEqual({
      name: 'Zadejte jméno i příjmení.',
    });
    expect(quickDraftProblems({ name: '', phone: '', email: 'x@', activityId: '' }).email).toBe('E-mail nevypadá správně.');
    expect(quickDraftProblems({ name: 'Filip Fehér', phone: '', email: 'f@x.cz', activityId: '' })).toEqual({});
  });

  it('heads each step the way the board words it', () => {
    expect(stepSubtitle(1, 'database')).toBe('Krok 1 ze 2 — kdo přijde');
    /* A new caller has no second step: the four facts book the slot. */
    expect(stepSubtitle(1, 'quick')).toBe('Rychlá registrace — nový pacient');
    expect(stepSubtitle(2, 'quick')).toBe('Krok 2 ze 2 — co se bude dělat');
    expect(drawerTitle('database')).toBe('Objednat termín');
  });

  it('counts found patients in Czech', () => {
    expect(foundPatientsWord(1)).toBe('1 nalezen');
    expect(foundPatientsWord(3)).toBe('3 nalezeni');
  });
});
