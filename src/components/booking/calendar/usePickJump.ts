import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Calendar, PreviewDay } from "../../../api/bookingContracts";
import { appointmentsApi } from "../../../api/appointments";
import { workingHoursApi } from "../../../api/workingHours";
import { addDaysToDateOnly, pragueDateKey, type DateOnly } from "../../../utils/time";
import { pragueMinuteOfDay } from "../grid/timeRange";
import { firstBookableDay, freeBlocksOfDay, minutesOfBlocks } from "./pickDays";

/*
 * When "Vyplním sám" starts, the calendar must not stay on a week that is already over. This looks two weeks ahead
 * at the služba's calendars (hours, bookings, blocks) and names the first day with free time: today while there
 * is still some, otherwise the next open day. It runs once per start; `onFound(null)` = nothing in the window.
 */

export const JUMP_DAYS = 14;

export function usePickJump(input: {
  /** A pick has just started (set to a new token per start); null = not looking. */
  token: number | null;
  calendars: readonly Calendar[];
  now: Date;
  onFound: (day: DateOnly | null) => void;
}) {
  const { token, calendars, now, onFound } = input;
  const today = pragueDateKey(now);
  const ids = calendars.map((c) => c.id).join(",");
  const enabled = token !== null && calendars.length > 0;
  const lastAnswered = useRef<number | null>(null);
  const nowMinute = pragueMinuteOfDay(now);

  const query = useQuery({
    queryKey: ["pick-jump", token, today, ids],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const to = addDaysToDateOnly(today, JUMP_DAYS - 1);
      const previews = await Promise.all(
        calendars.map(async (c) => {
          const rows = await workingHoursApi.preview(c.id, today, to);
          return [c.id, new Map(rows.map((row) => [row.date, row] as const))] as const;
        }),
      );
      const appointments = await appointmentsApi.range(today, to, calendars.map((c) => c.id));
      const blocks = await Promise.all(calendars.map(async (c) => [c.id, await appointmentsApi.blocks(c.id, today, to)] as const));
      const byDay = new Map<string, typeof appointments>();
      for (const a of appointments) {
        const key = pragueDateKey(a.startUtc);
        byDay.set(key, [...(byDay.get(key) ?? []), a]);
      }
      const data = {
        calendars,
        previewByCalendar: new Map<string, Map<string, PreviewDay>>(previews),
        appointmentsByDay: byDay,
        blocksByCalendar: new Map(blocks),
        picks: [],
        today,
        nowMinute,
      };
      return firstBookableDay(today, JUMP_DAYS, (day) => minutesOfBlocks(freeBlocksOfDay(day, data)));
    },
  });

  useEffect(() => {
    if (token === null || lastAnswered.current === token) return;
    if (query.isSuccess) {
      lastAnswered.current = token;
      onFound(query.data);
    } else if (query.isError) {
      lastAnswered.current = token;
      onFound(null);
    }
  }, [token, query.isSuccess, query.isError, query.data, onFound]);
}
