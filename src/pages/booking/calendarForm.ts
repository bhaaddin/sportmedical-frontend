import type { CalendarInput } from '../../api/bookingContracts';
import { FIELD_LIMITS, MAX_INT32, PUBLIC_NUMBER_MINIMUMS } from '../../api/fieldLimits';

/*
 * What the calendar form must hold before it is sent.
 *
 * Measured on the dev API (20. 10. 2026): a step of 0 or less, an empty name,
 * a name over 100 or a location over 200 characters, a negative order and a
 * horizon / hold / cancellation lead of 0 or less are all refused - the last
 * three as `scheduling.sort_order_negative`, a code that names the wrong
 * field. Saying so here puts the sentence under the field it is about.
 */

export type CalendarField =
  | 'name'
  | 'location'
  | 'displayStepMinutes'
  | 'sortOrder'
  | 'publicMinimumNoticeMinutes'
  | 'publicHorizonDays'
  | 'publicHoldMinutes'
  | 'publicCancellationHours';

export type CalendarProblems = Partial<Record<CalendarField, string>>;

const PUBLIC_FIELDS = [
  'publicMinimumNoticeMinutes',
  'publicHorizonDays',
  'publicHoldMinutes',
  'publicCancellationHours',
] as const;

export function calendarProblems(draft: CalendarInput): CalendarProblems {
  const problems: CalendarProblems = {};

  if (draft.name.trim() === '') problems.name = 'Vyplňte název.';
  else if (draft.name.trim().length > FIELD_LIMITS.calendarName) {
    problems.name = `Název může mít nejvýše ${FIELD_LIMITS.calendarName} znaků.`;
  }

  if (draft.location.trim().length > FIELD_LIMITS.calendarLocation) {
    problems.location = `Místo může mít nejvýše ${FIELD_LIMITS.calendarLocation} znaků.`;
  }

  if (!Number.isInteger(draft.displayStepMinutes) || draft.displayStepMinutes < 1) {
    problems.displayStepMinutes = 'Krok musí být celé číslo, aspoň 1 minuta.';
  }

  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) {
    problems.sortOrder = 'Pořadí musí být celé číslo od 0.';
  }

  for (const field of PUBLIC_FIELDS) {
    const value = draft[field];
    if (value === null) continue;
    const minimum = PUBLIC_NUMBER_MINIMUMS[field];
    if (!Number.isInteger(value) || value < minimum) {
      problems[field] = minimum === 0 ? 'Zadejte celé číslo od 0, nebo pole nechte prázdné.' : `Zadejte celé číslo od ${minimum}, nebo pole nechte prázdné.`;
    } else if (value > MAX_INT32) {
      problems[field] = 'Číslo je příliš velké.';
    }
  }

  return problems;
}

export const hasCalendarProblems = (problems: CalendarProblems): boolean => Object.keys(problems).length > 0;
