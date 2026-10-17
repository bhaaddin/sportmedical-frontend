/*
 * "Nová objednávka" - the toolbar's button: open the booking dialog on the next free slot from
 * now, on the first calendar on screen, exactly as if it had been dragged (the page's
 * `bookNextFree`). The days on screen answer first; only when they cannot, the month ahead is
 * asked for, once per calendar and day (cached 30 s). What is proposed is only what is visibly
 * free - whether it can really be booked is the server's answer in the dialog (6.1).
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../../../api/appointments';
import { workingHoursApi } from '../../../api/workingHours';
import { statusTally, type DayAppointment, type PreviewDay, type TimeBlock } from '../../../api/bookingContracts';
import { dayMark } from '../../../components/booking/grid/dayMarks';
import {
  NEXT_FREE_HORIZON_DAYS,
  nextFreeSlotAcrossDays,
  type DayFacts,
} from '../../../components/booking/grid/nextFreeSlot';
import {
  formatMinutes,
  localDateTime,
  parseTimeOfDay,
  pragueMinuteOfDay,
  spanOnDay,
  touchesDay,
  type MinuteRange,
} from '../../../components/booking/grid/timeRange';
import type { FoundSlot } from '../../../components/booking/NewAppointmentDialog';
import { addDaysToDateOnly, pragueDateKey } from '../../../utils/time';
import type { BoardCalendarData } from './boardCalendar';

export interface NextFreeBooking {
  initialDate: string;
  initialCalendarId: string;
  initialStart?: string;
  initialEnd?: string;
}

function factsOf(
  row: PreviewDay | undefined,
  dayKey: string,
  calendarId: string,
  appointments: readonly DayAppointment[],
  blocks: readonly TimeBlock[],
): DayFacts | undefined {
  if (row === undefined) return undefined;
  const mark = dayMark(undefined, [row]);
  const offers = (row.offeredActivityIds ?? []).length > 0;
  if (mark.closed || !row.isOpen || !offers) return { open: false, bounds: null, busy: [] };
  const busy: MinuteRange[] = [];
  for (const a of appointments) {
    if (a.calendarId !== calendarId || statusTally(a.status) === 'cancelled') continue;
    if (touchesDay(a.startUtc, a.endUtc, dayKey)) busy.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
  }
  for (const b of blocks) {
    if (touchesDay(b.startUtc, b.endUtc, dayKey)) busy.push(spanOnDay(b.startUtc, b.endUtc, dayKey));
  }
  const breakStart = parseTimeOfDay(row.breakStart);
  const breakEnd = parseTimeOfDay(row.breakEnd);
  if (breakStart !== null && breakEnd !== null) busy.push({ start: breakStart, end: breakEnd });
  const workStart = parseTimeOfDay(row.startTime);
  const workEnd = parseTimeOfDay(row.endTime);
  return { open: true, bounds: workStart !== null && workEnd !== null ? { start: workStart, end: workEnd } : null, busy };
}

export function useNextFree(calendar: BoardCalendarData | null) {
  const queryClient = useQueryClient();

  const horizonFor = useCallback(
    (calendarId: string, fromDay: string) =>
      queryClient.fetchQuery({
        queryKey: ['next-free-horizon', calendarId, fromDay],
        queryFn: async () => {
          const to = addDaysToDateOnly(fromDay, NEXT_FREE_HORIZON_DAYS);
          const [rows, appointments, blocks] = await Promise.all([
            workingHoursApi.preview(calendarId, fromDay, to),
            appointmentsApi.range(fromDay, to, [calendarId]),
            appointmentsApi.blocks(calendarId, fromDay, to),
          ]);
          return { rows: new Map(rows.map((r) => [r.date, r])), appointments, blocks };
        },
        staleTime: 30_000,
      }),
    [queryClient],
  );

  const findNextFree = useCallback(
    async (calendarId: string, start: { dayKey: string; minute: number }): Promise<{ dayKey: string; slot: MinuteRange } | null> => {
      if (!calendar) return null;
      const row = calendar.calendarById.get(calendarId);
      const step = row && row.displayStepMinutes > 0 ? row.displayStepMinutes : 30;
      const visible = nextFreeSlotAcrossDays(start, step, (day) =>
        factsOf(calendar.previewByCalendar.get(calendarId)?.get(day), day, calendarId, calendar.appointments, calendar.blocksByCalendar.get(calendarId) ?? []),
      );
      if (visible.kind === 'found') return visible;
      if (visible.kind === 'none') return null;
      try {
        const horizon = await horizonFor(calendarId, start.dayKey);
        const walk = nextFreeSlotAcrossDays(start, step, (day) =>
          factsOf(horizon.rows.get(day), day, calendarId, horizon.appointments, horizon.blocks),
        );
        if (walk.kind === 'found') return walk;
      } catch {
        /* the preview could not be fetched: the dialog opens on today and the server decides */
      }
      return null;
    },
    [calendar, horizonFor],
  );

  /** The prefill for "Nová objednávka"; `null` when no calendar is on screen. */
  const nextFreeBooking = useCallback(async (): Promise<{ prefill: NextFreeBooking; day: string } | null> => {
    const first = calendar?.calendars[0];
    if (!calendar || !first) return null;
    const nowDate = new Date();
    const dayKey = pragueDateKey(nowDate);
    const found = await findNextFree(first.id, { dayKey, minute: pragueMinuteOfDay(nowDate) });
    if (found) {
      return {
        day: found.dayKey,
        prefill: {
          initialDate: found.dayKey,
          initialCalendarId: first.id,
          initialStart: localDateTime(found.dayKey, found.slot.start),
          initialEnd: localDateTime(found.dayKey, found.slot.end),
        },
      };
    }
    return { day: dayKey, prefill: { initialDate: dayKey, initialCalendarId: first.id } };
  }, [calendar, findNextFree]);

  /** "Příští volný termín" on the dialog's slot card: after the moment it shows, exclusive. */
  const findForDialog = useCallback(
    async (after: { date: string; time: string }, calendarId: string): Promise<FoundSlot | null> => {
      const [h, m] = after.time.split(':').map(Number);
      const minute = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0) + 1;
      const found = await findNextFree(calendarId, { dayKey: after.date, minute });
      if (!found) return null;
      return { date: found.dayKey, time: formatMinutes(found.slot.start), end: formatMinutes(found.slot.end) };
    },
    [findNextFree],
  );

  return { nextFreeBooking, findForDialog };
}
