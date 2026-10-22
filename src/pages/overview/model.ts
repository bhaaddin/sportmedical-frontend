/*
 * Přehled's model (Stage 4, R18): FIVE questions, each answered by one calm block - pure functions over data the page has
 * already read, so every state (loading, failed, empty, ready) is testable without a screen.
 *
 *   1. Dnes                  how many bookings today, who is next, who waits now
 *   2. Vyžaduje pozornost    the top 3 of the attention model only (the clubs' own block is not repeated here)
 *   3. Tento týden           one load chart: 7 bars, today marked
 *   4. Kluby k vyřízení      the count and the top 3
 *   5. Rychlé akce           NOT a block: Nová objednávka / Nový pacient / Hledat are in the top action bar
 *                            (components/shell/ActionBar.tsx), and the screen never offers them twice.
 *
 * One rule runs through all of it: a source that failed is never turned into "all clear". A block whose data did not
 * arrive says so (`status: 'error'`); an empty answer is only drawn as empty when the source really answered.
 */
import type { DayAppointment } from '../../api/bookingContracts';
import { statusName, statusTally } from '../../api/bookingContracts';
import type { AttentionGroup, ClubOrderLike } from '../../ui/shelf/attention';
import { entityTarget } from '../../ui/shelf/entities';
import { addDaysToDateOnly, dayOfWeekOf, formatPragueTime, pragueDateKey } from '../../utils/time';

export type BlockStatus = 'loading' | 'error' | 'ready';

/** How many rows a list block may draw; the rest is one link away ("Zobrazit vše"). */
export const MAX_ROWS = 3;

/** What a source is doing: nothing back yet, failed, or answered (with data). */
export interface Source<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
}

export function statusOf<T>(source: Source<T>): BlockStatus {
  if (source.data !== undefined) return 'ready';
  return source.isError ? 'error' : 'loading';
}

/* ───────────────────────────── the day ───────────────────────────── */

export interface PersonAt {
  id: string;
  /** "14:30" (Prague). */
  time: string;
  name: string;
  /** Empty for a slot with no registered patient: its name is shown, but it is not a link. */
  patientId: string;
}

export interface TodayBlock {
  status: BlockStatus;
  /** Bookings today that stand or have happened (a cancellation and a no-show are not the day's work). */
  total: number;
  /** The first booked visit that has not started yet; null when nobody else is coming. */
  next: PersonAt | null;
  /** Arrived and not done (CheckedIn only), longest waiting first. */
  waiting: PersonAt[];
}

const isWork = (a: DayAppointment): boolean => {
  const tally = statusTally(a.status);
  return tally !== 'cancelled' && tally !== 'noShow';
};

/** The Prague day a booking starts in. */
export const dayOf = (a: DayAppointment): string => pragueDateKey(a.startUtc);

export function todayBlock(
  status: BlockStatus,
  week: readonly DayAppointment[] | undefined,
  now: Date,
  nameOf: (a: DayAppointment) => string,
  registered: (a: DayAppointment) => boolean = (a) => a.patientId !== '',
): TodayBlock {
  if (status !== 'ready' || week === undefined) return { status, total: 0, next: null, waiting: [] };
  const today = pragueDateKey(now);
  const mine = week.filter((a) => dayOf(a) === today);
  const person = (a: DayAppointment): PersonAt => ({
    id: a.id,
    time: formatPragueTime(a.startUtc),
    name: nameOf(a),
    patientId: registered(a) ? a.patientId : '',
  });
  const upcoming = mine
    .filter((a) => statusTally(a.status) === 'booked' && Date.parse(a.endUtc) > now.getTime())
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const waiting = mine
    .filter((a) => statusName(a.status) === 'CheckedIn')
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return {
    status,
    total: mine.filter(isWork).length,
    next: upcoming.length > 0 ? person(upcoming[0]) : null,
    waiting: waiting.map(person),
  };
}

/* ───────────────────────────── attention ───────────────────────────── */

export interface AttentionRow {
  id: string;
  title: string;
  count: number;
  /** Where it is fixed. */
  to: string;
  /** One sentence for the pop-out. */
  summary: string;
  /** The first cases, for the pop-out (never more than three). */
  cases: string[];
}

