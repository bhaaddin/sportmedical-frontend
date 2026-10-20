import type { ScheduleExceptionInput } from '../../api/bookingContracts';

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

export type ExceptionProblem = 'date' | 'hoursMissing' | 'hoursOrder' | 'worker' | null;

export const EXCEPTION_PROBLEM_TEXT: Record<Exclude<ExceptionProblem, null>, string> = {
  date: 'Vyplňte datum.',
  hoursMissing: 'Jiné hodiny potřebují začátek i konec.',
  hoursOrder: 'Konec musí být později než začátek.',
  worker: 'Vyberte zaměstnance, který zastupuje.',
};

export function exceptionProblem(kind: ExceptionKind, draft: ScheduleExceptionInput): ExceptionProblem {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'date';

  if (kind === 'differentHours') {
    const start = draft.startTime ?? '';
    const end = draft.endTime ?? '';
    if (start === '' || end === '') return 'hoursMissing';
    /* HH:mm strings compare in clock order. */
    if (end.slice(0, 5) <= start.slice(0, 5)) return 'hoursOrder';
  }

  if (kind === 'differentWorker' && !draft.workerUserId) return 'worker';

  return null;
}
