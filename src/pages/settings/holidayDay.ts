import type { ClinicHoliday } from '../../api/holidays';
import type { Calendar, ScheduleException, ScheduleExceptionInput } from '../../api/bookingContracts';

/*
 * What the two switches on a holiday actually send.
 *
 * ── "Pracujeme v tento den" ──
 *
 * A holiday is closed by default: the backend shuts every calendar on it and
 * availability offers nothing (DayScheduleRule, `closedBecause: "holiday"`).
 * Switching the day to working writes an amendment with `isHoliday: false`;
 * only then do the calendars' own working hours apply and bookings open.
 * Switching a statutory day back removes the amendment, so the law applies
 * again - rather than writing a second amendment that merely agrees with it.
 *
 * ── "Online objednávky vypnuty" ──
 *
 * The holiday API has no such flag. The per-calendar exception does
 * (`isClosedToPublic`, contract 4.2 v38): open at the desk, not offered on the
 * web. So the switch writes one such exception on every active calendar for
 * that date, and removes them again. A calendar can hold only one exception a
 * day (409), so a calendar that already has a different one that day is named
 * rather than silently skipped.
 *
 * One backend rule makes the order matter: a holiday with ANY exception on it
 * is resolved by the exception, not by the holiday - an online-only exception
 * would reopen a closed holiday at the desk. So closing a holiday again also
 * removes its online-only exceptions.
 */

export type WorkingSwitchAction =
  | { kind: 'save'; isHoliday: boolean; name: string }
  | { kind: 'reset' };

export function workingSwitchAction(holiday: ClinicHoliday, working: boolean): WorkingSwitchAction {
  if (working) {
    // The reason travels with the decision; the holiday's own name says which day it is.
    return { kind: 'save', isHoliday: false, name: holiday.name.trim() || 'Pracujeme' };
  }

  return holiday.isStatutory
    ? { kind: 'reset' }
    : { kind: 'save', isHoliday: true, name: holiday.name.trim() || 'Volno' };
}

/** An exception that does nothing but keep the day off the web. */
export function isOnlineOnlyClosure(exception: ScheduleException): boolean {
  return (
    exception.isClosedToPublic &&
    !exception.isClosed &&
    exception.startTime === null &&
    exception.endTime === null &&
    exception.workerUserId === null
  );
}

export interface CalendarExceptions {
  calendar: Calendar;
  exceptions: readonly ScheduleException[];
}

export type OnlineState = 'open' | 'closed' | 'partly';

/** Whether online booking is off on that date, across the active calendars. */
export function onlineState(date: string, calendars: readonly CalendarExceptions[]): OnlineState {
  const active = calendars.filter((entry) => entry.calendar.isActive);
  const off = active.filter((entry) =>
    entry.exceptions.some((exception) => exception.date === date && exception.isClosedToPublic),
  );

  if (active.length === 0 || off.length === 0) return 'open';
  return off.length === active.length ? 'closed' : 'partly';
}

export interface OnlinePlan {
  create: { calendarId: string; input: ScheduleExceptionInput }[];
  remove: { calendarId: string; id: string }[];
  /** Calendars that already have another exception that day and cannot take a second. */
  blocked: string[];
}

export function onlinePlan(
  date: string,
  name: string,
  calendars: readonly CalendarExceptions[],
  closeOnline: boolean,
): OnlinePlan {
  const plan: OnlinePlan = { create: [], remove: [], blocked: [] };

  for (const { calendar, exceptions } of calendars) {
    const that = exceptions.filter((exception) => exception.date === date);

    if (!closeOnline) {
      that
        .filter(isOnlineOnlyClosure)
        .forEach((exception) => plan.remove.push({ calendarId: calendar.id, id: exception.id }));
      continue;
    }

    if (!calendar.isActive || that.some((exception) => exception.isClosedToPublic)) continue;

    if (that.length > 0) {
      plan.blocked.push(calendar.name);
      continue;
    }

    plan.create.push({
      calendarId: calendar.id,
      input: {
        date,
        isClosed: false,
        startTime: null,
        endTime: null,
        workerUserId: null,
        reason: `Online objednávky vypnuty – ${name}`,
        isClosedToPublic: true,
      },
    });
  }

  return plan;
}