export interface AttentionBlock {
  status: BlockStatus;
  /** Everything that needs somebody (all groups, the clubs' included - the figure is the honest total). */
  total: number;
  rows: AttentionRow[];
  /** The groups beyond the rows shown: what "Zobrazit vše" opens in its pop-out. */
  rest: AttentionRow[];
  /** Sources that could not be read: while this is > 0 an empty list is NOT "all clear". */
  unreadable: number;
}

/** The groups the Přehled's other blocks already say: the clubs have their own block. */
const OWN_BLOCK: ReadonlySet<string> = new Set(['clubInquiries']);

export function attentionBlock(state: { groups: readonly AttentionGroup[]; loading: boolean; failed: number }): AttentionBlock {
  const groups = state.groups.filter((g) => !OWN_BLOCK.has(g.id));
  const all = groups.map<AttentionRow>((g) => ({
    id: g.id,
    title: g.title,
    count: g.count,
    to: g.action.to,
    summary: g.summary,
    cases: g.items.slice(0, 3).map((i) => `${i.title}${i.detail === '' ? '' : ` - ${i.detail}`}`),
  }));
  const rows = all.slice(0, MAX_ROWS);
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const status: BlockStatus = state.loading ? 'loading' : state.failed > 0 && rows.length === 0 ? 'error' : 'ready';
  return { status, total, rows, rest: all.slice(MAX_ROWS), unreadable: state.failed };
}

/* ───────────────────────────── the week ───────────────────────────── */

export interface WeekDay {
  date: string;
  /** "Po" ... "Ne". */
  label: string;
  /** Bookings that stand or have happened that day. */
  count: number;
  today: boolean;
}

export interface WeekBlock {
  status: BlockStatus;
  days: WeekDay[];
  /** The tallest bar, never 0 (so a bar's height is count / max). */
  max: number;
  total: number;
}

const DAY_LABELS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'] as const;

/** The Monday of the Prague week that holds `date`. */
export function mondayOf(date: string): string {
  const dow = dayOfWeekOf(date);
  return addDaysToDateOnly(date, dow === 0 ? -6 : 1 - dow);
}

export function weekRange(now: Date): { from: string; to: string } {
  const from = mondayOf(pragueDateKey(now));
  return { from, to: addDaysToDateOnly(from, 6) };
}

export function weekBlock(status: BlockStatus, week: readonly DayAppointment[] | undefined, now: Date): WeekBlock {
  const { from } = weekRange(now);
  const today = pragueDateKey(now);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(from, i));
  const counts = new Map<string, number>(dates.map((d) => [d, 0]));
  if (status === 'ready' && week !== undefined) {
    for (const a of week) {
      const d = dayOf(a);
      if (isWork(a) && counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  const days = dates.map<WeekDay>((date) => ({ date, label: DAY_LABELS[dayOfWeekOf(date)], count: counts.get(date) ?? 0, today: date === today }));
  return { status, days, max: Math.max(1, ...days.map((d) => d.count)), total: days.reduce((s, d) => s + d.count, 0) };
}

/* ───────────────────────────── the clubs ───────────────────────────── */

export interface ClubRow {
  id: string;
  clubName: string;
  seats: number;
  /** Date-only the club sent it, or null. */
  since: string | null;
  to: string;
  state?: Record<string, unknown>;
}

export interface ClubsBlock {
  status: BlockStatus;
  count: number;
  rows: ClubRow[];
  more: number;
}

/** The club orders a club has submitted and nobody answered (`Requested`), oldest first - the rule the attention model uses. */
export function clubsBlock(status: BlockStatus, orders: readonly ClubOrderLike[] | undefined): ClubsBlock {
  if (status !== 'ready' || orders === undefined) return { status, count: 0, rows: [], more: 0 };
  const waiting = orders
    .filter((o) => o.status === 'Requested')
    .sort((a, b) => (a.submittedAtUtc ?? '').localeCompare(b.submittedAtUtc ?? ''));
  return {
    status,
    count: waiting.length,
    rows: waiting.slice(0, MAX_ROWS).map((o) => ({
      id: o.id,
      clubName: o.clubName,
      seats: o.totalSeats,
      since: o.submittedAtUtc === null ? null : pragueDateKey(o.submittedAtUtc),
      ...entityTarget({ kind: 'order', id: o.id }),
    })),
    more: Math.max(0, waiting.length - MAX_ROWS),
  };
}
