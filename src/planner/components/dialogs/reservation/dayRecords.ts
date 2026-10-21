/*
 * The real records behind one day of the reservation drawer.
 *
 * A planner `PlannerSession` is a TERM (a stretch of one činnost with a number of places). A real source
 * (`ApiDataSource`) also says what is behind it: the people booked into a standard term (`appointments`, each
 * with its id, calendar, name and price) and, for a club window, its block and order (`clubBlockId`,
 * `clubOrderId`, `clubName`, `clubColorHex`). The drawer lists those as rows, each opening the record it is:
 *
 *   a booking      -> the appointment detail (the dialog the calendar grid opens on a click on a card),
 *   a club window  -> the club order, or the club block when it has no order (`useRecordOpener`).
 *
 * Nothing is fetched for the bookings: they are read from the sessions the planner already holds, so they are as
 * fresh as the board and a write invalidates them with it. Only the MONEY of a club window needs one more read
 * (its athletes carry the prices): `clubBlocksApi.list` for that day, under the key the planner source and the
 * calendar already use, so it is usually a cache hit.
 *
 * The demo source has none of this data (its sessions are plain terms); the drawer then shows its term cards only.
 *
 * Privacy: a patient is named the way the calendar names them (`patientName`); no birth or insurance number is
 * ever in a session.
 */
import { useQuery } from '@tanstack/react-query';
import { clubBlocksApi, type ClubBlockView } from '../../../../api/clubBlocks';
import { shownPrice } from '../../../../components/booking/grid/appointmentPrice';
import { priceWord } from '../../../../components/booking/price/agreedPrice';
import { pragueDateKey } from '../../../../utils/time';
import { categoryOrFallback, dayEvents, sourceFor, type CategoryId, type ClockTime, type IsoDate, type PlannerContext } from '../../../model';
import { usePlannerCtx, usePlannerModelState } from '../../context';

export type DayRecordRef =
  | { type: 'appointment'; appointmentId: string; calendarId: string }
  | { type: 'clubWindow'; clubBlockId: string | null; clubOrderId: string | null; clubId: string | null };

/** Who the booking is for: a club window / club booking, a booking made online, or at the desk. */
export type DayRecordChannel = 'club' | 'online' | 'staff' | 'unknown';

export interface DayRecord {
  key: string;
  ref: DayRecordRef;
  date: IsoDate;
  start: ClockTime;
  end: ClockTime;
  categoryId: CategoryId | null;
  /** The činnost, or for a club window the club. */
  title: string;
  /** The patient / "n zapsáno" of a window; null when there is nothing to add. */
  subtitle: string | null;
  tone: string;
  origin: 'club' | 'public';
  /** A club window (a held stretch) as opposed to a booking. */
  window: boolean;
  channel: DayRecordChannel;
  /** "1 600 Kč" / "bez ceny" - formatted from `agreedPriceCzk ?? listPriceCzk`; "…" while a window's money loads. */
  priceText: string;
  /** "upraveno (ceník 1 600 Kč)" when the agreed price differs from the list. */
  priceCaption: string | null;
  priceCzk: number | null;
  /** People the row stands for: heads of a booking (a group booking of three is 3), 0 for a club window. */
  heads: number;
}

const NEUTRAL_TONE = '#6e91a5';

/** Is this term a club window of the real calendar (as opposed to a term of the order being planned)? */
const isClubWindow = (s: { foreign?: boolean; clubBlockId?: string | null; clubOrderId?: string | null }): boolean =>
  s.foreign === true && (!!s.clubBlockId || !!s.clubOrderId);

/**
 * The records of one day, read from the planner's sessions: one row per booked person of a standard term and
 * one row per club window (a window that the calendar draws in several pieces is one row).
 */
