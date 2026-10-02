/*
 * What the register and the card say about a patient beyond their name:
 * when they were last in, when they are next due, how often they did not
 * turn up, and the one-word standing the board draws as a chip.
 *
 * Pure. The screens hand in what the server gave them - the clinic-wide
 * appointment list (`GET /api/scheduling/appointments`), the booking grid's
 * window (`GET /api/day`, which carries paperwork) - and read the answers
 * off. Nothing here asks the network, so every rule is testable with a
 * fixture and every screen that draws these columns draws them the same way.
 *
 * Deliberately decided here and not guessed from the age or the name:
 *
 *     Dotazník chybí   an appointment in the booking window says so
 *     Nepřišel N×      counted off `NoShow` rows, however old
 *     Nový pacient     nobody has seen them yet - no past visit on file
 *     Kompletní        the ordinary state: seen before, nothing owed
 *     Archivovaný      the record's own state, which wins over the rest
 */
import type { DayAppointment } from '../../api/bookingContracts';
import type { Patient } from '../../api/patients';
import type { ChipTone } from '../ui';
import { formatPragueDate, formatPragueTime } from '../../utils/time';

/** One row of `GET /api/scheduling/appointments`, as the server spells it. */
export interface PatientAppointment {
  id: string;
  patientId: string;
  eventName: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string;
}

/** An appointment that no longer stands. Kept visible, never counted as upcoming. */
export function isCancelled(appointment: Pick<PatientAppointment, 'status'>): boolean {
  return appointment.status === 'Cancelled' || appointment.status === 'NoShow';
}

/**
 * A visit that happened: the patient was there. `Scheduled` in the past is a
 * booking nobody closed, and counting it as a visit would tell the desk the
 * patient has been seen when the record says only that they were expected.
 */
export function wasAttended(appointment: Pick<PatientAppointment, 'status'>): boolean {
  return appointment.status === 'CheckedIn' || appointment.status === 'Completed';
}

export interface VisitSummary {
  /** The newest attended appointment, or null when nobody has seen them. */
  lastVisit: PatientAppointment | null;
  /** The soonest appointment still to come, or null. */
  nextAppointment: PatientAppointment | null;
  /** How many times they were marked as not having come. */
  noShows: number;
  /** Everything attended, newest first - the visit history. */
  visits: PatientAppointment[];
}

export function summariseVisits(
  patientId: string,
  appointments: readonly PatientAppointment[],
  now: Date = new Date(),
): VisitSummary {
  const mine = appointments.filter((a) => a.patientId === patientId);
  const upcoming: PatientAppointment[] = [];
  const visits: PatientAppointment[] = [];
  let noShows = 0;

  for (const a of mine) {
    const starts = Date.parse(a.startTime);
    if (Number.isNaN(starts)) continue;
    if (a.status === 'NoShow') noShows += 1;
    if (starts >= now.getTime() && !isCancelled(a)) upcoming.push(a);
    else if (wasAttended(a)) visits.push(a);
  }

  upcoming.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  visits.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));

  return {
    lastVisit: visits[0] ?? null,
    nextAppointment: upcoming[0] ?? null,
    noShows,
    visits,
  };
}

/** The paperwork codes that mean "the questionnaire is not there to read". */
const QUESTIONNAIRE_CODES = new Set(['questionnaire_missing', 'questionnaire_expired']);

/**
 * Whether any booking in the window still waits for the patient's
 * questionnaire. Read off the grid's own `paperwork` field, which the server
 * computes per appointment - never off a flag on the patient, which the
 * register does not keep.
 */
export function questionnaireMissing(
  patientId: string,
  window: readonly DayAppointment[],
): boolean {
  return window.some(
    (a) =>
      a.patientId === patientId
      && a.paperwork !== null
      && a.paperwork.missing.some((code) => QUESTIONNAIRE_CODES.has(code)),
  );
}

/** The chip in the STAV column and in the card header. */
export interface Standing {
  label: string;
  tone: ChipTone;
}

export function patientStanding(
  patient: Pick<Patient, 'status'>,
  summary: Pick<VisitSummary, 'lastVisit' | 'noShows'>,
  questionnaireIsMissing: boolean,
): Standing {
  if (patient.status === 'Archived') return { label: 'Archivovaný', tone: 'grey' };
  if (questionnaireIsMissing) return { label: 'Dotazník chybí', tone: 'beige' };
  if (summary.noShows > 0) return { label: `Nepřišel ${summary.noShows}×`, tone: 'red' };
  if (summary.lastVisit === null) return { label: 'Nový pacient', tone: 'primary' };
  return { label: 'Kompletní', tone: 'green' };
}

/** `2 200 Kč` - the board's spelling, non-breaking space inside the number. */
export function formatCzk(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

/** The year the board shows beside the name: "nar. 1986". */
export function birthYear(dateOfBirth: string | null | undefined): string {
  if (typeof dateOfBirth !== 'string') return '';
  const year = dateOfBirth.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

export function initialsOf(patient: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase();
}

/* Czech two-letter weekdays, keyed by the English short name Intl gives. */
const WEEKDAY_SHORT: Record<string, string> = {
  Mon: 'Po', Tue: 'Út', Wed: 'St', Thu: 'Čt', Fri: 'Pá', Sat: 'So', Sun: 'Ne',
};

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Prague',
  weekday: 'short',
});

/**
 * `Po 26. 10.` - weekday and day in Prague, no year. The year is on the row
 * next to it when it matters; in a column of dates it is noise.
 */
export function shortDay(instant: string | Date): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return '';
  const weekday = WEEKDAY_SHORT[weekdayFormatter.format(d)] ?? '';
  const dayMonth = formatPragueDate(d).replace(/\s*\d{4}$/, '');
  return weekday === '' ? dayMonth : `${weekday} ${dayMonth}`;
}

/** `26. 10. 10:00` - the PŘÍŠTÍ TERMÍN column on the register. */
export function shortDayTime(instant: string | Date): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return '';
  const dayMonth = formatPragueDate(d).replace(/\s*\d{4}$/, '');
  return `${dayMonth} ${formatPragueTime(d)}`;
}

/** Minutes between two instants, whole. */
export function minutesBetween(startIso: string, endIso: string): number | null {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}
