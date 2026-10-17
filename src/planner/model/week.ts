/*
 * The centre board: week heading, hour labels, session cards, day and month
 * alternates.
 *
 * Port of `renderWeekHead`, `isInWeek`, `renderWeekEvents` (geometry) and
 * `renderAlternative` (rows / tiles). The prototype's `visualDay` (a hack that
 * placed the first demo week by hand) is deliberately not ported.
 */
import { categoryOrFallback, orderCategoryIds, sourceFor } from './context';
import {
  addDays,
  dateOf,
  dayCode,
  iso,
  monthCells,
  monthNames,
  printable,
  shift,
  startHour,
  weekNames,
  weekNumberLabel,
  weekRangeLabel,
} from './time';
import type { CategoryId, IsoDate, PlannerContext, PlannerSession } from './types';

/** Height in px of the 12 hour timeline at design scale (`TIMELINE_HEIGHT`). */
export const TIMELINE_HEIGHT = 455;

export const isInWeek = (weekStart: IsoDate, date: IsoDate): boolean =>
  date >= weekStart && date < addDays(weekStart, 7);

export interface WeekHeadModel {
  range: string;
  weekNumber: string;
  days: { date: IsoDate; weekName: string; label: string }[];
  hours: { label: string; top: number }[];
}

/** Heading, seven day titles and hour labels ("7:00" … "18:00"). */
export function weekHeadModel(weekStart: IsoDate, window = { startMinutes: 420, endMinutes: 1140 }): WeekHeadModel {
  const first = dateOf(weekStart);
  const startH = window.startMinutes / 60;
  const endH = window.endMinutes / 60;
  const span = endH - startH;
  const hours: WeekHeadModel['hours'] = [];
  for (let h = startH; h < endH; h++) {
    hours.push({ label: `${h}:00`, top: ((h - startH) * TIMELINE_HEIGHT) / span + 11 });
  }
  return {
    range: weekRangeLabel(weekStart),
    weekNumber: weekNumberLabel(weekStart),
    days: Array.from({ length: 7 }, (_, i) => {
      const date = shift(first, i);
      return { date: iso(date), weekName: weekNames[i]!, label: printable(date) };
    }),
    hours,
  };
}

export interface WeekEventModel {
  id: string;
  categoryId: CategoryId;
  col: number;
  /** px from the top of the board */
  top: number;
  height: number;
  compact: boolean;
  /** CSS `left` / `width` exactly as the prototype writes them. */
  left: string;
  width: string;
  name: string;
  iconKey: string;
  tone: string;
  capacityLabel: string;
  timeLabel: string;
  title: string;
  ariaLabel: string;
  source: 'club' | 'public';
}

/** Cards of the week board, filtered like `renderWeekEvents`. */
export function weekEventsModel(
  ctx: PlannerContext,
  weekStart: IsoDate,
  filter: CategoryId | 'all',
): WeekEventModel[] {
  const ordered = orderCategoryIds(ctx);
  const startH = ctx.window.startMinutes / 60;
  const span = (ctx.window.endMinutes - ctx.window.startMinutes) / 60;
  const ws = dateOf(weekStart);
  const out: WeekEventModel[] = [];
  const visible = ctx.sessions.filter(
    (e) =>
      isInWeek(weekStart, e.date) &&
      (sourceFor(e) === 'public' || ordered.includes(e.categoryId)) &&
      (filter === 'all' || e.categoryId === filter),
  );
  for (const e of visible) {
    const col = Math.round((dateOf(e.date).getTime() - ws.getTime()) / 86400000);
    if (col < 0 || col > 6) continue;
    const start = startHour(e.start);
    const end = startHour(e.end);
    const height = Math.max(25, ((end - start) * TIMELINE_HEIGHT) / span);
    const c = categoryOrFallback(ctx, e.categoryId);
    out.push({
      id: e.id,
      categoryId: e.categoryId,
      col,
      top: ((start - startH) * TIMELINE_HEIGHT) / span,
      height,
      compact: height < 52,
      left: `calc(${col} * 100% / 7 + 3px)`,
      width: 'calc(100% / 7 - 6px)',
      name: c.name,
      iconKey: c.iconKey,
      tone: c.color,
      capacityLabel: `${e.capacity} slotů`,
      timeLabel: `${e.start} – ${e.end}`,
      title: `Přetáhnout pro přesun · zatáhnout za horní nebo dolní okraj pro rozšíření · ${c.name} · ${e.capacity} slotů · ${e.start}–${e.end}`,
      ariaLabel: `Přesunout nebo zobrazit ${c.name}, ${e.start} až ${e.end}`,
      source: sourceFor(e),
    });
  }
  return out;
}

/** Sessions the alternates (day / month) list, filtered and chronological. */
function alternateEvents(ctx: PlannerContext, filter: CategoryId | 'all'): PlannerSession[] {
  const ordered = orderCategoryIds(ctx);
  return ctx.sessions
    .filter((e) => (sourceFor(e) === 'public' || ordered.includes(e.categoryId)) && (filter === 'all' || e.categoryId === filter))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export interface DayViewModel {
  heading: string;
  rows: { id: string; timeLabel: string; name: string; occupancy: string }[];
  empty: string | null;
}

/** "Den" view: the list of the selected day. */
export function dayViewModel(ctx: PlannerContext, selectedDate: IsoDate, filter: CategoryId | 'all'): DayViewModel {
  const d = dateOf(selectedDate);
  const rows = alternateEvents(ctx, filter)
    .filter((e) => e.date === selectedDate)
    .map((e) => ({
      id: e.id,
      timeLabel: `${e.start} – ${e.end}`,
      name: categoryOrFallback(ctx, e.categoryId).name,
      occupancy: `${e.booked}/${e.capacity}`,
    }));
  return {
    heading: `${dayCode(selectedDate)} ${printable(d)} ${d.getFullYear()} · Denní přehled`,
    rows,
    empty: rows.length ? null : 'Na vybraný den zatím nejsou vytvořené termíny.',
  };
}

export interface MonthViewModel {
  heading: string;
  tiles: { date: IsoDate; dayNumber: number; otherMonth: boolean; count: number; countLabel: string | null }[];
}

/** "Měsíc" view: 42 tiles, other-month tiles dimmed by the UI. */
export function monthViewModel(ctx: PlannerContext, monthStart: IsoDate, filter: CategoryId | 'all'): MonthViewModel {
  const events = alternateEvents(ctx, filter);
  const first = dateOf(monthStart);
  return {
    heading: `${monthNames[first.getMonth()]} ${first.getFullYear()} · Měsíční přehled`,
    tiles: monthCells(monthStart).map((date) => {
      const d = dateOf(date);
      const count = events.filter((e) => e.date === date).length;
      return {
        date,
        dayNumber: d.getDate(),
        otherMonth: d.getMonth() !== first.getMonth(),
        count,
        countLabel: count ? `${count} termínů` : null,
      };
    }),
  };
}
