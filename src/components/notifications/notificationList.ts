/*
 * How the bell's list is arranged: time, day headings, grouping, and the line
 * between what has been seen and what has not.
 *
 * Kept apart from the component on purpose. This is the part that can be wrong
 * in ways nobody notices - a group that swallows a row, a divider in the wrong
 * place, a date that reads as today - and none of it needs a browser to test.
 */
import { PRAGUE_TZ } from '../../utils/time';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  /** ISO instant. */
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  /**
   * The machine-readable event: `appointment.booked`, `intake.submitted`, …
   *
   * Grouping keys on this and never on `title`. A title is prose and will be
   * reworded one day; the day it is, grouping by it would quietly stop working
   * and nobody would get a bug report for a list that merely looks busier.
   *
   * Absent means "do not group" - not "a group of blank ones". Older rows
   * predate the field, and guessing the event from the wording would be
   * exactly the inference this field exists to replace.
   */
  kind?: string | null;
}

const pragueDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: PRAGUE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const pragueClock = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: PRAGUE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const pragueDate = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: PRAGUE_TZ,
  day: 'numeric',
  month: 'numeric',
});

const pragueDateFull = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: PRAGUE_TZ,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** `2026-09-11` for the Prague day an instant falls on. */
function dayKey(instant: Date): string {
  return pragueDay.format(instant);
}

function daysApart(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * What the row says about when it happened.
 *
 * Relative only under the hour, because relative stops being information the
 * moment it stops being precise: "Před 12 dny" cannot answer whether the
 * patient rang before or after the appointment moved, which is the question
 * somebody is actually holding the list to answer.
 *
 *     under a minute   Právě teď
 *     under an hour    Před 12 min
 *     today            14:32
 *     yesterday        Včera 14:32
 *     older            9. 9. 14:32
 */
export function formatNotificationTime(timestamp: string, now: Date = new Date()): string {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return '';

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);

  /* Future timestamps are somebody's clock being wrong, not a countdown. Shown
     as a time rather than as "Před -3 min". */
  if (minutes >= 0 && minutes < 1) return 'Právě teď';
  if (minutes >= 1 && minutes < 60) return `Před ${minutes} min`;

  const apart = daysApart(dayKey(now), dayKey(at));
  if (apart === 0) return pragueClock.format(at);
  if (apart === 1) return `Včera ${pragueClock.format(at)}`;
  return `${pragueDate.format(at)} ${pragueClock.format(at)}`;
}

/**
 * The full moment, for the tooltip. Available everywhere, including on rows
 * whose visible label is relative - so "Před 12 min" is never the only thing
 * anybody can find out.
 */
export function exactNotificationTime(timestamp: string): string {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return '';
  return `${pragueDateFull.format(at)} ${pragueClock.format(at)}`;
}

/** `Dnes`, `Včera`, or the date. */
export function dayHeading(timestamp: string, now: Date = new Date()): string {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return '';
  const apart = daysApart(dayKey(now), dayKey(at));
  if (apart === 0) return 'Dnes';
  if (apart === 1) return 'Včera';
  return pragueDateFull.format(at);
}

export interface SingleEntry {
  entry: 'single';
  row: NotificationRow;
  /** Arrived after the viewer last looked. */
  isNew: boolean;
}

export interface GroupEntry {
  entry: 'group';
  /** The `kind` every row in here shares. */
  kind: string;
  rows: NotificationRow[];
  unreadCount: number;
  /** The newest row's timestamp - what the group sorts and reads as. */
  timestamp: string;
  isNew: boolean;
}

export type ListEntry = SingleEntry | GroupEntry;

export interface DaySection {
  heading: string;
  /** Stable across renders; the heading is display text and can repeat a year later. */
  key: string;
  entries: ListEntry[];
}

export interface BuildOptions {
  now?: Date;
  /**
   * When the viewer last opened the panel, as an ISO instant. Anything newer
   * is "new". Absent means the server has not told us yet - and then no line
   * is drawn at all, because a divider in the wrong place is worse than none.
   */
  lastSeenAt?: string | null;
  /** Rows of the same kind sitting next to each other merge from this many up. */
  groupFrom?: number;
}

