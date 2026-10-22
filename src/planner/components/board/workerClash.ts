/*
 * R4 - where the shared-worker rule shows on the board.
 *
 * With "Pracovník dělá jen jednu věc najednou" on, a worker who has something in one služba's column is busy for the same time in every
 * other column he is rostered in that day. The board draws that clash as a locked, hatched slot WITH THE REASON in the other column,
 * so the desk sees why the time is not offered (the server leaves it out of the offers and refuses a booking into it).
 *
 * Pure rules, no DOM. The worker of a calendar on a day is the rota's (`workerOf`); a calendar with nobody rostered is its own
 * resource and clashes with nothing. A commitment is a booking that is not cancelled or a club window (the club's name, never a
 * player). People on the exception list are never refused, so they draw nothing.
 */
import { statusTally, type Calendar, type DayAppointment, type TimeBlock } from '../../../api/bookingContracts';
import { drawnBlocksOfDay } from '../../../components/booking/grid/clubWindows';
import { formatMinutes, spanOnDay, touchesDay } from '../../../components/booking/grid/timeRange';
import { pragueDateKey } from '../../../utils/time';
import type { IsoDate } from '../../model';
import { boxOfSpan, type BoardGeometry } from './boardGeometry';

export interface RosterWorker {
  id: string;
  name: string;
}

export interface WorkerClashModel {
  key: string;
  day: IsoDate;
  col: number;
  /** The column the slot is drawn in (the OTHER column) and how many columns the day has. */
  sub: number;
  subs: number;
  top: number;
  height: number;
  /** The calendar whose column it is drawn in. */
  calendarId: string;
  worker: string;
  /** "Anna Černá: Spiroergometrie 09:00–09:45 (Diagnostika)" - never a patient. */
  reason: string;
  /** The booking / block that causes it. */
  sourceId: string;
}

export interface WorkerClashInput {
  days: readonly IsoDate[];
  /** The calendars each day is split into, in column order (ids), and calendar id -> the column's calendar id. */
  split: readonly string[] | null;
  alias?: ReadonlyMap<string, string> | undefined;
  calendars: readonly Calendar[];
  appointments: readonly DayAppointment[];
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  /** Who the rota gives a calendar on a day (null = nobody: the calendar is the resource). */
  workerOf: (calendarId: string, day: IsoDate) => RosterWorker | null;
  exceptions: ReadonlySet<string>;
  geometry: BoardGeometry;
}

interface Commitment {
  id: string;
  calendarId: string;
  day: IsoDate;
  start: number;
  end: number;
  what: string;
}

export function workerClashes(input: WorkerClashInput): WorkerClashModel[] {
  const { split } = input;
  if (split === null || split.length < 2) return [];
  const columnOf = (calendarId: string): number => split.indexOf(input.alias?.get(calendarId) ?? calendarId);
  const nameOf = new Map(input.calendars.map((c) => [c.id, c.name]));
  const shownDays = new Set(input.days);

  const commitments: Commitment[] = [];
  for (const a of input.appointments) {
    if (!a.calendarId || statusTally(a.status) === 'cancelled') continue;
    const day = pragueDateKey(a.startUtc);
    if (!shownDays.has(day)) continue;
    const span = spanOnDay(a.startUtc, a.endUtc, day);
    if (span.end <= span.start) continue;
    commitments.push({ id: a.id, calendarId: a.calendarId, day, start: span.start, end: span.end, what: a.activityName || 'rezervace' });
  }
  for (const [calendarId, blocks] of input.blocksByCalendar) {
    for (const day of input.days) {
      const club = blocks.filter((b) => b.kind === 'club' && touchesDay(b.startUtc, b.endUtc, day));
      if (club.length === 0) continue;
      for (const { block, span } of drawnBlocksOfDay(club, day, null)) {
        if (span.end <= span.start) continue;
        commitments.push({ id: block.id, calendarId, day, start: span.start, end: span.end, what: `blokace klubu${block.clubName ? ` ${block.clubName}` : ''}` });
      }
    }
  }

  const out = new Map<string, WorkerClashModel>();
  for (const c of commitments) {
    const worker = input.workerOf(c.calendarId, c.day);
    if (worker === null || input.exceptions.has(worker.id)) continue;
    const own = columnOf(c.calendarId);
    if (own < 0) continue;
    for (const other of input.calendars) {
      const sub = columnOf(other.id);
      if (sub < 0 || sub === own) continue;
      if (input.workerOf(other.id, c.day)?.id !== worker.id) continue;
      const col = input.days.indexOf(c.day);
      const box = boxOfSpan(input.geometry, c.start, c.end);
      if (box.height <= 0) continue;
      const key = `clash:${other.id}:${c.day}:${c.start}:${c.end}`;
      if (out.has(key)) continue;
      out.set(key, {
        key,
        day: c.day,
        col,
        sub,
        subs: split.length,
        top: box.top,
        height: box.height,
        calendarId: other.id,
        worker: worker.name,
        reason: `${worker.name}: ${c.what} ${formatMinutes(c.start)}–${formatMinutes(c.end)} (${nameOf.get(c.calendarId) ?? ''})`,
        sourceId: c.id,
      });
    }
  }
  return [...out.values()];
}
