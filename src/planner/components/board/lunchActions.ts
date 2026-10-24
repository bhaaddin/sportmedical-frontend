/*
 * R17 - the writes of the lunch pop-out. A day's lunch is one exception PER CALENDAR on the server; the band on the board is the day's
 * lunch of every calendar that is open and on screen, so a move / delete / restore goes to each of them. Nothing is retried
 * silently: a day where only some calendars took the change says so.
 */
import { lunchExceptionsApi, lunchErrorText, isLunchRouteMissing } from '../../../api/lunchExceptions';
import { LUNCH_TEXT, clockOf, startMinutesOf } from './lunchModel';

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

/** 0 = Sunday, as the working-hours rows count it. */
export const weekdayOf = (day: string): number => new Date(`${day}T12:00:00Z`).getUTCDay();

/** A refusal this side words itself (no period, no lunch on that weekday, the new lunch leaves the day's hours). */
export class WeeklyLunchRefusal extends Error {}

/**
 * Per-weekday lunch (R17): the weekly break of that weekday, in the schedule period that holds the day, for every open calendar -
 * every row of that weekday that has a break gets the new start and keeps its length. The day exceptions stay as they are.
 */
export async function moveWeeklyLunch(targets: readonly LunchTarget[], day: string, startTime: string): Promise<LunchOutcome> {
  const { workingHoursApi } = await import('../../../api/workingHours');
  const dow = weekdayOf(day);
  const start = startMinutesOf(startTime);
  return eachTarget(targets, async (calendarId) => {
    if (start === null) throw new WeeklyLunchRefusal(LUNCH_TEXT.badStart);
    const periods = await workingHoursApi.listPeriods(calendarId);
    const period = periods.find((p) => p.validFrom <= day && (p.validTo === null || p.validTo >= day));
    if (!period) throw new WeeklyLunchRefusal(LUNCH_TEXT.weekly.noPeriod);
    const rows = (await workingHoursApi.listWorkingHours(calendarId, period.id)).filter((r) => r.dayOfWeek === dow && r.breakStart && r.breakEnd);
    if (rows.length === 0) throw new WeeklyLunchRefusal(LUNCH_TEXT.weekly.noLunch);
    for (const r of rows) {
      const length = (startMinutesOf(r.breakEnd!) ?? 0) - (startMinutesOf(r.breakStart!) ?? 0);
      const from = startMinutesOf(r.startTime) ?? 0;
      const to = startMinutesOf(r.endTime) ?? 0;
      if (start < from || start + length > to) throw new WeeklyLunchRefusal(LUNCH_TEXT.outsideHours(clockOf(from), clockOf(to)));
    }
    for (const r of rows) {
      const length = (startMinutesOf(r.breakEnd!) ?? 0) - (startMinutesOf(r.breakStart!) ?? 0);
      await workingHoursApi.updateWorkingHour(calendarId, r.id, {
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        breakStart: clockOf(start),
        breakEnd: clockOf(start + length),
        repeatEveryNWeeks: r.repeatEveryNWeeks,
        weekOffset: r.weekOffset,
        workerUserId: r.workerUserId,
        isActive: r.isActive,
      });
    }
  });
}

/** The sentence after a write: success words, the partial warning, or the first refusal worded by its code. */
export function lunchOutcomeText(outcome: LunchOutcome, success: string): { text: string; tone: 'info' | 'error' } {
  if (outcome.errors.length === 0) return { text: success, tone: 'info' };
  if (outcome.done > 0) return { text: LUNCH_TEXT.partial(outcome.done, outcome.total), tone: 'error' };
  const first = outcome.errors[0];
  return { text: first instanceof WeeklyLunchRefusal ? first.message : lunchErrorText(first), tone: 'error' };
}
