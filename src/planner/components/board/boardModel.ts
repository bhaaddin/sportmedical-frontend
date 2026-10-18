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
import { formatMinutes, parseTimeOfDay, pragueMinuteOfDay, spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
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
  day: IsoDate;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  left: string;
  width: string;
  label: string;
  timeLabel: string;
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
  /** A day without working hours (and not closed): shaded whole, quietly. */
  noHours: boolean;
  /** Outside working hours: above the opening and below the closing. */
  before: { top: number; height: number } | null;
  after: { top: number; height: number } | null;
  lunch: { top: number; height: number; from: string; to: string } | null;
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
}

export interface BoardModel {
  days: IsoDate[];
  cards: BoardCardModel[];
  overflow: BoardOverflowModel[];
  /** The cards folded into the "+N" chips (not drawn on the board). */
  folded: BoardCardModel[];
  windows: BoardWindowModel[];
  shades: DayShadeModel[];
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
  for (const a of calendar.appointments) {
    if (filter !== 'all' && a.activityId !== filter) continue;
    const day = pragueDateKey(a.startUtc);
    const col = days.indexOf(day);
    if (col < 0) continue;
    const span = spanOnDay(a.startUtc, a.endUtc, day);
    const box = cardBox(g, span.start, Math.max(span.end, span.start + 1));
    const cal = a.calendarId ? calendarById.get(a.calendarId) : undefined;
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
      ...cardLeftWidth(col, 0, 1),
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

/** Put the day's cards into lanes; past three lanes the rest fold into a "+N" chip. */
function layoutCards(
  cards: BoardCardModel[],
  days: readonly IsoDate[],
): { cards: BoardCardModel[]; overflow: BoardOverflowModel[]; folded: BoardCardModel[] } {
  const placedCards: BoardCardModel[] = [];
  const overflow: BoardOverflowModel[] = [];
  const folded: BoardCardModel[] = [];
  for (let col = 0; col < days.length; col++) {
    const dayCards = cards.filter((c) => c.col === col);
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
      placedCards.push({ ...c, lane: p.lane, lanes: p.lanes, ...cardLeftWidth(c.col, p.lane, p.lanes) });
    }
    for (const chip of layout.overflow) {
      const first = dayCards.find((c) => c.key === chip.ids[0])!;
      const inChip = dayCards.filter((c) => chip.ids.includes(c.key));
      const top = Math.min(...inChip.map((c) => c.top));
      const bottom = Math.max(...inChip.map((c) => c.top + c.height));
      overflow.push({
        key: chip.key,
        col,
        day: first.day,
        top,
        height: Math.max(18, bottom - top),
        ...cardLeftWidth(col, chip.lane, chip.lanes),
        keys: chip.ids,
      });
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
        if (club) {
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
          day,
          top: box.top,
          height: box.height,
          label,
          timeLabel: `${formatMinutes(span.start)}–${formatMinutes(span.end)}`,
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
    const layout = layoutLanes(
      dayWindows.map((w, i) => ({
        id: String(i),
        start: Math.round(w.top),
        end: Math.max(Math.round(w.top + w.height), Math.round(w.top) + 1),
      })),
      8,
    );
    dayWindows.forEach((w, i) => {
      const p = layout.placed.get(String(i)) ?? { lane: 0, lanes: 1 };
      out.push({ ...w, lane: p.lane, lanes: p.lanes, ...cardLeftWidth(w.col, p.lane, p.lanes) });
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Day shading and the now-line                                                */
/* -------------------------------------------------------------------------- */

function dayShades(days: readonly IsoDate[], marks: Readonly<Record<string, DayMark>>, g: BoardGeometry): DayShadeModel[] {
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
        ? { ...boxOfSpan(g, lunchFrom, lunchTo), from: mark.lunch!.from, to: mark.lunch!.to }
        : null;
    const before = !mark.closed && hasHours && from! > g.startMinutes ? boxOfSpan(g, g.startMinutes, from!) : null;
    const after = !mark.closed && hasHours && to! < g.endMinutes ? boxOfSpan(g, to!, g.endMinutes) : null;
    out.push({
      day,
      col,
      closed: mark.closed,
      closedLabel: mark.closed ? (mark.label?.trim() || 'Zavřeno') : null,
      noHours: !mark.closed && !hasHours,
      before,
      after,
      lunch,
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
  const sessions = sessionCards(ctx, weekStart, filter, g, days, calendar !== null);
  const bookings = calendar ? bookingCards(ctx, days, filter, g, calendar) : [];
  const laid = layoutCards([...sessions, ...bookings], days);
  const windows = calendar ? windowModels(days, dayMarks, g, calendar, '#6e91a5') : [];
  return {
    days,
    cards: laid.cards,
    overflow: laid.overflow,
    folded: laid.folded,
    windows,
    shades: dayShades(days, dayMarks, g),
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
}

export interface DayListModel {
  heading: string;
  rows: DayRowModel[];
  empty: string | null;
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
    });
  }
  for (const a of bookings) {
    if (pragueDateKey(a.startUtc) !== selectedDate) continue;
    if (filter !== 'all' && a.activityId !== filter) continue;
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
): MonthListModel {
  const base = monthViewModel(ctx, calendarMonth, filter);
  const publicIds = hideCalendarBacked ? new Set(ctx.sessions.filter(isCalendarBacked).map((s) => s.id)) : null;
  const extra = new Map<string, number>();
  for (const a of bookings) {
    if (filter !== 'all' && a.activityId !== filter) continue;
    const day = pragueDateKey(a.startUtc);
    extra.set(day, (extra.get(day) ?? 0) + 1);
  }
  const hidden = new Map<string, number>();
  if (publicIds) {
    for (const s of ctx.sessions) {
      if (!publicIds.has(s.id)) continue;
      if (filter !== 'all' && s.categoryId !== filter) continue;
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
      };
    }),
  };
}
