/*
 * What the week board draws, as plain data (no React): the cards, the club windows and manual
 * blocks, and the shading of each day. The component only turns this into elements, so the rules
 * below are tested as rules.
 *
 * Sources
 *   sessions    `PlannerContext.sessions` through the model's own `weekEventsModel` (filter, names,
 *               tone, labels exactly as the prototype's `renderWeekEvents`); only the vertical box
 *               is recomputed, because the board can be zoomed.
 *   bookings    the real calendar (`BoardCalendarData`), when the page provides it.
 *   windows     the real calendar's blocks: a club's window is ONE block per day across the lunch
 *               (`grid/clubWindows.ts`), a manual block is hatched grey with its reason.
 *   day marks   `PlannerModel.dayMarks`: closed days, working hours, lunch - our colours.
 *
 * Simultaneous cards share their day column in lanes (`layoutLanes`, the old grid's rule): one lane
 * keeps the prototype's exact `left` / `width`.
 */
import { isTerminalStatus, statusTally, type Calendar, type DayAppointment, type TimeBlock } from '../../../api/bookingContracts';
import { shownPrice } from '../../../components/booking/grid/appointmentPrice';
import { drawnBlocksOfDay } from '../../../components/booking/grid/clubWindows';
import { formatMinutes, MINUTES_PER_DAY, parseTimeOfDay, pragueMinuteOfDay, spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import { inFilter } from '../../model/services';
import { lockedDayLook, type LockedDayLook } from '../../../colors/dayLock';
import type { ClubDayItem } from './clubHold';
import type { InquiryRef } from '../../model/inquiries';
import {
  cleanHex,
  clubBlockDates,
  colourOfActivity,
  layoutLanes,
  type Catalogue,
  type DayRange,
} from '../../../components/booking/calendar/model';
import { pragueDateKey } from '../../../utils/time';
import {
  addDays,
  agendaSlotLabel,
  alternateEvents,
  slotsOfSession,
  termWord,
  categoryOrFallback,
  dayViewModel,
  monthViewModel,
  sourceFor,
  weekEventsModel,
  type CategoryId,
  type DayMark,
  type DayMarkColors,
  type IsoDate,
  type PlannerContext,
  type PlannerSession,
} from '../../model';
import { boxOfSpan, cardBox, cardLeftWidth, type BoardGeometry } from './boardGeometry';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** One line of type on a card is ~14 px; the card has 5 px of padding top and bottom. */
export const CARD_LINE_PX = 14;
export const CARD_PADDING_PX = 10;
export const linesThatFit = (heightPx: number): number =>
  Number.isFinite(heightPx) && heightPx > 0 ? Math.floor((heightPx - CARD_PADDING_PX) / CARD_LINE_PX) : 0;

interface CardCommon {
  key: string;
  col: number;
  day: IsoDate;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  compact: boolean;
  lane: number;
  lanes: number;
  /** The calendar's sub-column of the day when the day is split per calendar (reviewer 2.4); 0 of 1 otherwise. */
  sub: number;
  subs: number;
  left: string;
  width: string;
  name: string;
  iconKey: string;
  /** `#RRGGBB` of the činnost. */
  tone: string;
  timeLabel: string;
  ariaLabel: string;
  /** "1 600 Kč" / "bez ceny" (the price to say; whether the card has room is `showPrice`). */
  priceText: string;
  /** The agreed price differs from the list ("upraveno"). */
  priceAdjusted: boolean;
  /** The card is tall enough to carry the price (three lines of type). */
  showPrice: boolean;
  /** ... on a line of its own (four lines). */
  priceOwnLine: boolean;
  /** A zoomed-in card has room for one more line (five lines): booked / capacity, the calendar's name. */
  showMore: boolean;
}

export interface SessionCardModel extends CardCommon {
  kind: 'session';
  session: PlannerSession;
  categoryId: CategoryId;
  capacityLabel: string;
  booked: number;
  capacity: number;
  source: 'club' | 'public';
  /** Same text the prototype writes into `title`. */
  prototypeTitle: string;
}

export interface BookingCardModel extends CardCommon {
  kind: 'booking';
  appointment: DayAppointment;
  calendar: Calendar | undefined;
  /** The name on the row (a registered patient's name is read later, from the cached patient). */
  rowName: string | null;
  activityName: string;
  cancelled: boolean;
  draggable: boolean;
}

export type BoardCardModel = SessionCardModel | BookingCardModel;

export interface BoardOverflowModel {
  key: string;
  col: number;
  sub: number;
  subs: number;
  day: IsoDate;
  top: number;
  height: number;
  left: string;
  width: string;
  /** Keys of the cards folded into the chip. */
  keys: string[];
}

export interface BoardWindowModel {
  key: string;
  kind: 'club' | 'manual';
  col: number;
  /** The calendar's sub-column of the day when the day is split per calendar; 0 of 1 otherwise. */
  sub: number;
  subs: number;
  day: IsoDate;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  left: string;
  width: string;
  label: string;
  timeLabel: string;
  /** Wall-clock minutes the window covers on this day. */
  start: number;
  end: number;
  /** `#RRGGBB`. */
  colour: string;
  block: TimeBlock;
  /** Every block of the calendar in view, to say how far a club's window reaches. */
  allBlocks: TimeBlock[];
  calendarId: string;
  calendarName: string;
  clubDates: DayRange | null;
}

export interface DayShadeModel {
  day: IsoDate;
  col: number;
  closed: boolean;
  /** Reason written on a closed day. */
  closedLabel: string | null;
  /** R6: a public holiday / clinic closure ('holiday', red) or an ordinary day off ('closed', grey); null while the day is open. */
  lock: LockedDayLook | null;
  /** The bookings / terms of a locked day, written as text lines INSIDE the opaque block ("08:00 Základní prohlídka"): no card is drawn, but nobody booked there disappears. */
  hidden: string[];
  /** A day without working hours (and not closed): shaded whole, quietly. */
  noHours: boolean;
  /** Outside working hours: above the opening and below the closing. */
  before: { top: number; height: number } | null;
  after: { top: number; height: number } | null;
  lunch: { top: number; height: number; from: string; to: string; moved?: boolean; original?: { from: string; to: string } } | null;
  /** R17: where the lunch was before it was removed for this day only (drawn as a dashed, clickable ghost). */
  lunchRemoved: { top: number; height: number; from: string; to: string } | null;
}

/** A calendar that does not work on a day the others do: its sub-column is hatched (reviewer 2.4). */
export interface CalendarShadeModel {
  key: string;
  day: IsoDate;
  col: number;
  sub: number;
  subs: number;
  calendarId: string;
  calendarName: string;
  label: string;
}

export interface NowLineModel {
  col: number;
  day: IsoDate;
  minute: number;
  top: number;
  label: string;
  /** Top and height of the two vertical edge lines of today's column. */
  edge: { top: number; height: number };
}

export interface BoardCalendarInput {
  calendars: readonly Calendar[];
  appointments: readonly DayAppointment[];
  blocksByCalendar: ReadonlyMap<string, TimeBlock[]>;
  catalogue: Catalogue;
  mayBook: boolean;
  /** Club windows of this club are drawn as session cards (club planning): skip them. */
  excludeClubId?: string | null;
  /** Windows (club block ids) drawn as session cards of the edited order: skipped, the club's other ones are drawn. */
  excludeClubBlockIds?: ReadonlySet<string>;
  /**
   * Reviewer 2.4: the ids of the calendars each day is split into (one column per calendar, in this order), or null for the
   * one-column week. The caller decides when two or more calendars on screen split; the model only follows it.
   */
  split?: readonly string[] | null;
  /** R2: calendar id -> the calendar whose column it is drawn in (a služba's extra calendars ride in its primary's column). */
  alias?: ReadonlyMap<string, string>;
  /** Does this calendar work that day? Absent = it does. A closed one is hatched in its own sub-column while the day is open. */
  isOpen?: (calendarId: string, day: IsoDate) => boolean;
}

export interface BoardModel {
  days: IsoDate[];
  cards: BoardCardModel[];
  overflow: BoardOverflowModel[];
  /** The cards folded into the "+N" chips (not drawn on the board). */
  folded: BoardCardModel[];
  windows: BoardWindowModel[];
  shades: DayShadeModel[];
  /** Per-calendar hatching of a split week; empty otherwise. */
  calendarShades: CalendarShadeModel[];
  /** The calendars the days are split into, in column order; empty when the week is one column per day. */
  columns: Calendar[];
  nowLine: NowLineModel | null;
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

const weekDays = (weekStart: IsoDate): IsoDate[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

const minutesOfClock = (value: string | null | undefined): number | null => parseTimeOfDay(value ?? null);

function priceFlags(height: number, compact: boolean) {
  const lines = linesThatFit(height);
  const showPrice = !compact && lines >= 3;
  return { showPrice, priceOwnLine: showPrice && lines >= 4, showMore: !compact && lines >= 5 };
}

/** A hex colour with an alpha, for the hatch and the glow. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = cleanHex(hex);
  if (!clean) return hex;
  const n = parseInt(clean.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** `a` mixed over `b` by `amount` (0..1) - the card's dark fill from the činnost colour. */
export function mixHex(a: string, b: string, amount: number): string {
  const x = parseInt((cleanHex(a) ?? '#6e91a5').slice(1), 16);
  const y = parseInt((cleanHex(b) ?? '#001521').slice(1), 16);
  const ch = (shift: number) => Math.round(((x >> shift) & 255) * amount + ((y >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** The CSS variables the prototype's `.schedule-event.<type>` rules set, derived from a colour. */
export function toneVars(hex: string): Record<string, string> {
  const base = cleanHex(hex) ?? '#6e91a5';
  return {
    '--ev-border': base,
    '--ev-bg': mixHex(base, '#001521', 0.3),
    '--ev-bg2': mixHex(base, '#001521', 0.2),
    '--ev-glow': withAlpha(base, 0.46),
    /* light mode's card: the colour as a pale tint (planner.light.extra.css reads these; dark never does) */
    '--ev-bg-lt': mixHex(base, '#FFFFFF', 0.14),
    '--ev-bg2-lt': mixHex(base, '#FFFFFF', 0.08),
  };
}

/* -------------------------------------------------------------------------- */
/* Which sessions the real calendar draws itself                               */
/* -------------------------------------------------------------------------- */

/**
 * A real data source (`ApiDataSource`) also hands out the clinic's own calendar as sessions: bookings grouped
 * into terms (`appointmentIds`) and other clubs' windows (`foreign`). With the real calendar on the board
 * those are drawn from the calendar itself - individual bookings with their patient, price and detail, and
 * windows as blocks - so the sessions stay for the left panels (rings, lists) and are not drawn twice.
 */
export const isCalendarBacked = (s: Pick<PlannerSession, 'appointmentIds' | 'foreign'>): boolean =>
  s.foreign === true || (s.appointmentIds?.length ?? 0) > 0;

/* -------------------------------------------------------------------------- */
/* Cards                                                                       */
/* -------------------------------------------------------------------------- */

function sessionCards(
  ctx: PlannerContext,
  weekStart: IsoDate,
  filter: CategoryId | 'all',
  g: BoardGeometry,
  days: readonly IsoDate[],
  hideCalendarBacked: boolean,
): SessionCardModel[] {
  const out: SessionCardModel[] = [];
  const byId = new Map(ctx.sessions.map((s) => [s.id, s]));
  for (const m of weekEventsModel(ctx, weekStart, filter)) {
    const session = byId.get(m.id);
    if (!session) continue;
    if (hideCalendarBacked && isCalendarBacked(session)) continue;
    const startMinute = minutesOfClock(session.start) ?? 0;
    const endMinute = minutesOfClock(session.end) ?? startMinute;
    const box = cardBox(g, startMinute, endMinute);
    const category = categoryOrFallback(ctx, session.categoryId);
    const price = shownPrice(null, category.priceCzk ?? null);
    out.push({
      kind: 'session',
      key: `session:${m.id}`,
      col: m.col,
      day: days[m.col] ?? session.date,
      startMinute,
      endMinute,
      top: box.top,
      height: box.height,
      compact: box.compact,
      lane: 0,
      lanes: 1,
      sub: 0,
      subs: 1,
      ...cardLeftWidth(m.col, 0, 1),
      name: m.name,
      iconKey: m.iconKey,
      tone: m.tone,
      timeLabel: m.timeLabel,
      ariaLabel: m.ariaLabel,
      priceText: price.text,
      priceAdjusted: false,
      ...priceFlags(box.height, box.compact),
      session,
      categoryId: m.categoryId,
      capacityLabel: `${session.capacity} ${agendaSlotLabel(session.capacity)}`,
      booked: session.booked,
      capacity: session.capacity,
      source: m.source,
      prototypeTitle: m.title,
    });
  }
  return out;
}

function bookingCards(
  ctx: PlannerContext,
  days: readonly IsoDate[],
  filter: CategoryId | 'all',
  g: BoardGeometry,
  calendar: BoardCalendarInput,
): BookingCardModel[] {
  const out: BookingCardModel[] = [];
  const calendarById = new Map(calendar.calendars.map((c) => [c.id, c]));
  const split = calendar.split ?? null;
  const subs = split ? split.length : 1;
  for (const a of calendar.appointments) {
    if (!inFilter(ctx.categories, filter, a.activityId)) continue;
    const day = pragueDateKey(a.startUtc);
    const col = days.indexOf(day);
    if (col < 0) continue;
    const span = spanOnDay(a.startUtc, a.endUtc, day);
    const box = cardBox(g, span.start, Math.max(span.end, span.start + 1));
    const cal = a.calendarId ? calendarById.get(a.calendarId) : undefined;
    const sub = split && a.calendarId ? Math.max(0, split.indexOf(calendar.alias?.get(a.calendarId) ?? a.calendarId)) : 0;
    const category = ctx.categories.find((c) => c.id === a.activityId);
    const tone = colourOfActivity(calendar.catalogue, a.activityId, cal?.color ?? '#6e91a5');
    const price = shownPrice(a, category?.priceCzk ?? null);
    const timeLabel = `${formatMinutes(span.start)} – ${formatMinutes(span.end)}`;
    const rowName = a.patientName?.trim() || null;
    const cancelled = statusTally(a.status) === 'cancelled';
    out.push({
      kind: 'booking',
      key: `booking:${a.id}`,
      col,
      day,
      startMinute: span.start,
      endMinute: span.end,
      top: box.top,
      height: box.height,
      compact: box.compact,
      lane: 0,
      lanes: 1,
      sub,
      subs,
      ...cardLeftWidth(col, 0, 1, sub, subs),
      name: rowName ?? a.activityName,
      iconKey: category?.iconKey ?? 'calendar',
      tone,
      timeLabel,
      ariaLabel: `${rowName ? `${rowName}, ` : ''}${a.activityName}, ${timeLabel}`,
      priceText: price.text,
      priceAdjusted: price.adjusted,
      ...priceFlags(box.height, box.compact),
      appointment: a,
      calendar: cal,
      rowName,
      activityName: a.activityName,
      cancelled,
      draggable: calendar.mayBook && !isTerminalStatus(a.status),
    });
  }
  return out;
}

/** Put the day's cards into lanes (per calendar column when the day is split); past three lanes the rest fold into a "+N" chip. */
function layoutCards(
  cards: BoardCardModel[],
  days: readonly IsoDate[],
  subs = 1,
): { cards: BoardCardModel[]; overflow: BoardOverflowModel[]; folded: BoardCardModel[] } {
  const placedCards: BoardCardModel[] = [];
  const overflow: BoardOverflowModel[] = [];
  const folded: BoardCardModel[] = [];
  for (let col = 0; col < days.length; col++) {
    for (let sub = 0; sub < subs; sub++) {
      /* a card of a plain session (no calendar) is not in any sub-column: it shares the first one's lanes, full width */
      const dayCards = cards.filter((c) => c.col === col && (subs <= 1 ? true : c.subs <= 1 ? sub === 0 : c.sub === sub));
      if (dayCards.length === 0) continue;
      const layout = layoutLanes(
        dayCards.map((c) => ({ id: c.key, start: c.startMinute, end: Math.max(c.endMinute, c.startMinute + 1) })),
      );
      for (const c of dayCards) {
        const p = layout.placed.get(c.key);
        if (!p) {
          folded.push(c); // folded into a "+N" chip
          continue;
        }
        placedCards.push({ ...c, lane: p.lane, lanes: p.lanes, ...cardLeftWidth(c.col, p.lane, p.lanes, c.sub, c.subs) });
      }
      for (const chip of layout.overflow) {
        const first = dayCards.find((c) => c.key === chip.ids[0])!;
        const inChip = dayCards.filter((c) => chip.ids.includes(c.key));
        const top = Math.min(...inChip.map((c) => c.top));
        const bottom = Math.max(...inChip.map((c) => c.top + c.height));
        overflow.push({
          key: chip.key,
          col,
          sub,
          subs,
          day: first.day,
          top,
          height: Math.max(18, bottom - top),
          ...cardLeftWidth(col, chip.lane, chip.lanes, sub, subs),
          keys: chip.ids,
        });
      }
    }
  }
  return { cards: placedCards, overflow, folded };
}

/* -------------------------------------------------------------------------- */
/* Windows (club windows, manual blocks)                                       */
/* -------------------------------------------------------------------------- */

function windowModels(
  days: readonly IsoDate[],
  marks: Readonly<Record<string, DayMark>>,
  g: BoardGeometry,
  calendar: BoardCalendarInput,
  fallbackColour: string,
): BoardWindowModel[] {
  const out: BoardWindowModel[] = [];
  const split = calendar.split ?? null;
  const subs = split ? split.length : 1;
  for (let col = 0; col < days.length; col++) {
    const day = days[col]!;
    const lunchFrom = minutesOfClock(marks[day]?.lunch?.from);
    const lunchTo = minutesOfClock(marks[day]?.lunch?.to);
    const lunch: MinuteRange | null = lunchFrom !== null && lunchTo !== null ? { start: lunchFrom, end: lunchTo } : null;
    const seenClub = new Set<string>();
    const dayWindows: Omit<BoardWindowModel, 'lane' | 'lanes' | 'left' | 'width'>[] = [];
    for (const cal of calendar.calendars) {
      const all = calendar.blocksByCalendar.get(cal.id) ?? [];
      const blocks = all.filter((b) => touchesDay(b.startUtc, b.endUtc, day));
      if (blocks.length === 0) continue;
      for (const { block, span } of drawnBlocksOfDay(blocks, day, lunch)) {
        const club = block.kind === 'club';
        if (club && calendar.excludeClubId && block.clubId === calendar.excludeClubId) continue;
        if (club && calendar.excludeClubBlockIds && block.clubBlockId && calendar.excludeClubBlockIds.has(block.clubBlockId)) continue;
        /* the same club window in two calendars is ONE window on a one-column day, and one in each column on a split day */
        if (club && !split) {
          const key = `${block.clubBlockId ?? block.id}|${span.start}|${span.end}`;
          if (seenClub.has(key)) continue;
          seenClub.add(key);
        }
        const box = boxOfSpan(g, span.start, span.end);
        if (box.height <= 0) continue;
        const label = club ? block.clubName ?? 'Blok klubu' : block.reason || 'Blokováno';
        dayWindows.push({
          key: `window:${cal.id}:${block.id}:${day}`,
          kind: club ? 'club' : 'manual',
          col,
          sub: split ? Math.max(0, split.indexOf(calendar.alias?.get(cal.id) ?? cal.id)) : 0,
          subs,
          day,
          top: box.top,
          height: box.height,
          label,
          timeLabel: `${formatMinutes(span.start)}–${formatMinutes(span.end)}`,
          start: span.start,
          end: span.end,
          colour: club ? cleanHex(block.colorHex) ?? fallbackColour : fallbackColour,
          block,
          allBlocks: all,
          calendarId: cal.id,
          calendarName: cal.name,
          clubDates: club ? clubBlockDates(all, block.clubBlockId, block) : null,
        });
      }
    }
    if (dayWindows.length === 0) continue;
    for (let sub = 0; sub < subs; sub++) {
      const inColumn = dayWindows.filter((w) => w.sub === sub);
      if (inColumn.length === 0) continue;
      const layout = layoutLanes(
        inColumn.map((w, i) => ({
          id: String(i),
          start: Math.round(w.top),
          end: Math.max(Math.round(w.top + w.height), Math.round(w.top) + 1),
        })),
        8,
      );
      inColumn.forEach((w, i) => {
        const p = layout.placed.get(String(i)) ?? { lane: 0, lanes: 1 };
        out.push({ ...w, lane: p.lane, lanes: p.lanes, ...cardLeftWidth(w.col, p.lane, p.lanes, w.sub, w.subs) });
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Day shading and the now-line                                                */
/* -------------------------------------------------------------------------- */

function dayShades(days: readonly IsoDate[], marks: Readonly<Record<string, DayMark>>, g: BoardGeometry, holidayColor?: string | null, hiddenOn?: ReadonlyMap<IsoDate, string[]>): DayShadeModel[] {
  const out: DayShadeModel[] = [];
  days.forEach((day, col) => {
    const mark = marks[day];
    if (!mark) return;
    const from = minutesOfClock(mark.hours?.from);
    const to = minutesOfClock(mark.hours?.to);
    const hasHours = from !== null && to !== null && to > from;
    const lunchFrom = minutesOfClock(mark.lunch?.from);
    const lunchTo = minutesOfClock(mark.lunch?.to);
    const lunch =
      !mark.closed && hasHours && lunchFrom !== null && lunchTo !== null && lunchTo > lunchFrom
        ? { ...boxOfSpan(g, lunchFrom, lunchTo), from: mark.lunch!.from, to: mark.lunch!.to, ...(mark.lunch!.moved ? { moved: true } : {}), ...(mark.lunch!.original ? { original: mark.lunch!.original } : {}) }
        : null;
    const removedFrom = minutesOfClock(mark.lunchRemoved?.from);
    const removedTo = minutesOfClock(mark.lunchRemoved?.to);
    const lunchRemoved =
      !mark.closed && hasHours && removedFrom !== null && removedTo !== null && removedTo > removedFrom
        ? { ...boxOfSpan(g, removedFrom, removedTo), from: mark.lunchRemoved!.from, to: mark.lunchRemoved!.to }
        : null;
    const before = !mark.closed && hasHours && from! > g.startMinutes ? boxOfSpan(g, g.startMinutes, from!) : null;
    const after = !mark.closed && hasHours && to! < g.endMinutes ? boxOfSpan(g, to!, g.endMinutes) : null;
    out.push({
      day,
      col,
      closed: mark.closed,
      closedLabel: mark.closed ? (mark.label?.trim() || 'Zavřeno') : null,
      lock: mark.closed ? lockedDayLook(mark, holidayColor) : null,
      hidden: mark.closed ? (hiddenOn?.get(day) ?? []) : [],
      noHours: !mark.closed && !hasHours,
      before,
      after,
      lunch,
      lunchRemoved,
    });
  });
  return out;
}

/** A calendar closed on a day that is open for the clinic: its sub-column is hatched ("Zavřeno"). */
function calendarShades(
  days: readonly IsoDate[],
  marks: Readonly<Record<string, DayMark>>,
  calendars: readonly Calendar[],
  isOpen: ((calendarId: string, day: IsoDate) => boolean) | undefined,
): CalendarShadeModel[] {
  if (!isOpen) return [];
  const out: CalendarShadeModel[] = [];
  days.forEach((day, col) => {
    if (marks[day]?.closed) return; /* a closed day is hatched whole already */
    calendars.forEach((cal, sub) => {
      if (isOpen(cal.id, day)) return;
      out.push({ key: `calshade:${cal.id}:${day}`, day, col, sub, subs: calendars.length, calendarId: cal.id, calendarName: cal.name, label: 'Zavřeno' });
    });
  });
  return out;
}

function nowLineModel(
  days: readonly IsoDate[],
  marks: Readonly<Record<string, DayMark>>,
  g: BoardGeometry,
  today: IsoDate,
  nowMinute: number,
): NowLineModel | null {
  const col = days.indexOf(today);
  if (col < 0) return null;
  const mark = marks[today];
  if (!mark) return null;
  const rows = mark.hours ? [{ isOpen: true, startTime: mark.hours.from, endTime: mark.hours.to }] : [];
  /* The rules of `grid/nowLine.ts` (a working day, inside its hours), with the day and minute given. */
  const span = rows.length
    ? { start: minutesOfClock(rows[0]!.startTime) ?? 0, end: minutesOfClock(rows[0]!.endTime) ?? 0 }
    : null;
  if (mark.closed || !span || span.end <= span.start) return null;
  if (nowMinute < span.start || nowMinute >= span.end) return null;
  const clampedStart = Math.max(span.start, g.startMinutes);
  const clampedEnd = Math.min(span.end, g.endMinutes);
  const top = (nowMinute - g.startMinutes) * g.pxPerMinute;
  if (nowMinute < g.startMinutes || nowMinute >= g.endMinutes) return null;
  return {
    col,
    day: today,
    minute: nowMinute,
    top,
    label: formatMinutes(nowMinute),
    edge: { top: (clampedStart - g.startMinutes) * g.pxPerMinute, height: Math.max(0, (clampedEnd - clampedStart) * g.pxPerMinute) },
  };
}

/* -------------------------------------------------------------------------- */
/* The model                                                                   */
/* -------------------------------------------------------------------------- */

export interface BuildBoardInput {
  ctx: PlannerContext;
  weekStart: IsoDate;
  filter: CategoryId | 'all';
  geometry: BoardGeometry;
  dayMarks: Readonly<Record<string, DayMark>>;
  dayMarkColors: DayMarkColors;
  /** Real calendar data; `null` in the lab / demo. */
  calendar: BoardCalendarInput | null;
  /** Wall-clock minute of the now-line (Prague). */
  nowMinute: number;
}

/** Wall-clock minute of an instant, for the page's clock. */
export const minuteNow = (now: Date): number => pragueMinuteOfDay(now);

export function buildBoardModel(input: BuildBoardInput): BoardModel {
  const { ctx, weekStart, filter, geometry: g, dayMarks, calendar } = input;
  const days = weekDays(weekStart);
  /* R6: a locked day (holiday / closure / day off) is ONE opaque block - no card, window or hour line is drawn on it. */
  const lockedDays = new Set(days.filter((d) => dayMarks[d]?.closed));
  const hiddenOn = new Map<IsoDate, string[]>();
  const unlocked = <T extends { day: IsoDate; timeLabel: string; name: string }>(card: T): boolean => {
    if (!lockedDays.has(card.day)) return true;
    hiddenOn.set(card.day, [...(hiddenOn.get(card.day) ?? []), `${card.timeLabel} ${card.name}`]);
    return false;
  };
  const sessions = sessionCards(ctx, weekStart, filter, g, days, calendar !== null).filter(unlocked);
  const bookings = (calendar ? bookingCards(ctx, days, filter, g, calendar) : []).filter(unlocked);
  const split = calendar?.split ?? null;
  const columns = split ? split.map((id) => calendar!.calendars.find((c) => c.id === id)).filter((c): c is Calendar => c !== undefined) : [];
  const laid = layoutCards([...sessions, ...bookings], days, split ? split.length : 1);
  const windows = calendar ? windowModels(days, dayMarks, g, calendar, '#6e91a5').filter((w) => !lockedDays.has(w.day)) : [];
  return {
    days,
    cards: laid.cards,
    overflow: laid.overflow,
    folded: laid.folded,
    windows,
    shades: dayShades(days, dayMarks, g, input.dayMarkColors?.holiday, hiddenOn),
    calendarShades: split && calendar ? calendarShades(days, dayMarks, columns, calendar.isOpen) : [],
    columns,
    nowLine: nowLineModel(days, dayMarks, g, ctx.today, input.nowMinute),
  };
}

export { sourceFor };

/* -------------------------------------------------------------------------- */
/* Day and month alternates (`renderAlternative`)                              */
/* -------------------------------------------------------------------------- */

export interface DayRowModel {
  key: string;
  kind: 'session' | 'booking';
  /** Id of the session / appointment. */
  id: string;
  sortStart: number;
  timeLabel: string;
  name: string;
  sub: string | null;
  /** "6/8" for a session, the status word for a booking. */
  tail: string;
  priceText: string | null;
  /** The činnost's colour (`#RRGGBB`) for the phone's list; null when the činnost is unknown. */
  colour: string | null;
  /** The činnost the row is of (what rows are summed by, reviewer 2.2); null when it has none. */
  categoryId: string | null;
  /** Slots the row adds to a summary: the people of a booking (heads), the capacity of a term. */
  slots: number;
}

export interface DayListModel {
  heading: string;
  rows: DayRowModel[];
  empty: string | null;
}

/**
 * Rows of one činnost folded into one (reviewer 2.2): "Komplexní prohlídka ×10 · 10 slotů", expandable to the rows behind it.
 * Bookings and terms are folded apart (a club's window is not an individual's booking); a lone row stays what it is.
 */
export interface DayRowGroup {
  key: string;
  kind: 'booking' | 'session';
  categoryId: string;
  name: string;
  colour: string | null;
  /** People for bookings, terms for terms. */
  count: number;
  slots: number;
  sortStart: number;
  /** "08:00 – 17:00". */
  timeLabel: string;
  rows: DayRowModel[];
}

export type DayListItem = { type: 'row'; row: DayRowModel } | { type: 'group'; group: DayRowGroup };

/** The first and the last minute of a "HH:mm – HH:mm" label. */
const spanOfLabel = (label: string): [string, string] => {
  const [from = '', to = ''] = label.split('–').map((part) => part.trim());
  return [from, to];
};

/** The Den list as items: a činnost with several bookings (or several terms) is one group, everything else a row. */
export function groupDayRows(rows: readonly DayRowModel[]): DayListItem[] {
  const by = new Map<string, DayRowModel[]>();
  for (const r of rows) {
    if (r.categoryId === null) continue;
    const key = `${r.kind}|${r.categoryId}`;
    const list = by.get(key);
    if (list) list.push(r);
    else by.set(key, [r]);
  }
  const folded = new Map<string, DayRowGroup>();
  for (const [key, members] of by) {
    if (members.length < 2) continue;
    const first = members[0]!;
    let from = '99:99';
    let to = '';
    for (const m of members) {
      const [a, b] = spanOfLabel(m.timeLabel);
      if (a !== '' && a < from) from = a;
      if (b > to) to = b;
    }
    folded.set(key, {
      key: `group:${key}`,
      kind: first.kind === 'booking' ? 'booking' : 'session',
      categoryId: first.categoryId as string,
      name: first.kind === 'booking' ? (first.sub ?? first.name) : first.name,
      colour: first.colour,
      /* people for bookings (a booking of three heads is three), terms for terms */
      count: first.kind === 'booking' ? members.reduce((n, m) => n + m.slots, 0) : members.length,
      slots: members.reduce((n, m) => n + m.slots, 0),
      sortStart: Math.min(...members.map((m) => m.sortStart)),
      timeLabel: `${from} – ${to}`,
      rows: members,
    });
  }
  const items: DayListItem[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    const key = r.categoryId === null ? null : `${r.kind}|${r.categoryId}`;
    const group = key === null ? undefined : folded.get(key);
    if (group === undefined) {
      items.push({ type: 'row', row: r });
    } else if (!placed.has(group.key)) {
      placed.add(group.key);
      items.push({ type: 'group', group });
    }
  }
  return items.sort((a, b) => (a.type === 'row' ? a.row.sortStart : a.group.sortStart) - (b.type === 'row' ? b.row.sortStart : b.group.sortStart));
}

/** The "Den" list: the sessions of the day (the prototype's rows) with the day's bookings among them. */
export function dayListModel(
  ctx: PlannerContext,
  selectedDate: IsoDate,
  filter: CategoryId | 'all',
  bookings: readonly DayAppointment[],
  statusWord: (a: DayAppointment) => string,
  hideCalendarBacked: boolean,
): DayListModel {
  const base = dayViewModel(ctx, selectedDate, filter);
  const byId = new Map(ctx.sessions.map((s) => [s.id, s]));
  const rows: DayRowModel[] = [];
  for (const r of base.rows) {
    const session = byId.get(r.id);
    if (!session) continue;
    if (hideCalendarBacked && isCalendarBacked(session)) continue;
    const category = categoryOrFallback(ctx, session.categoryId);
    rows.push({
      key: `session:${r.id}`,
      kind: 'session',
      id: r.id,
      sortStart: minutesOfClock(session.start) ?? 0,
      timeLabel: r.timeLabel,
      name: r.name,
      sub: null,
      tail: r.occupancy,
      priceText: shownPrice(null, category.priceCzk ?? null).text,
      colour: cleanHex(category.color),
      categoryId: session.categoryId === '' ? null : session.categoryId,
      slots: slotsOfSession(session),
    });
  }
  for (const a of bookings) {
    if (pragueDateKey(a.startUtc) !== selectedDate) continue;
    if (!inFilter(ctx.categories, filter, a.activityId)) continue;
    const span = spanOnDay(a.startUtc, a.endUtc, selectedDate);
    const category = ctx.categories.find((c) => c.id === a.activityId);
    rows.push({
      key: `booking:${a.id}`,
      kind: 'booking',
      id: a.id,
      sortStart: span.start,
      timeLabel: `${formatMinutes(span.start)} – ${formatMinutes(span.end)}`,
      name: a.patientName?.trim() || a.activityName,
      sub: a.patientName?.trim() ? a.activityName : null,
      tail: statusWord(a),
      priceText: shownPrice(a, category?.priceCzk ?? null).text,
      colour: cleanHex(category?.color),
      categoryId: a.activityId || null,
      slots: a.headcount && a.headcount > 0 ? a.headcount : 1,
    });
  }
  rows.sort((a, b) => a.sortStart - b.sortStart || a.key.localeCompare(b.key));
  return { heading: base.heading, rows, empty: rows.length ? null : base.empty };
}

export interface MonthTileModel {
  date: IsoDate;
  dayNumber: number;
  otherMonth: boolean;
  count: number;
  countLabel: string | null;
  /** Reason the day is closed (holiday ...), from the day marks. */
  flag: string | null;
  /** R6: the locked day's look (holiday red / closed grey) - the tile is drawn as the same opaque block; null while the day is open. */
  lock: LockedDayLook | null;
  /** Club inquiries (orders that block no time yet) asking for or offering this day. */
  inquiries: InquiryRef[];
  /** Every calendar on screen is blocked for the whole day by hand ("Zablokovat celé dny"). */
  blocked: boolean;
  /** The windows of clubs on this day ("FK Slaný · 08:00–16:00"), one line each - the club order shows in the month. */
  clubs: string[];
  /** R13: the same windows with the club's colour, the order code and the hold state (the tile draws them as hatched, locked bars). */
  clubItems: ClubDayItem[];
  /** The day by činnost (reviewer 2.2): "Komplexní prohlídka ×10", not a count of terms; the order of the činnosti. */
  activities: TileActivity[];
  /** The day by calendar when the week splits per calendar (reviewer 2.4): a count under each calendar's chip; empty otherwise. */
  calendars: TileCalendar[];
}

/** One calendar of a split month: how many bookings the day has in it. */
export interface TileCalendar {
  id: string;
  name: string;
  colour: string | null;
  count: number;
}

/** One činnost of a day as the month tile sums it: people for bookings, terms for terms; slots as the summaries count them. */
export interface TileActivity {
  categoryId: string;
  name: string;
  colour: string | null;
  count: number;
  slots: number;
}

export interface MonthListModel {
  heading: string;
  tiles: MonthTileModel[];
}

/** The "Měsíc" matrix: terms and bookings counted per tile, closed days named. */
export function monthTilesModel(
  ctx: PlannerContext,
  calendarMonth: IsoDate,
  filter: CategoryId | 'all',
  bookings: readonly DayAppointment[],
  dayMarks: Readonly<Record<string, DayMark>>,
  hideCalendarBacked: boolean,
  extras: {
    inquiries?: ReadonlyMap<string, InquiryRef[]>;
    blockedDays?: ReadonlySet<string>;
    clubLines?: ReadonlyMap<string, string[]>;
    clubItems?: ReadonlyMap<string, ClubDayItem[]>;
    /** R6: the holiday colour of the display settings (the default red when none). */
    holidayColor?: string | null;
    /** The calendars the days are split into (reviewer 2.4): each tile counts its bookings per calendar. */
    calendarColumns?: readonly Pick<Calendar, 'id' | 'name' | 'color'>[] | null;
  } = {},
): MonthListModel {
  const base = monthViewModel(ctx, calendarMonth, filter);
  const publicIds = hideCalendarBacked ? new Set(ctx.sessions.filter(isCalendarBacked).map((s) => s.id)) : null;
  const extra = new Map<string, number>();
  for (const a of bookings) {
    if (!inFilter(ctx.categories, filter, a.activityId)) continue;
    const day = pragueDateKey(a.startUtc);
    extra.set(day, (extra.get(day) ?? 0) + 1);
  }
  /* The day's činnosti: the sessions the tile counts plus the real bookings, summed per činnost (one rule: groupByActivity's). */
  const mix = new Map<string, Map<string, TileActivity>>();
  const addTo = (day: string, id: string, name: string, colour: string | null, count: number, slots: number) => {
    let perDay = mix.get(day);
    if (!perDay) mix.set(day, (perDay = new Map()));
    const have = perDay.get(id);
    if (have) {
      have.count += count;
      have.slots += slots;
    } else perDay.set(id, { categoryId: id, name, colour, count, slots });
  };
  for (const e of alternateEvents(ctx, filter)) {
    if (e.categoryId === '' || (publicIds && publicIds.has(e.id))) continue;
    const category = categoryOrFallback(ctx, e.categoryId);
    addTo(e.date, e.categoryId, category.name, cleanHex(category.color), 1, slotsOfSession(e));
  }
  for (const a of bookings) {
    if (!inFilter(ctx.categories, filter, a.activityId)) continue;
    const category = ctx.categories.find((c) => c.id === a.activityId);
    const heads = a.headcount && a.headcount > 0 ? a.headcount : 1;
    addTo(pragueDateKey(a.startUtc), a.activityId, category?.name ?? a.activityName, cleanHex(category?.color), heads, heads);
  }
  const order = (id: string) => {
    const at = ctx.categories.findIndex((c) => c.id === id);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  const columns = extras.calendarColumns ?? null;
  const perCalendar = new Map<string, Map<string, number>>();
  if (columns) {
    for (const a of bookings) {
      if (!inFilter(ctx.categories, filter, a.activityId)) continue;
      if (!a.calendarId) continue;
      const day = pragueDateKey(a.startUtc);
      let row = perCalendar.get(day);
      if (!row) perCalendar.set(day, (row = new Map()));
      row.set(a.calendarId, (row.get(a.calendarId) ?? 0) + (a.headcount && a.headcount > 0 ? a.headcount : 1));
    }
  }
  const hidden = new Map<string, number>();
  if (publicIds) {
    for (const s of ctx.sessions) {
      if (!publicIds.has(s.id)) continue;
      if (!inFilter(ctx.categories, filter, s.categoryId)) continue;
      hidden.set(s.date, (hidden.get(s.date) ?? 0) + 1);
    }
  }
  return {
    heading: base.heading,
    tiles: base.tiles.map((t) => {
      const count = Math.max(0, t.count - (hidden.get(t.date) ?? 0)) + (extra.get(t.date) ?? 0);
      const mark = dayMarks[t.date];
      return {
        date: t.date,
        dayNumber: t.dayNumber,
        otherMonth: t.otherMonth,
        count,
        countLabel: count ? `${count} ${termWord(count)}` : null,
        flag: mark?.closed ? mark.label?.trim() || 'Zavřeno' : null,
        lock: mark?.closed ? lockedDayLook(mark, extras.holidayColor) : null,
        inquiries: extras.inquiries?.get(t.date) ?? [],
        blocked: extras.blockedDays?.has(t.date) ?? false,
        clubs: extras.clubLines?.get(t.date) ?? [],
        clubItems: extras.clubItems?.get(t.date) ?? [],
        activities: [...(mix.get(t.date)?.values() ?? [])].sort((a, b) => order(a.categoryId) - order(b.categoryId) || a.name.localeCompare(b.name, 'cs')),
        calendars: columns
          ? columns.map((c) => ({ id: c.id, name: c.name, colour: cleanHex(c.color), count: perCalendar.get(t.date)?.get(c.id) ?? 0 }))
          : [],
      };
    }),
  };
}

/**
 * The days blocked by hand from the first minute to the last ("Zablokovat celé dny"): every calendar given has a
 * manual block (a club's window is not the desk's block) that covers the whole day. A day one calendar still works
 * is not blocked - the clinic is open.
 */
export function blockedDaysOf(
  days: readonly IsoDate[],
  calendarIds: readonly string[],
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>,
): Set<IsoDate> {
  const out = new Set<IsoDate>();
  if (calendarIds.length === 0) return out;
  for (const day of days) {
    const everyCalendar = calendarIds.every((id) =>
      (blocksByCalendar.get(id) ?? []).some((b) => {
        if (b.kind === 'club' || !touchesDay(b.startUtc, b.endUtc, day)) return false;
        const span = spanOnDay(b.startUtc, b.endUtc, day);
        return span.start <= 0 && span.end >= MINUTES_PER_DAY;
      }),
    );
    if (everyCalendar) out.add(day);
  }
  return out;
}
