/*
 * The one-word standing the register draws, and the visit summary it reads
 * it off. The rule worth guarding: a booking in the past that nobody closed
 * is not a visit, and a patient with one of those and nothing else is still
 * "Nový pacient" - the desk has not seen them.
 */
import { describe, it, expect } from 'vitest';
import {
  birthYear, formatCzk, initialsOf, minutesBetween, patientStanding, questionnaireMissing,
  shortDay, shortDayTime, summariseVisits, wasAttended,
} from './patientActivity';
import type { PatientAppointment } from './patientActivity';
import type { DayAppointment } from '../../api/bookingContracts';

const NOW = new Date('2026-10-03T10:00:00Z');

const appointment = (over: Partial<PatientAppointment> = {}): PatientAppointment => ({
  id: 'a1',
  patientId: 'p1',
  eventName: 'Komplexní prohlídka',
  startTime: '2026-10-26T08:00:00Z',
  endTime: '2026-10-26T09:00:00Z',
  status: 'Scheduled',
  notes: '',
  ...over,
});

const dayRow = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'd1',
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'act1',
  activityName: 'Komplexní prohlídka',
  startUtc: '2026-10-26T08:00:00Z',
  endUtc: '2026-10-26T09:00:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: { ready: false, missing: ['questionnaire_missing'] },
  ...over,
});

describe('the visit summary', () => {
  it('finds the last visit, the next appointment and the no-shows for one patient only', () => {
    const summary = summariseVisits('p1', [
      appointment({ id: 'past', startTime: '2026-03-14T08:00:00Z', status: 'Completed' }),
      appointment({ id: 'older', startTime: '2025-11-02T08:00:00Z', status: 'CheckedIn' }),
      appointment({ id: 'missed', startTime: '2026-05-01T08:00:00Z', status: 'NoShow' }),
      appointment({ id: 'later', startTime: '2026-11-10T08:00:00Z' }),
      appointment({ id: 'next' }),
      appointment({ id: 'theirs', patientId: 'p2', status: 'Completed', startTime: '2026-09-01T08:00:00Z' }),
    ], NOW);

    expect(summary.lastVisit?.id).toBe('past');
    expect(summary.nextAppointment?.id).toBe('next');
    expect(summary.noShows).toBe(1);
    expect(summary.visits.map((v) => v.id)).toEqual(['past', 'older']);
  });

  /* An open booking in the past says the patient was expected, not seen. */
  it('does not count a past booking nobody closed as a visit', () => {
    const summary = summariseVisits('p1', [
      appointment({ startTime: '2026-01-01T08:00:00Z', status: 'Scheduled' }),
    ], NOW);
    expect(summary.lastVisit).toBeNull();
    expect(summary.visits).toHaveLength(0);
  });

  it('keeps a cancelled future booking out of the next appointment', () => {
    const summary = summariseVisits('p1', [appointment({ status: 'Cancelled' })], NOW);
    expect(summary.nextAppointment).toBeNull();
  });

  it('is what attended means', () => {
    expect(wasAttended({ status: 'Completed' })).toBe(true);
    expect(wasAttended({ status: 'CheckedIn' })).toBe(true);
    expect(wasAttended({ status: 'Scheduled' })).toBe(false);
    expect(wasAttended({ status: 'NoShow' })).toBe(false);
  });
});

describe('the questionnaire', () => {
  it('is missing when a booking in the window says so, for this patient', () => {
    expect(questionnaireMissing('p1', [dayRow()])).toBe(true);
    expect(questionnaireMissing('p2', [dayRow()])).toBe(false);
  });

  it('is not missing when the paperwork is about something else, or unknown', () => {
    expect(questionnaireMissing('p1', [dayRow({ paperwork: { ready: false, missing: ['report_missing'] } })])).toBe(false);
    expect(questionnaireMissing('p1', [dayRow({ paperwork: null })])).toBe(false);
  });
});

describe('the standing chip', () => {
  const seen = { lastVisit: appointment({ status: 'Completed' }), noShows: 0 };
  const unseen = { lastVisit: null, noShows: 0 };

  it('says the questionnaire is missing before anything else about an active patient', () => {
    expect(patientStanding({ status: 'Active' }, { ...seen, noShows: 2 }, true))
      .toEqual({ label: 'Dotazník chybí', tone: 'beige' });
  });

  it('counts the no-shows', () => {
    expect(patientStanding({ status: 'Active' }, { ...seen, noShows: 2 }, false))
      .toEqual({ label: 'Nepřišel 2×', tone: 'red' });
  });

  it('calls somebody nobody has seen a new patient', () => {
    expect(patientStanding({ status: 'Active' }, unseen, false))
      .toEqual({ label: 'Nový pacient', tone: 'primary' });
  });

  it('is complete for the ordinary case', () => {
    expect(patientStanding({ status: 'Active' }, seen, false))
      .toEqual({ label: 'Kompletní', tone: 'green' });
  });

  /* The record's own state is a fact the server keeps; it is not overruled by
     a questionnaire nobody will ever fill in. */
  it('lets an archived record say so, whatever else is true', () => {
    expect(patientStanding({ status: 'Archived' }, unseen, true))
      .toEqual({ label: 'Archivovaný', tone: 'grey' });
  });
});

describe('the small formatters', () => {
  it('writes money the board\'s way', () => {
    expect(formatCzk(2200).replace(/ /g, ' ')).toBe('2 200 Kč');
    expect(formatCzk(null)).toBe('—');
  });

  it('reads the birth year off a date-only value and nothing off garbage', () => {
    expect(birthYear('1986-04-12')).toBe('1986');
    expect(birthYear(undefined)).toBe('');
    expect(birthYear('kdysi')).toBe('');
  });

  it('writes initials in capitals', () => {
    expect(initialsOf({ firstName: 'bohumil', lastName: 'komárek' })).toBe('BK');
  });

  it('writes a short day and a short day with time, in Prague', () => {
    expect(shortDay('2026-10-26T08:00:00Z')).toBe('Po 26. 10.');
    expect(shortDayTime('2026-10-26T09:00:00Z')).toBe('26. 10. 10:00');
    expect(shortDay('kdysi')).toBe('');
  });

  it('counts the minutes of an appointment', () => {
    expect(minutesBetween('2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z')).toBe(60);
    expect(minutesBetween('2026-10-26T09:00:00Z', '2026-10-26T08:00:00Z')).toBeNull();
  });
});