export function dayRecordsOf(ctx: PlannerContext, date: IsoDate): DayRecord[] {
  const records: DayRecord[] = [];
  const windows = new Map<string, DayRecord & { booked: number; capacity: number }>();
  for (const s of dayEvents(ctx, date)) {
    const category = categoryOrFallback(ctx, s.categoryId);
    if (s.appointments?.length) {
      for (const a of s.appointments) {
        const heads = a.heads > 1 ? `${a.heads} osob` : null;
        records.push({
          key: `appointment:${a.id}`,
          ref: { type: 'appointment', appointmentId: a.id, calendarId: a.calendarId },
          date: s.date,
          start: s.start,
          end: s.end,
          categoryId: s.categoryId,
          title: category.name,
          subtitle: [a.patientName, heads].filter(Boolean).join(' · ') || null,
          tone: category.color,
          origin: sourceFor(s),
          window: false,
          channel: 'unknown',
          priceText: priceWord(a.priceCzk),
          priceCaption: null,
          priceCzk: a.priceCzk,
          heads: Math.max(1, a.heads),
        });
      }
    } else if (isClubWindow(s)) {
      const key = `window:${s.clubBlockId ?? s.clubOrderId}`;
      const have = windows.get(key);
      if (have) {
        have.start = have.start < s.start ? have.start : s.start;
        have.end = have.end > s.end ? have.end : s.end;
        have.booked += s.booked;
        have.capacity += s.capacity;
        continue;
      }
      windows.set(key, {
        key,
        ref: { type: 'clubWindow', clubBlockId: s.clubBlockId ?? null, clubOrderId: s.clubOrderId ?? null, clubId: s.clubId ?? null },
        date: s.date,
        start: s.start,
        end: s.end,
        categoryId: null,
        title: s.clubName?.trim() || 'Klub',
        subtitle: null,
        tone: s.clubColorHex ?? NEUTRAL_TONE,
        origin: 'club',
        window: true,
        channel: 'club',
        priceText: '…',
        priceCaption: null,
        priceCzk: null,
        heads: 0,
        booked: s.booked,
        capacity: s.capacity,
      });
    }
  }
  for (const w of windows.values()) {
    const { booked, capacity, ...record } = w;
    records.push({ ...record, subtitle: capacity > 0 ? `${booked} / ${capacity} zapsáno` : `${booked} zapsáno` });
  }
  return records.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.key.localeCompare(b.key));
}

/** The price of a club window for the day: its athletes' prices (`agreedPriceCzk ?? listPriceCzk`). */
export function windowPriceOf(block: ClubBlockView, date: IsoDate): { totalCzk: number | null } {
  const today = block.athletes.filter((a) => a.status !== 'Cancelled' && a.startUtc !== null && pragueDateKey(a.startUtc) === date);
  const priced = today.map((a) => shownPrice(a)).filter((p) => p.amountCzk !== null);
  return { totalCzk: priced.length ? priced.reduce((n, p) => n + (p.amountCzk ?? 0), 0) : null };
}

export interface DayRecordsResult {
  /** `null`: this source has no records to list (the demo). */
  records: DayRecord[] | null;
  /** The source is a real one: the drawer may offer a new booking and say "no bookings" for an empty day. */
  supported: boolean;
}

export function useDayRecords(date: IsoDate | null): DayRecordsResult {
  const ctx = usePlannerCtx();
  const { catalogue } = usePlannerModelState();
  const supported = catalogue ? !catalogue.capabilities.simulateBookings : false;
  const base = supported && date ? dayRecordsOf(ctx, date) : null;
  const needsMoney = !!base?.some((r) => r.window);
  const details = useQuery({
    queryKey: ['club-blocks', 'details', date ?? '', date ?? ''],
    queryFn: () => clubBlocksApi.list({ from: date as IsoDate, to: date as IsoDate }),
    enabled: needsMoney && date !== null,
    staleTime: 15_000,
    retry: false,
  });
  if (!base) return { records: null, supported };
  const blocks = new Map((details.data ?? []).map((b) => [b.id, b]));
  const records = base.map((r) => {
    if (!r.window || r.ref.type !== 'clubWindow') return r;
    if (details.isLoading) return r;
    const block = r.ref.clubBlockId ? blocks.get(r.ref.clubBlockId) : undefined;
    const total = block && date ? windowPriceOf(block, date).totalCzk : null;
    return { ...r, priceCzk: total, priceText: priceWord(total) };
  });
  return { records, supported };
}

