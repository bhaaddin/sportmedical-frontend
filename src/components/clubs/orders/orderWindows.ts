/*
 * One club order = one thing (Etapa 10). The order's WINDOWS ("termíny") are the ClubBlocks it owns; they are never
 * shown as separate reservations. Pure helpers: which windows an order has, how they read, how many minutes they
 * hold, and the range set an `update` must send to drop one window.
 */
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderView, OrderRange } from '../../../api/clubOrders';
import { formatWeekdayDate } from '../../../pages/clubs/clubOrders';
import { ordersRangesOf, pickedCalendarIds, picksFromRanges } from '../../booking/calendar/pickLogic';
import type { PickedTime } from '../../booking/calendar/multiSelect';
import { plural } from '../blockLogic';
import { formatSeats } from '../panel/seats';

/** A date before any club window: used so that "keep the other windows" never drops a past one. */
const LONG_AGO = '0000-01-01';

/** Requested or Confirmed: the orders that still hold (or ask for) calendar time. */
export const isLiveOrder = (order: Pick<ClubOrderView, 'status'>): boolean => order.status === 'Requested' || order.status === 'Confirmed';

/** The order's live windows, earliest first. */
export function orderWindows(order: Pick<ClubOrderView, 'blocks'>): ClubBlockView[] {
  return order.blocks
    .filter((b) => b.status === 'Active')
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || (a.dailyFrom ?? '').localeCompare(b.dailyFrom ?? ''));
}

export const windowRange = (b: ClubBlockView): OrderRange => ({ fromDate: b.fromDate, toDate: b.toDate, dailyFrom: b.dailyFrom, dailyTo: b.dailyTo });

/** "Po 26. 10." for one day, "26.–27. 10." within a month, "30. 10. – 2. 11." across months. */
export function windowDates(from: string, to: string): string {
  if (to === '' || to === from) return formatWeekdayDate(from);
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  return fm === tm ? `${fd}.–${td}. ${fm}.` : `${fd}. ${fm}. – ${td}. ${tm}.`;
}

/** "Po 26. 10. · 08:00–12:00" - the date and the hours of one window. */
export function windowLabel(b: Pick<ClubBlockView, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>): string {
  const dates = windowDates(b.fromDate, b.toDate);
  return b.dailyFrom && b.dailyTo ? `${dates} · ${b.dailyFrom}–${b.dailyTo}` : dates;
}

export const termsWord = (n: number): string => plural(n, ['termín', 'termíny', 'termínů']);

const firstWord = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "Základní 12 · Komplexní 10" - the činnosti by their first word, players only. */
export function shortSplit(order: Pick<ClubOrderView, 'activitySeats'>): string {
  return formatSeats(order.activitySeats.map((a) => ({ activityName: firstWord(a.activityName), seats: a.seats })));
}

const minuteOf = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m === null ? null : Number(m[1]) * 60 + Number(m[2]);
};

const utcDay = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const dayCount = (from: string, to: string): number => Math.max(1, Math.round((utcDay(to) - utcDay(from)) / 86_400_000) + 1);

/** The minutes one window holds (days x its daily hours); null when it has no daily hours. */
export function windowMinutes(b: Pick<ClubBlockView, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>): number | null {
  if (!b.dailyFrom || !b.dailyTo) return null;
  const from = minuteOf(b.dailyFrom);
  const rawTo = b.dailyTo === '23:59' ? 24 * 60 : minuteOf(b.dailyTo);
  if (from === null || rawTo === null || rawTo <= from) return null;
  return dayCount(b.fromDate, b.toDate === '' ? b.fromDate : b.toDate) * (rawTo - from);
}

/** What all live windows hold together; null when any of them is a whole-day window (then the minutes are not known). */
export function heldMinutes(order: Pick<ClubOrderView, 'blocks'>): number | null {
  const windows = orderWindows(order);
  if (windows.length === 0) return 0;
  let total = 0;
  for (const w of windows) {
    const m = windowMinutes(w);
    if (m === null) return null;
    total += m;
  }
  return total;
}

/** The windows as one day-pick each, the same way pick mode shows an order being edited. */
function windowPicks(windows: readonly ClubBlockView[]): PickedTime[] {
  let n = 0;
  return windows.flatMap((b) =>
    b.calendarIds[0] === undefined
      ? []
      : picksFromRanges([windowRange(b)], b.calendarIds[0], (id) => id).map((p) => ({ ...p, id: `w${n++}` })),
  );
}

/**
 * The range set and the calendars an `update` sends so that the order keeps every window but `removeBlockId`.
 * Built exactly as pick mode builds them (same merging), but past windows are kept.
 */
export function rangesWithout(order: Pick<ClubOrderView, 'blocks'>, removeBlockId: string | null): { ranges: OrderRange[]; calendarIds: string[] } {
  const keep = orderWindows(order).filter((b) => b.id !== removeBlockId);
  const picks = windowPicks(keep);
  return { ranges: ordersRangesOf(picks, LONG_AGO), calendarIds: pickedCalendarIds(picks) };
}

/** A window can still be changed while its last day is not over. */
export const windowIsUpcoming = (b: Pick<ClubBlockView, 'toDate' | 'fromDate'>, today: string): boolean => (b.toDate || b.fromDate) >= today;