/**
 * Sorted newest first, split into Prague days, with runs of the same `kind`
 * merged.
 *
 * Ordering is by time alone. Unread is a mark, not a position: sorting unread
 * to the top makes rows jump under the hand of the person reading them, which
 * is the one thing a list being read must never do.
 *
 * Only *adjacent* rows merge. Eight bookings in a row become one line; eight
 * bookings with a cancellation in the middle stay three lines, because the
 * cancellation happened between them and a list that hides that is lying about
 * the order of events. Groups never span a day heading, and never span the
 * new/seen line - a divider inside a collapsed group would be invisible.
 */
export function buildNotificationSections(
  rows: NotificationRow[],
  options: BuildOptions = {},
): DaySection[] {
  const now = options.now ?? new Date();
  const lastSeenAt = options.lastSeenAt ?? null;
  const groupFrom = options.groupFrom ?? 2;
  const seenCutoff = lastSeenAt === null ? null : Date.parse(lastSeenAt);

  const isNew = (row: NotificationRow): boolean => {
    if (seenCutoff === null || Number.isNaN(seenCutoff)) return false;
    return Date.parse(row.timestamp) > seenCutoff;
  };

  const sorted = [...rows]
    .filter((r) => !Number.isNaN(Date.parse(r.timestamp)))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const sections: DaySection[] = [];

  for (const row of sorted) {
    const at = new Date(row.timestamp);
    const key = dayKey(at);
    let section = sections[sections.length - 1];
    if (section === undefined || section.key !== key) {
      section = { heading: dayHeading(row.timestamp, now), key, entries: [] };
      sections.push(section);
    }

    const rowIsNew = isNew(row);
    const last = section.entries[section.entries.length - 1];
    const canMerge =
      typeof row.kind === 'string' &&
      row.kind !== '' &&
      last !== undefined &&
      ((last.entry === 'group' && last.kind === row.kind && last.isNew === rowIsNew) ||
        (last.entry === 'single' &&
          last.row.kind === row.kind &&
          last.isNew === rowIsNew));

    if (!canMerge) {
      section.entries.push({ entry: 'single', row, isNew: rowIsNew });
      continue;
    }

    if (last.entry === 'group') {
      last.rows.push(row);
      if (!row.read) last.unreadCount += 1;
      continue;
    }

    /* Two singles of the same kind become a group - but only once there are
       enough of them to be worth collapsing. */
    if (groupFrom <= 2) {
      section.entries[section.entries.length - 1] = {
        entry: 'group',
        kind: row.kind as string,
        rows: [last.row, row],
        unreadCount: (last.row.read ? 0 : 1) + (row.read ? 0 : 1),
        timestamp: last.row.timestamp,
        isNew: rowIsNew,
      };
    } else {
      section.entries.push({ entry: 'single', row, isNew: rowIsNew });
    }
  }

  return sections;
}

/**
 * Where the "new since you last looked" line goes: before the first entry that
 * is not new. Null when there is nothing to separate - no marker, nothing new,
 * or nothing old - because a line with only one side is noise.
 */
export function newSinceBoundary(sections: DaySection[]): { sectionKey: string; index: number } | null {
  let sawNew = false;
  for (const section of sections) {
    for (let i = 0; i < section.entries.length; i += 1) {
      const entry = section.entries[i];
      if (entry.isNew) {
        sawNew = true;
        continue;
      }
      if (sawNew) return { sectionKey: section.key, index: i };
    }
  }
  return null;
}

/** `8 nových termínů` - the plural Czech actually uses. */
export function groupLabel(kind: string, count: number): string {
  const noun = GROUP_NOUNS[kind];
  if (noun === undefined) return `${count}× ${kind}`;
  const form = count >= 5 ? noun.many : count >= 2 ? noun.few : noun.one;
  return `${count} ${form}`;
}

const GROUP_NOUNS: Record<string, { one: string; few: string; many: string }> = {
  'appointment.booked': { one: 'nový termín', few: 'nové termíny', many: 'nových termínů' },
  'appointment.moved': { one: 'přesunutý termín', few: 'přesunuté termíny', many: 'přesunutých termínů' },
  'appointment.cancelled': { one: 'zrušený termín', few: 'zrušené termíny', many: 'zrušených termínů' },
  'intake.submitted': { one: 'nový dotazník', few: 'nové dotazníky', many: 'nových dotazníků' },
  'document.vypis.received': { one: 'doručený výpis', few: 'doručené výpisy', many: 'doručených výpisů' },
};
