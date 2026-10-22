import { appointmentsApi } from '../../../api/appointments';
import { addDaysToDateOnly, pragueDateKey } from '../../../utils/time';
import { MAX_WINDOWS, WINDOW_DAYS, firstFreeAfter, type NearestFree } from './nearestFree';

/**
 * The nearest free start of ONE činnost on ONE calendar, from now: the server's own availability (the desk's list of starts), asked
 * for `WINDOW_DAYS` at a time, at most `MAX_WINDOWS` calls. `null` when nothing is offered that far ahead.
 */
export async function nearestFreeFor(calendarId: string, activityId: string, now: Date = new Date()): Promise<NearestFree | null> {
  let from = pragueDateKey(now);
  for (let i = 0; i < MAX_WINDOWS; i++) {
    const to = addDaysToDateOnly(from, WINDOW_DAYS - 1);
    const slots = await appointmentsApi.getAvailability(calendarId, activityId, from, to, { staffStarts: true });
    const found = firstFreeAfter(slots, now.getTime());
    if (found) return found;
    from = addDaysToDateOnly(to, 1);
  }
  return null;
}

export const NEAREST_TEXT = {
  button: 'Nejbližší volný termín',
  seeking: 'Hledám…',
  none: `Žádný volný termín v příštích ${MAX_WINDOWS * 2} týdnech.`,
  found: (date: string, time: string) => `Nejbližší volný termín: ${date} ${time}`,
  failed: 'Volný termín se nepodařilo zjistit.',
} as const;
