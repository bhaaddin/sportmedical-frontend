/*
 * What the phone's list shows, as plain data (no React): the day as an agenda - bookings, the terms of the file,
 * club windows and the desk's blocks in time order -, the strip of the week's seven days with their counts, and the
 * month as one row per day. The old calendar's `PhoneCalendar`, drawn from the planner's own models: the rows come
 * from `dayListModel`, the windows from `buildBoardModel`, the tiles from `monthTilesModel`.
 *
 * Phones have no hover and no room for a grid of 42 tiles; a list of days with the figures written out is what a thumb
 * can read and hit (every row is at least 44 px - the CSS).
 */
import type { TimeBlock } from '../../../api/bookingContracts';
import { drawnBlocksOfDay } from '../../../components/booking/grid/clubWindows';
import { formatMinutes, parseTimeOfDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import { WEEKDAY_ABBREVIATION } from '../../../components/booking/grid/periodTitle';
import { dayOfWeekOf } from '../../../utils/time';
import type { DayMark, IsoDate, WeekHeadModel } from '../../model';
import { inquiryTileLabel, type InquiryRef } from '../../model/inquiries';
import { PLANNER_TEXT } from '../../text';
import { agendaSlotLabel } from '../../model';
import { groupDayRows, type BoardWindowModel, type DayRowModel, type MonthTileModel } from './boardModel';

/* -------------------------------------------------------------------------- */
/* The day                                                                     */
/* -------------------------------------------------------------------------- */

export type PhoneEntryKind = 'booking' | 'session' | 'club' | 'block' | 'group';

export interface PhoneEntry {
  key: string;
  kind: PhoneEntryKind;
  /** The appointment / session id; the club window's key. */
  id: string;
  sortStart: number;
  timeLabel: string;
  title: string;
  sub: string | null;
  /** The status of a booking, "6/8" of a term; null for a window. */
  tail: string | null;
  priceText: string | null;
  /** `#RRGGBB` of the činnost or the club; null = the planner's neutral. */
  colour: string | null;
  /** The window a club / block entry stands for (a tap opens the club's popover or the block). */
  window: BoardWindowModel | null;
  /** A činnost with several bookings / terms on the day, folded into this one entry (reviewer 2.2): the entries behind it. */
  members: PhoneEntry[] | null;
}

/** The day's rows and the day's windows, in one list ordered by when they start. */
export function phoneEntries(rows: readonly DayRowModel[], windows: readonly BoardWindowModel[], day: IsoDate): PhoneEntry[] {
  const entryOf = (r: DayRowModel): PhoneEntry => ({
    key: r.key,
    kind: r.kind,
    id: r.id,
    sortStart: r.sortStart,
    timeLabel: r.timeLabel,
    title: r.name,
    sub: r.sub,
    tail: r.tail,
    priceText: r.priceText,
    colour: r.colour,
    window: null,
    members: null,
  });
  /* A činnost with several bookings (or terms) is ONE entry that opens to the rows behind it. */
  const out: PhoneEntry[] = groupDayRows(rows).map((item) => {
    if (item.type === 'row') return entryOf(item.row);
    const g = item.group;
    const mark = g.count > 1 ? ` ×${g.count}` : '';
    return {
      key: g.key,
      kind: 'group',
      id: g.key,
      sortStart: g.sortStart,
      timeLabel: g.timeLabel,
      title: `${g.name}${mark}`,
      sub: null,
      tail: `${g.slots} ${agendaSlotLabel(g.slots)}`,
      priceText: null,
      colour: g.colour,
      window: null,
      members: g.rows.map(entryOf),
    };
  });
  for (const w of windows) {
    if (w.day !== day) continue;
    const club = w.kind === 'club';
    out.push({
      key: w.key,
      kind: club ? 'club' : 'block',
      id: w.key,
      sortStart: w.start,
      timeLabel: w.timeLabel,
      title: w.label,
      sub: club ? null : w.calendarName,
      tail: null,
      priceText: null,
      colour: club ? w.colour : null,
      window: w,
      members: null,
    });
  }
  return out.sort((a, b) => a.sortStart - b.sortStart || a.key.localeCompare(b.key));
}

/* -------------------------------------------------------------------------- */
/* The week's strip                                                            */
/* -------------------------------------------------------------------------- */

export interface StripDayModel {
  date: IsoDate;
  weekName: string;
  dayNumber: number;
  /** Rows of the day's list plus the club windows. */
  count: number;
  today: boolean;
  selected: boolean;
  closed: boolean;
  flag: string | null;
  inquiries: number;
  clubs: { name: string; colour: string }[];
}

export function weekStripModel(input: {
  days: WeekHeadModel['days'];
  selected: IsoDate;
  today: IsoDate;
  dayMarks: Readonly<Record<string, DayMark>>;
  /** How many rows the day's list has. */
  rowCount: (date: IsoDate) => number;
  windows: readonly BoardWindowModel[];
  inquiries: ReadonlyMap<string, InquiryRef[]>;
}): StripDayModel[] {
  return input.days.map((d) => {
    const mark = input.dayMarks[d.date];
    const clubs = new Map<string, string>();
    let clubWindows = 0;
    for (const w of input.windows) {
      if (w.day !== d.date || w.kind !== 'club') continue;
      clubWindows += 1;
      if (!clubs.has(w.label)) clubs.set(w.label, w.colour);
    }
    return {
      date: d.date,
      weekName: d.weekName,
      dayNumber: Number(d.date.slice(8, 10)),
      count: input.rowCount(d.date) + clubWindows,
      today: d.date === input.today,
      selected: d.date === input.selected,
      closed: mark?.closed ?? false,
      flag: mark?.closed ? mark.label?.trim() || 'Zavřeno' : null,
      inquiries: input.inquiries.get(d.date)?.length ?? 0,
      clubs: [...clubs].map(([name, colour]) => ({ name, colour })),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* The month                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One line per club window of each day ("FK Slaný · 08:00–16:00"): the club's blocks across the calendars on screen,
 * one block per club window across the lunch break (`drawnBlocksOfDay`), the same window in two calendars once.
 */
export function clubLinesByDay(
  days: readonly IsoDate[],
  calendarIds: readonly string[],
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>,
  /** The lunch break of a day (a club's window across it is one window). */
  lunchOf: (day: IsoDate) => MinuteRange | null,
  excludeClubBlockIds?: ReadonlySet<string>,
): Map<IsoDate, string[]> {
  const out = new Map<IsoDate, string[]>();
  for (const day of days) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const id of calendarIds) {
      const blocks = (blocksByCalendar.get(id) ?? []).filter((b) => b.kind === 'club' && touchesDay(b.startUtc, b.endUtc, day));
      for (const { block, span } of drawnBlocksOfDay([...blocks], day, lunchOf(day))) {
        if (block.clubBlockId && excludeClubBlockIds?.has(block.clubBlockId)) continue;
        const key = `${block.clubBlockId ?? block.id}|${span.start}|${span.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(PLANNER_TEXT.phone.clubWindow(block.clubName ?? 'Klub', `${formatMinutes(span.start)}–${formatMinutes(span.end)}`));
      }
    }
    if (lines.length) out.set(day, lines);
  }
  return out;
}

/** The lunch break of a day from the day marks (a club's window across it is one window). */
export function lunchOfMarks(marks: Readonly<Record<string, DayMark>>): (day: IsoDate) => MinuteRange | null {
  return (day) => {
    const from = parseTimeOfDay(marks[day]?.lunch?.from ?? null);
    const to = parseTimeOfDay(marks[day]?.lunch?.to ?? null);
    return from !== null && to !== null ? { start: from, end: to } : null;
  };
}

export interface PhoneMonthRow {
  date: IsoDate;
  weekName: string;
  dayNumber: number;
  today: boolean;
  count: number;
  countLabel: string | null;
  flag: string | null;
  blocked: boolean;
  /** "Poptávka · Dukla, Slavia" */
  inquiry: string | null;
  clubs: string[];
  /** The day by činnost: "Komplexní prohlídka ×10 · 10 slotů" - one line each, never one per booking. */
  activities: string[];
}

/** The days of the shown month (the other months' tiles are only the matrix's padding), one row each. */
export function phoneMonthRows(
  tiles: readonly MonthTileModel[],
  clubLines: ReadonlyMap<IsoDate, string[]>,
  today: IsoDate,
): PhoneMonthRow[] {
  return tiles
    .filter((t) => !t.otherMonth)
    .map((t) => ({
      date: t.date,
      weekName: WEEKDAY_ABBREVIATION[dayOfWeekOf(t.date)],
      dayNumber: t.dayNumber,
      today: t.date === today,
      count: t.count,
      countLabel: t.countLabel,
      flag: t.flag,
      blocked: t.blocked,
      inquiry: t.inquiries.length ? inquiryTileLabel(t.inquiries) : null,
      clubs: clubLines.get(t.date) ?? [],
      activities: t.activities.map((a) => `${a.name}${a.count > 1 ? ` ×${a.count}` : ''} · ${a.slots} ${agendaSlotLabel(a.slots)}`),
    }));
}
