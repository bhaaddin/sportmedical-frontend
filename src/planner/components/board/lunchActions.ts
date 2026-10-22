/*
 * R17 - the writes of the lunch pop-out. A day's lunch is one exception PER CALENDAR on the server; the band on the board is the day's
 * lunch of every calendar that is open and on screen, so a move / delete / restore goes to each of them. Nothing is retried
 * silently: a day where only some calendars took the change says so.
 */
import { lunchExceptionsApi, lunchErrorText, isLunchRouteMissing } from '../../../api/lunchExceptions';
import { LUNCH_TEXT } from './lunchModel';

export interface LunchTarget {
  id: string;
  name: string;
}

export interface LunchOutcome {
  done: number;
  total: number;
  errors: unknown[];
  /** The server has no lunch-exception routes (an older build): nothing was written. */
  routesMissing: boolean;
}

async function eachTarget(targets: readonly LunchTarget[], run: (calendarId: string) => Promise<unknown>): Promise<LunchOutcome> {
  const settled = await Promise.allSettled(targets.map((t) => run(t.id)));
  const errors = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected').map((s) => s.reason as unknown);
  return { done: settled.length - errors.length, total: settled.length, errors, routesMissing: errors.length > 0 && errors.every(isLunchRouteMissing) };
}

export const moveLunchTo = (targets: readonly LunchTarget[], day: string, startTime: string, reason?: string): Promise<LunchOutcome> =>
  eachTarget(targets, (id) => lunchExceptionsApi.set(id, day, { kind: 'moved', startTime, ...(reason ? { reason } : {}) }));

export const removeLunchToday = (targets: readonly LunchTarget[], day: string, reason?: string): Promise<LunchOutcome> =>
  eachTarget(targets, (id) => lunchExceptionsApi.set(id, day, { kind: 'removed', ...(reason ? { reason } : {}) }));

export const restoreLunch = (targets: readonly LunchTarget[], day: string): Promise<LunchOutcome> =>
  eachTarget(targets, (id) => lunchExceptionsApi.restore(id, day));

/** The sentence after a write: success words, the partial warning, or the first refusal worded by its code. */
export function lunchOutcomeText(outcome: LunchOutcome, success: string): { text: string; tone: 'info' | 'error' } {
  if (outcome.errors.length === 0) return { text: success, tone: 'info' };
  if (outcome.done > 0) return { text: LUNCH_TEXT.partial(outcome.done, outcome.total), tone: 'error' };
  return { text: lunchErrorText(outcome.errors[0]), tone: 'error' };
}
