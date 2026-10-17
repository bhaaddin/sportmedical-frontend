/*
 * "Přidat další den" (kept from pick mode, Etapa 12): under a činnost that is still short, the next day with free
 * time after the order's last term is filled with exactly the whole slots its missing players need - never more,
 * the rest of the day stays free for ordinary bookings. Nothing is guessed about the clinic: the days, the opening
 * hours and the lunch break come from the data source's day marks, the busy time from the terms it lists.
 *
 * Pure: the caller reads the days from the source and writes the result through `createInterval`.
 */
import { timeAsMinutes, type DayMark, type IsoDate, type PlannerSession } from '../../model';
import { takeForActivity, moreNeeded, moreNeededLine } from '../../../components/booking/calendar/pickPlan';
import type { FreeBlock } from '../../../components/booking/calendar/pickDays';
import { PLANNER_CALENDAR_ID, PLAN_STEP, type CategoryFigure } from './orderFigures';

/** Days looked at after the last term (the calendar's rule: the next two weeks). */
export const ADD_DAY_HORIZON = 14;

const addDays = (date: IsoDate, n: number): IsoDate => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The free time of one day: the opening hours without the lunch break and without every term of the board. */
export function freeBlocksOfPlannerDay(mark: DayMark | undefined, sessions: readonly PlannerSession[], date: IsoDate): FreeBlock[] {
  if (!mark || mark.closed || !mark.hours) return [];
  const open = timeAsMinutes(mark.hours.from);
  const close = timeAsMinutes(mark.hours.to);
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return [];
  const busy: { start: number; end: number }[] = sessions
    .filter((s) => s.date === date)
    .map((s) => ({ start: timeAsMinutes(s.start), end: timeAsMinutes(s.end) }));
  if (mark.lunch) busy.push({ start: timeAsMinutes(mark.lunch.from), end: timeAsMinutes(mark.lunch.to) });
  const sorted = busy.filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > open && b.start < close).sort((a, b) => a.start - b.start);
  const out: FreeBlock[] = [];
  let cursor = open;
  for (const b of sorted) {
    if (b.start > cursor) out.push({ calendarId: PLANNER_CALENDAR_ID, range: { start: cursor, end: Math.min(b.start, close) } });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < close) out.push({ calendarId: PLANNER_CALENDAR_ID, range: { start: cursor, end: close } });
  return out;
}

export interface AddDayPlan {
  date: IsoDate;
  /** One entry per free stretch used: where it starts and how many whole slots it takes. */
  parts: { start: number; slots: number }[];
  slots: number;
}

/**
 * The first day from `from` on (at most `ADD_DAY_HORIZON` days) whose free time holds at least one slot of the
 * činnost, with what to take from it. null = no such day.
 */
export function planNextDay(input: {
  figure: Pick<CategoryFigure, 'slotMinutes' | 'lanes' | 'remaining' | 'name'>;
  from: IsoDate;
  marks: Readonly<Record<string, DayMark>>;
  sessions: readonly PlannerSession[];
}): AddDayPlan | null {
  const { figure } = input;
  if (figure.remaining <= 0 || !(figure.slotMinutes > 0)) return null;
  for (let i = 0; i < ADD_DAY_HORIZON; i++) {
    const date = addDays(input.from, i);
    const blocks = freeBlocksOfPlannerDay(input.marks[date], input.sessions, date);
    if (blocks.length === 0) continue;
    const take = takeForActivity(blocks, { minutesPerSeat: figure.slotMinutes, parallelCapacity: figure.lanes }, figure.remaining, PLAN_STEP);
    const parts = take.blocks.flatMap((b) => {
      const slots = Math.floor((b.range.end - b.range.start) / figure.slotMinutes + 1e-9);
      return slots > 0 ? [{ start: b.range.start, slots }] : [];
    });
    const slots = parts.reduce((n, p) => n + p.slots, 0);
    if (slots > 0) return { date, parts, slots };
  }
  return null;
}

/** "ještě 46 hráčů ≈ 69 h ≈ 9 celých dní při 1 kalendáři" - what is still needed, for the button's tooltip. */
export function stillNeededLine(figure: Pick<CategoryFigure, 'slotMinutes' | 'lanes' | 'remaining'>, dayMinutes: number | null): string {
  const need = moreNeeded({ minutesPerSeat: figure.slotMinutes, parallelCapacity: figure.lanes, remainingSeats: figure.remaining }, dayMinutes);
  return moreNeededLine(need, 1);
}
