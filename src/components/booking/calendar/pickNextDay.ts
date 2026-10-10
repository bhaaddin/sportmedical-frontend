import type { Calendar, PreviewDay } from "../../../api/bookingContracts";
import { appointmentsApi } from "../../../api/appointments";
import { workingHoursApi } from "../../../api/workingHours";
import { addDaysToDateOnly, pragueDateKey, type DateOnly } from "../../../utils/time";
import type { PickedRange } from "./multiSelect";
import { freeBlocksOfDay, type FreeBlock } from "./pickDays";

/*
 * "Přidat další den" (Etapa 12): the first day from `from` on (up to `days` ahead) that still has free time on the
 * služba's calendars - hours, bookings, blocks and the picks already made taken off. The same reading as the jump at
 * the start of a pick (`usePickJump`), done once on demand. Null when there is no such day, or the server cannot be read.
 */

export const NEXT_DAY_LOOKAHEAD = 14;

export async function findNextFreeDay(input: {
  calendars: readonly Calendar[];
  from: DateOnly;
  days?: number;
  today: DateOnly;
  nowMinute: number;
  picks: readonly PickedRange[];
}): Promise<{ day: DateOnly; blocks: FreeBlock[] } | null> {
  const { calendars, from, today, nowMinute, picks } = input;
  const days = input.days ?? NEXT_DAY_LOOKAHEAD;
  if (calendars.length === 0 || days <= 0) return null;
  const to = addDaysToDateOnly(from, days - 1);
  try {
    const previews = await Promise.all(
      calendars.map(async (c) => {
        const rows = await workingHoursApi.preview(c.id, from, to);
        return [c.id, new Map(rows.map((row) => [row.date, row] as const))] as const;
      }),
    );
    const appointments = await appointmentsApi.range(from, to, calendars.map((c) => c.id));
    const blocks = await Promise.all(calendars.map(async (c) => [c.id, await appointmentsApi.blocks(c.id, from, to)] as const));
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
      picks,
      today,
      nowMinute,
    };
    for (let i = 0; i < days; i += 1) {
      const day = addDaysToDateOnly(from, i);
      const free = freeBlocksOfDay(day, data);
      if (free.length > 0) return { day, blocks: free };
    }
    return null;
  } catch {
    return null;
  }
}
