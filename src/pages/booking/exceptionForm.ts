import type { DayAppointment, ScheduleExceptionInput } from '../../api/bookingContracts';
import { statusTally } from '../../api/bookingContracts';
import { dateProblem, wallTimeProblem } from '../../utils/clinicDayRules';
import { pragueDateKey, pragueWallClockToInstant } from '../../utils/time';

/*
 * What an exception must hold before it is sent.
 *
 * Measured on the dev API (20. 10. 2026): "different hours" without both times
 * is `422 scheduling.exception.hours_required`, an end that is not after the
 * start is `scheduling.exception.end_before_start`, and a second exception on
 * a day that already has one is a 409. The first two are caught here, at the
 * field, instead of after the round trip.
 */

export type ExceptionKind = 'closed' | 'differentHours' | 'differentWorker' | 'onlineOff';

export type ExceptionProblem = 'date' | 'kind' | 'hoursMissing' | 'hoursOrder' | 'timeGap' | 'worker' | null;

export const EXCEPTION_PROBLEM_TEXT: Record<Exclude<ExceptionProblem, null>, string> = {
  date: 'Vyplňte datum.',
  kind: 'Vyberte, co se ten den stane.',
  timeGap: 'Tento čas ten den neexistuje (posun hodin). Zvolte jiný.',
  hoursMissing: 'Jiné hodiny potřebují začátek i konec.',
  hoursOrder: 'Konec musí být později než začátek.',
  worker: 'Vyberte zaměstnance, který zastupuje.',
};

/**
 * `kind` is null until the person chooses: nothing is saved on a default (Q10 - an untouched "Uložit" used to close the
 * clinic for today). The date must be a real day the person typed or picked.
 */
export function exceptionProblem(kind: ExceptionKind | null, draft: ScheduleExceptionInput): ExceptionProblem {
  if (dateProblem(draft.date) !== null) return 'date';
  if (kind === null) return 'kind';

  if (kind === 'differentHours') {
    const start = draft.startTime ?? '';
    const end = draft.endTime ?? '';
    if (start === '' || end === '') return 'hoursMissing';
    /* A time inside the spring clock gap does not exist: refuse it, never shift it. */
    if (wallTimeProblem(draft.date, start) !== null || wallTimeProblem(draft.date, end) !== null) return 'timeGap';
    /* HH:mm strings compare in clock order. */
    if (end.slice(0, 5) <= start.slice(0, 5)) return 'hoursOrder';
  }

  if (kind === 'differentWorker' && !draft.workerUserId) return 'worker';

  return null;
}

/**
 * The bookings that day this exception touches, for the confirmation: a closed day touches every booking still
 * expected, different hours the ones that fall outside the new hours. A stand-in or "online off" moves nobody.
 */
export function affectedAppointments(kind: ExceptionKind | null, draft: ScheduleExceptionInput, rows: readonly DayAppointment[]): number {
  if (kind !== 'closed' && kind !== 'differentHours') return 0;
  const open = rows.filter((row) => statusTally(row.status) === 'booked' && pragueDateKey(row.startUtc) === draft.date);
  if (kind === 'closed') return open.length;
  if (!draft.startTime || !draft.endTime) return 0;
  const from = pragueWallClockToInstant(draft.date, draft.startTime.slice(0, 5)).getTime();
  const to = pragueWallClockToInstant(draft.date, draft.endTime.slice(0, 5)).getTime();
  return open.filter((row) => {
    const start = new Date(row.startUtc).getTime();
    const end = new Date(row.endUtc).getTime();
    return start < from || end > to;
  }).length;
}