/* ------------------------------ grouping for the drawer ------------------------------ */

export interface DayRecordGroup {
  id: 'clubWindows' | 'clubBookings' | 'online' | 'staff' | 'individuals';
  title: string;
  records: DayRecord[];
}

/** The drawer lists the day's records by where they come from; empty groups are left out. */
export function groupDayRecords(records: readonly DayRecord[]): DayRecordGroup[] {
  const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.key.localeCompare(b.key));
  const groups: DayRecordGroup[] = [
    { id: 'clubWindows', title: 'KLUBOVÁ OKNA', records: sorted.filter((r) => r.window) },
    { id: 'clubBookings', title: 'REZERVACE KLUBŮ', records: sorted.filter((r) => !r.window && r.channel === 'club') },
    { id: 'online', title: 'ONLINE REZERVACE', records: sorted.filter((r) => !r.window && r.channel === 'online') },
    { id: 'staff', title: 'REZERVACE NA RECEPCI', records: sorted.filter((r) => !r.window && r.channel === 'staff') },
    { id: 'individuals', title: 'INDIVIDUÁLNÍ REZERVACE', records: sorted.filter((r) => !r.window && r.channel === 'unknown') },
  ];
  return groups.filter((g) => g.records.length > 0);
}

/**
 * The money of the day: the bookings with a price plus the club windows with one. A club athlete who is booked
 * into a window is part of the window, not a booking of its own in the planner's sessions, so nothing is counted
 * twice. Rows without a price add nothing.
 */
export function recordsTotal(records: readonly DayRecord[]): number {
  return records.reduce((n, r) => n + (r.priceCzk ?? 0), 0);
}

/* ------------------------------ folding for the drawer (reviewer 2.2) ------------------------------ */

/** A činnost's several bookings of the day as ONE line, opening to the rows behind it. */
export interface RecordFold {
  key: string;
  categoryId: CategoryId;
  /** "Komplexní prohlídka ×10" */
  title: string;
  tone: string;
  /** People (a booking of three heads is three): the "×N". */
  count: number;
  start: ClockTime;
  end: ClockTime;
  /** The sum of the priced rows ("12 000 Kč"), "bez ceny" when none has a price. */
  priceText: string;
  priceCzk: number | null;
  records: DayRecord[];
}

export type RecordItem = { type: 'record'; record: DayRecord } | { type: 'fold'; fold: RecordFold };

/**
 * The rows of one source group, bookings of one činnost folded (two or more) into a line each; windows and lone bookings stay
 * rows. The rows behind a fold keep their order and every one still opens its own record.
 */
export function foldRecords(records: readonly DayRecord[]): RecordItem[] {
  const by = new Map<string, DayRecord[]>();
  for (const r of records) {
    if (r.window || r.categoryId === null) continue;
    const list = by.get(r.categoryId);
    if (list) list.push(r);
    else by.set(r.categoryId, [r]);
  }
  const items: RecordItem[] = [];
  const done = new Set<string>();
  for (const r of records) {
    const members = r.window || r.categoryId === null ? undefined : by.get(r.categoryId);
    if (!members || members.length < 2) {
      items.push({ type: 'record', record: r });
      continue;
    }
    if (done.has(r.categoryId as string)) continue;
    done.add(r.categoryId as string);
    const priced = members.filter((m) => m.priceCzk !== null);
    const total = priced.length ? priced.reduce((n, m) => n + (m.priceCzk ?? 0), 0) : null;
    const people = members.reduce((n, m) => n + Math.max(1, m.heads), 0);
    items.push({
      type: 'fold',
      fold: {
        key: `fold:${r.categoryId}`,
        categoryId: r.categoryId as CategoryId,
        title: `${r.title} ×${people}`,
        tone: r.tone,
        count: people,
        start: members.map((m) => m.start).sort()[0] as ClockTime,
        end: members.map((m) => m.end).sort().at(-1) as ClockTime,
        priceText: priceWord(total),
        priceCzk: total,
        records: members,
      },
    });
  }
  return items;
}
