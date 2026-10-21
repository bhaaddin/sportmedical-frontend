/*
 * One row per činnost, never one per booking (reviewer 2.2, owner's words: "aggregate by činnost: which activities occur that
 * day and how many slots - Komplexní prohlídka x10 -> 10 slotů, Základní prohlídka - 2 sloty dnes").
 *
 * A day with 30 people for one complex examination is ONE row with the count, expandable to the 30 people. The board itself
 * still draws every booking as its own card; this is for every place that SUMMARISES a day (the mini calendar's flyout, the
 * agenda lists, the day list, the month tile, the phone agenda).
 *
 * What a slot is here (one rule, no second calculation):
 *   - a BOOKING term (the clinic's own individuals, grouped by the mapper into one term per činnost and start) counts the
 *     people booked in it: `booked`, never its `capacity` - `capacity` of a term with a parallel činnost is the free
 *     parallel seats too (parallel 2 and one patient: capacity 2, booked 1), and a day must not say "2 sloty" for one person;
 *   - a WINDOW (a club's term, a public term, a draft of the planner) counts its `capacity`: the slots the clinic really
 *     works - the planner lays them through the open pieces of the day (`layoutSlots`: opening hours minus lunch), so the
 *     lunch break was never counted and is not subtracted again here.
 */
import { categoryOrFallback, minutesOf, sourceFor } from './context';
import { agendaSlotLabel } from './time';
import type { CategoryId, ClockTime, IsoDate, PlannerContext, PlannerSession } from './types';

export type GroupEntryKind = 'booking' | 'club' | 'term';

export interface GroupEntry {
  id: string;
  date: IsoDate;
  start: ClockTime;
  end: ClockTime;
  kind: GroupEntryKind;
  /** Slots this entry adds to the row. */
  slots: number;
  /** People booked in it (a window: those registered so far). */
  people: number;
  /** Names of the people, where the source knows them (no identity numbers, ever). */
  names: string[];
}

export interface ActivityGroup {
  /** `date|categoryId` for a per-day grouping, `categoryId` otherwise. */
  key: string;
  categoryId: CategoryId;
  name: string;
  /** `#RRGGBB` of the činnost. */
  tone: string;
  /** The day, for a per-day grouping. */
  date: IsoDate | null;
  /** Bookings count each person, a window counts once: "x10". */
  count: number;
  /** Entries behind the row (terms and booking groups). */
  terms: number;
  /** People booked. */
  people: number;
  slots: number;
  /** Planned minutes (sum over the entries; two parallel entries both count). */
  minutes: number;
  start: ClockTime;
  end: ClockTime;
  entries: GroupEntry[];
}

export const isBookingTerm = (s: Pick<PlannerSession, 'appointments'>): boolean => (s.appointments?.length ?? 0) > 0;

/** Slots of one term for a summary: people for bookings, capacity for a window (see the header). */
export function slotsOfSession(s: Pick<PlannerSession, 'appointments' | 'booked' | 'capacity'>): number {
  return isBookingTerm(s) ? Math.max(0, Number(s.booked) || 0) : Math.max(0, Number(s.capacity) || 0);
}

const kindOf = (s: PlannerSession): GroupEntryKind => (isBookingTerm(s) ? 'booking' : sourceFor(s) === 'club' ? 'club' : 'term');

function entryOf(s: PlannerSession): GroupEntry {
  const kind = kindOf(s);
  return {
    id: s.id,
    date: s.date,
    start: s.start,
    end: s.end,
    kind,
    slots: slotsOfSession(s),
    people: Math.max(0, Number(s.booked) || 0),
    names: (s.appointments ?? []).map((a) => a.patientName?.trim() ?? '').filter((n) => n !== ''),
  };
}

/**
 * Groups `sessions` by činnost (and by day when `perDay`). Rows come in the catalogue's order, then unknown činnosti; within
 * a činnost by day. An entry without a činnost (a club window that names none) has no row to stand in and is left out.
 */
export function groupByActivity(
  ctx: Pick<PlannerContext, 'categories'>,
  sessions: readonly PlannerSession[],
  options: { perDay?: boolean } = {},
): ActivityGroup[] {
  const perDay = options.perDay === true;
  const groups = new Map<string, ActivityGroup>();
  for (const s of sessions) {
    if (s.categoryId === '') continue;
    const key = perDay ? `${s.date}|${s.categoryId}` : s.categoryId;
    let g = groups.get(key);
    if (!g) {
      const category = categoryOrFallback(ctx, s.categoryId);
      g = {
        key, categoryId: s.categoryId, name: category.name, tone: category.color, date: perDay ? s.date : null,
        count: 0, terms: 0, people: 0, slots: 0, minutes: 0, start: s.start, end: s.end, entries: [],
      };
      groups.set(key, g);
    }
    const entry = entryOf(s);
    g.entries.push(entry);
    g.terms += 1;
    g.slots += entry.slots;
    g.people += entry.kind === 'booking' ? entry.people : 0;
    g.count += entry.kind === 'booking' ? Math.max(1, entry.people) : 1;
    g.minutes += minutesOf(s);
    if (s.start < g.start) g.start = s.start;
    if (s.end > g.end) g.end = s.end;
  }
  const order = (id: CategoryId): number => {
    const at = ctx.categories.findIndex((c) => c.id === id);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  const rows = [...groups.values()];
  for (const g of rows) g.entries.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return rows.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || order(a.categoryId) - order(b.categoryId) || a.name.localeCompare(b.name, 'cs'));
}

/** "×10" - only when there is more than one, so a lone booking stays "Základní prohlídka". */
export const countMark = (g: Pick<ActivityGroup, 'count'>): string => (g.count > 1 ? `×${g.count}` : '');

/** "10 slotů" / "1 slot" / "2 sloty". */
export const slotsText = (slots: number): string => `${slots} ${agendaSlotLabel(slots)}`;

/** "08:00–17:20". */
export const spanText = (g: Pick<ActivityGroup, 'start' | 'end'>): string => `${g.start}–${g.end}`;

/** The row the owner reads: "Komplexní prohlídka ×10 · 10 slotů". */
export const groupTitle = (g: ActivityGroup): string => [g.name, countMark(g)].filter(Boolean).join(' ');

export interface DaySummary {
  date: IsoDate;
  groups: ActivityGroup[];
  /** Entries of the day, bookings by person. */
  count: number;
  slots: number;
  minutes: number;
}

/** A day of `sessions` as rows per činnost, with the totals the headline needs. */
export function summariseDay(ctx: Pick<PlannerContext, 'categories'>, sessions: readonly PlannerSession[], date: IsoDate): DaySummary {
  const groups = groupByActivity(ctx, sessions.filter((s) => s.date === date));
  return {
    date,
    groups,
    count: groups.reduce((n, g) => n + g.count, 0),
    slots: groups.reduce((n, g) => n + g.slots, 0),
    minutes: groups.reduce((n, g) => n + g.minutes, 0),
  };
}
