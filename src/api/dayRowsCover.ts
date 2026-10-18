/* ══════════════════════════════════════════════════════════════
   A SMALL RANGE IS ANSWERED FROM A BIGGER ONE THAT IS ALREADY HERE

   A screen that shows a week and the mini calendar beside it both ask for a
   calendar's days: the six weeks of the month, the week itself, the next four
   weeks. Every one of those is a separate request, and the week is just a
   piece of the month.

   For an answer made of rows that each belong to a date or a stretch of time
   (the working-hours preview: one row per date; the day's bookings: each on
   its start day; the blocks: each over the days it spans) the piece can be
   cut out of the bigger answer exactly: the rows that lie in the smaller
   range. So:

     - requests that arrive within a few milliseconds of each other for the
       same calendar and whose ranges touch or overlap are sent as ONE request
       for the union (the month and the next four weeks, asked in the same
       render, become one call);
     - a request whose range lies inside one that is held - on its way or
       answered less than COVER_MS ago - is cut out of it and asks nothing;
     - a request that reaches beyond everything held goes to the server as it
       always did.

   The held rows are forgotten after COVER_MS, when anything is written (a
   booking, a rota, an exception - whatever the server accepted), and when the
   request failed.
   ══════════════════════════════════════════════════════════════ */
import { onWriteSucceeded } from './requestPolicy';

/** How long rows already asked for may answer a smaller range. */
export const COVER_MS = 30 * 1000;
/** Requests this close together are merged into one. */
export const MERGE_WINDOW_MS = 8;
/** A merged request never spans more than this many days unless the caller says what its server allows. */
export const MAX_SPAN_DAYS = 366;
const MAX_HELD = 6;

export interface DayRow {
  date: string;
}

export interface CoverRules<T> {
  /** Whether a row belongs to the answer for the days from..to (yyyy-MM-dd, inclusive). Must be what the server does. */
  inRange(row: T, from: string, to: string): boolean;
  /** The widest range the server answers; a merged request never exceeds it. */
  maxSpanDays: number;
}

interface Held<T> {
  from: string;
  to: string;
  at: number;
  rows: Promise<T[]>;
}

interface Waiter<T> {
  from: string;
  to: string;
  resolve: (rows: T[]) => void;
  reject: (error: unknown) => void;
}

interface Batch<T> {
  from: string;
  to: string;
  waiters: Waiter<T>[];
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

/** Ranges that overlap or touch (the next day) and whose union stays within the server's limit. */
function mergeable(a: { from: string; to: string }, b: { from: string; to: string }, maxSpanDays: number): boolean {
  const gap = Math.max(dayNumber(a.from), dayNumber(b.from)) - Math.min(dayNumber(a.to), dayNumber(b.to));
  const span = Math.max(dayNumber(a.to), dayNumber(b.to)) - Math.min(dayNumber(a.from), dayNumber(b.from)) + 1;
  return gap <= 1 && span <= maxSpanDays;
}

/** One row per date (the preview): a row belongs to the days it is dated on. */
export const BY_DATE: CoverRules<DayRow> = {
  inRange: (row, from, to) => row.date >= from && row.date <= to,
  maxSpanDays: MAX_SPAN_DAYS,
};

export function createRangeCover<T>(
  load: (key: string, from: string, to: string) => Promise<T[]>,
  rules: CoverRules<T>,
) {
  const held = new Map<string, Held<T>[]>();
  const pending = new Map<string, Batch<T>[]>();
  onWriteSucceeded(() => held.clear());

  const slice = (rows: Promise<T[]>, from: string, to: string) =>
    rows.then((all) => all.filter((row) => rules.inRange(row, from, to)));

  function flush(key: string, batch: Batch<T>): void {
    pending.set(key, (pending.get(key) ?? []).filter((b) => b !== batch));
    const rows = load(key, batch.from, batch.to);
    const entry: Held<T> = { from: batch.from, to: batch.to, at: Date.now(), rows };
    held.set(key, [entry, ...(held.get(key) ?? [])].slice(0, MAX_HELD));
    rows.then(
      (all) => {
        for (const w of batch.waiters) w.resolve(all.filter((row) => rules.inRange(row, w.from, w.to)));
      },
      (error) => {
        const current = held.get(key);
        if (current) held.set(key, current.filter((h) => h !== entry));
        for (const w of batch.waiters) w.reject(error);
      },
    );
  }

  return {
    read(key: string, from: string, to: string, now = Date.now()): Promise<T[]> {
      const list = (held.get(key) ?? []).filter((h) => now - h.at < COVER_MS);
      const cover = list.find((h) => h.from <= from && h.to >= to);
      held.set(key, list);
      if (cover) return slice(cover.rows, from, to);

      return new Promise<T[]>((resolve, reject) => {
        const waiter: Waiter<T> = { from, to, resolve, reject };
        const open = (pending.get(key) ?? []).find((b) => mergeable(b, waiter, rules.maxSpanDays));
        if (open) {
          open.from = open.from < from ? open.from : from;
          open.to = open.to > to ? open.to : to;
          open.waiters.push(waiter);
          return;
        }
        const batch: Batch<T> = { from, to, waiters: [waiter] };
        pending.set(key, [...(pending.get(key) ?? []), batch]);
        setTimeout(() => flush(key, batch), MERGE_WINDOW_MS);
      });
    },
    clear: () => held.clear(),
  };
}

/** The rows of one date each (the working-hours preview). */
export function createDayRowsCover<T extends DayRow>(load: (key: string, from: string, to: string) => Promise<T[]>) {
  return createRangeCover<T>(load, BY_DATE as CoverRules<T>);
}
