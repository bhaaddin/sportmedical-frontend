import type { DateOnly } from "../../../utils/time";
import { addDaysToDateOnly } from "../../../utils/time";
import { shortDate, weekdayShort } from "../grid/periodTitle";
import { formatMinutes, type MinuteRange } from "../grid/timeRange";
import { rangeDates, type ClubRange } from "./model";

/*
 * Several different places marked in the calendar at once (Monday morning,
 * Wednesday afternoon, a whole week next month), kept until one action is
 * chosen in the selection tray. Pure helpers here; the state is in
 * `useMultiSelect`, the surface in `SelectionTray`.
 */

export interface PickedTime {
  id: string;
  kind: "time";
  /** The column it was drawn in - so the grid can paint it back there. */
  columnKey: string;
  calendarId: string;
  activityId: string | null;
  dayKey: DateOnly;
  range: MinuteRange;
}

export interface PickedDays {
  id: string;
  kind: "days";
  from: DateOnly;
  to: DateOnly;
}

export type PickedRange = PickedTime | PickedDays;
export type NewPicked = Omit<PickedTime, "id"> | Omit<PickedDays, "id">;

/** `Po 26. 10. · 08:00–12:00`, or `26. 10. – 30. 10.` for days. */
export function pickedLabel(item: PickedRange): string {
  if (item.kind === "time") {
    return `${weekdayShort(item.dayKey)} ${shortDate(item.dayKey)} · ${formatMinutes(item.range.start)}–${formatMinutes(item.range.end)}`;
  }
  return item.from === item.to ? `${weekdayShort(item.from)} ${shortDate(item.from)}` : rangeDates(item);
}

export const pickedStart = (item: PickedRange): DateOnly => (item.kind === "time" ? item.dayKey : item.from);

/** Starts before today (the clinic's calendar day). */
export function isPastPicked(item: PickedRange, today: DateOnly): boolean {
  return pickedStart(item) < today;
}

export function sameSpot(a: NewPicked | PickedRange, b: NewPicked | PickedRange): boolean {
  if (a.kind === "time" && b.kind === "time") {
    return (
      a.columnKey === b.columnKey &&
      a.dayKey === b.dayKey &&
      a.range.start === b.range.start &&
      a.range.end === b.range.end
    );
  }
  if (a.kind === "days" && b.kind === "days") return a.from === b.from && a.to === b.to;
  return false;
}

const clockEnd = (minute: number) => (minute >= 24 * 60 ? "23:59" : formatMinutes(minute));

function toClubRange(item: PickedRange): ClubRange {
  if (item.kind === "days") return { fromDate: item.from, toDate: item.to };
  return {
    fromDate: item.dayKey,
    toDate: item.dayKey,
    dailyFrom: formatMinutes(item.range.start),
    dailyTo: clockEnd(item.range.end),
  };
}

const windowOf = (r: ClubRange) => (r.dailyFrom === undefined ? "" : `${r.dailyFrom}-${r.dailyTo}`);

const byStart = (a: ClubRange, b: ClubRange) =>
  a.fromDate.localeCompare(b.fromDate) ||
  (a.dailyFrom ?? "").localeCompare(b.dailyFrom ?? "") ||
  a.toDate.localeCompare(b.toDate);

/**
 * What the clubs screen gets: only the places from today on, sorted by start,
 * with ranges merged when they overlap or touch - on one day the time windows
 * join (08:00-10:00 + 10:00-12:00), and across days the same daily window runs
 * on (Mon + Tue 08:00-12:00 is one range Mon-Tue).
 */
export function clubRanges(items: readonly PickedRange[], today: DateOnly): ClubRange[] {
  const ranges = items.filter((i) => !isPastPicked(i, today)).map(toClubRange);

  /* Pass 1: windows on the same single day. */
  const dayWindows = ranges.filter((r) => r.dailyFrom !== undefined && r.fromDate === r.toDate).sort(byStart);
  const joined: ClubRange[] = [];
  for (const r of dayWindows) {
    const last = joined[joined.length - 1];
    if (last && last.fromDate === r.fromDate && (r.dailyFrom as string) <= (last.dailyTo as string)) {
      if ((r.dailyTo as string) > (last.dailyTo as string)) last.dailyTo = r.dailyTo;
    } else {
      joined.push({ ...r });
    }
  }
  const rest = ranges.filter((r) => !(r.dailyFrom !== undefined && r.fromDate === r.toDate));

  /* Pass 2: identical daily window (or none) on overlapping or consecutive days. */
  const all = [...joined, ...rest].sort(byStart);
  const out: ClubRange[] = [];
  for (const r of all) {
    const same = [...out].reverse().find((o) => windowOf(o) === windowOf(r) && r.fromDate <= addDaysToDateOnly(o.toDate, 1));
    if (same) {
      if (r.toDate > same.toDate) same.toDate = r.toDate;
    } else {
      out.push({ ...r });
    }
  }
  return out.sort(byStart);
}
