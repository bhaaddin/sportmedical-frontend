/*
 * R24 - putting a club on a time where patients already have bookings.
 *
 * Owner: "When I want to put a club on a time where someone already is, I cannot - I have to move that person first, then do the club."
 * The server refuses (the time is taken). This is the pure side of the one-flow answer: WHICH bookings are in the way, WHERE each could go
 * (the nearest free start of the same činnost and length, outside the club's window, not on top of another proposal) and what to do when
 * a move fails half way (what already moved, and how to put it back). No DOM, no network: the availability answer comes in as data.
 */
import { statusTally, type AvailabilitySlot, type DayAppointment } from '../../../api/bookingContracts';
import type { OrderRange } from '../../../api/clubOrders';
import { pragueDateKey, pragueWallClockToInstant } from '../../../utils/time';

const HHMM = /^(\d{1,2}):(\d{2})/;

export interface ClubWindow {
  /** yyyy-MM-dd, Prague. */
  day: string;
  startUtc: number;
  endUtc: number;
}

const eachDay = (from: string, to: string): string[] => {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let i = 0; i < 62 && cursor <= end; i += 1) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

const clock = (value: string | null | undefined, fallback: string): string => {
  const m = HHMM.exec(value ?? '');
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : fallback;
};

/** The club's windows: every day of every range, over its daily hours (the whole day when it names none). */
export function clubWindowsOf(ranges: readonly Pick<OrderRange, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>[]): ClubWindow[] {
  const out: ClubWindow[] = [];
  for (const r of ranges) {
    if (!r.fromDate || r.toDate < r.fromDate) continue;
    for (const day of eachDay(r.fromDate, r.toDate)) {
      const from = pragueWallClockToInstant(day, clock(r.dailyFrom, '00:00')).getTime();
      const toText = clock(r.dailyTo, '23:59');
      const to = pragueWallClockToInstant(day, toText).getTime() + (toText === '23:59' ? 60_000 : 0);
      if (to > from) out.push({ day, startUtc: from, endUtc: to });
    }
  }
  return out;
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => aStart < bEnd && bStart < aEnd;

/** The bookings (not cancelled) of the club's calendars that sit inside a club window. */
export function collidingBookings(windows: readonly ClubWindow[], calendarIds: readonly string[], appointments: readonly DayAppointment[]): DayAppointment[] {
  const calendars = new Set(calendarIds);
  return appointments
    .filter((a) => a.calendarId !== null && calendars.has(a.calendarId) && statusTally(a.status) !== 'cancelled')
    .filter((a) => {
      const s = Date.parse(a.startUtc);
      const e = Date.parse(a.endUtc);
      return windows.some((w) => overlaps(s, e, w.startUtc, w.endUtc));
    })
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc) || a.id.localeCompare(b.id));
}

export interface ProposalInput {
  booking: Pick<DayAppointment, 'id' | 'calendarId' | 'startUtc' | 'endUtc'>;
  /** The starts the server offers for this činnost on this calendar (any order). */
  slots: readonly Pick<AvailabilitySlot, 'startUtc'>[];
  windows: readonly ClubWindow[];
  /** Places already promised to other bookings of the same step (calendar id + span), so two bookings never get the same slot. */
  taken: readonly { calendarId: string | null; startUtc: number; endUtc: number }[];
  /** Bookings of the same calendar that stay where they are (a proposal may not land on them either). */
  staying?: readonly Pick<DayAppointment, 'calendarId' | 'startUtc' | 'endUtc' | 'status'>[];
}

/** The nearest free start in time to where the booking is now: same length, outside the club windows, on nothing else. null = none. */
export function proposeSlot(input: ProposalInput): string | null {
  const { booking } = input;
  const length = Date.parse(booking.endUtc) - Date.parse(booking.startUtc);
  const here = Date.parse(booking.startUtc);
  const candidates = input.slots
    .map((s) => ({ startUtc: s.startUtc, start: Date.parse(s.startUtc) }))
    .filter((s) => Number.isFinite(s.start) && s.start !== here)
    .sort((a, b) => Math.abs(a.start - here) - Math.abs(b.start - here) || a.start - b.start);
  for (const c of candidates) {
    const end = c.start + length;
    if (input.windows.some((w) => overlaps(c.start, end, w.startUtc, w.endUtc))) continue;
    if (input.taken.some((t) => t.calendarId === booking.calendarId && overlaps(c.start, end, t.startUtc, t.endUtc))) continue;
    if ((input.staying ?? []).some((s) => s.calendarId === booking.calendarId && statusTally(s.status) !== 'cancelled' && overlaps(c.start, end, Date.parse(s.startUtc), Date.parse(s.endUtc)))) continue;
    return c.startUtc;
  }
  return null;
}

/** The days to ask availability for: from the booking's day, forward and back, never before today. */
export function searchSpan(bookingStartUtc: string, today: string, daysEachWay = 14): { from: string; to: string } {
  const day = pragueDateKey(bookingStartUtc);
  const shift = (d: string, n: number) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const from = shift(day, -daysEachWay);
  return { from: from < today ? today : from, to: shift(day, daysEachWay) };
}

export interface MovePlanItem {
  appointmentId: string;
  calendarId: string;
  fromStartUtc: string;
  toStartUtc: string;
  notify: boolean;
}

export interface MoveRun {
  moved: MovePlanItem[];
  failed: { item: MovePlanItem; message: string } | null;
}

/**
 * Moves the plan one after the other and STOPS at the first failure, reporting exactly what already moved. Nothing after a failure is
 * attempted. `move` is the reschedule call; it throws on a refusal.
 */
export async function runMoves(plan: readonly MovePlanItem[], move: (item: MovePlanItem) => Promise<unknown>, describe: (error: unknown) => string): Promise<MoveRun> {
  const moved: MovePlanItem[] = [];
  for (const item of plan) {
    try {
      await move(item);
      moved.push(item);
    } catch (error) {
      return { moved, failed: { item, message: describe(error) } };
    }
  }
  return { moved, failed: null };
}

/** Puts the moved bookings back (last moved first); returns the ones that could NOT be put back. */
export async function revertMoves(moved: readonly MovePlanItem[], back: (item: MovePlanItem) => Promise<unknown>): Promise<MovePlanItem[]> {
  const stuck: MovePlanItem[] = [];
  for (const item of [...moved].reverse()) {
    try {
      await back(item);
    } catch {
      stuck.push(item);
    }
  }
  return stuck;
}

/** Is a refusal the "time is taken" kind (and not a worker clash or an athletes list, which the dialog handles itself)? */
export function isTimeTakenRefusal(error: { status?: number | undefined; code?: string | undefined; message?: string | undefined }): boolean {
  if (error.status === 409) return true;
  return /taken|overlap|conflict|occupied/i.test(error.code ?? '') || /obsazen|kolize|koliduj/i.test(error.message ?? '');
}

export const CONFLICT_TEXT = {
  title: 'V čase klubu jsou rezervace',
  lead: (n: number) => (n === 1 ? 'V čase, který chcete klubu dát, je 1 rezervace.' : `V čase, který chcete klubu dát, jsou ${n} rezervace.`),
  hint: 'Nic se nepřesune, dokud to nepotvrdíte.',
  proposed: 'Navržený nový termín',
  none: 'Není volný termín (stejná činnost, stejná délka)',
  noneBlock: 'Pro některou rezervaci není volný termín, nelze pokračovat. Přesuňte ji ručně.',
  notify: 'Upozornit klienta',
  go: 'Přesunout a pokračovat',
  working: 'Přesouvám…',
  searching: 'Hledám nejbližší volné termíny…',
  moved: (n: number) => (n === 1 ? 'Přesunuta 1 rezervace.' : `Přesunuto: ${n}.`),
  failed: (message: string) => `Přesun se nepodařil: ${message}`,
  alreadyMoved: (lines: string) => `Už přesunuto: ${lines}.`,
  revert: 'Vrátit přesuny',
  reverted: 'Přesuny jsou vráceny.',
  revertStuck: (n: number) => `Nepodařilo se vrátit ${n} rezervací, vraťte je ručně.`,
} as const;
