/*
 * R4 - the clash layer of the week board: the worker's other commitments drawn as locked, hatched slots WITH THE REASON in the other
 * column (`workerClash.ts`). A layer of its own, loaded only when the shared-worker rule is on and two služby are side by side, so the
 * planner's first load does not carry it.
 */
import { useMemo, type CSSProperties } from 'react';
import { pragueDateKey } from '../../../utils/time';
import type { Calendar, DayAppointment, TimeBlock } from '../../../api/bookingContracts';
import type { DayMark, IsoDate } from '../../model';
import { Icon } from '../Icons';
import type { BoardGeometry } from './boardGeometry';
import { workerClashes, type RosterWorker } from './workerClash';

export interface ClashLayerProps {
  days: readonly IsoDate[];
  split: readonly string[];
  alias?: ReadonlyMap<string, string>;
  calendars: readonly Calendar[];
  appointments: readonly DayAppointment[];
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  workerRule: { on: boolean; exceptions: ReadonlySet<string>; workerOf: (calendarId: string, day: string) => RosterWorker | null };
  dayMarks: Readonly<Record<string, DayMark>>;
  geometry: BoardGeometry;
}

export default function ClashLayer({ days, split, alias, calendars, appointments, blocksByCalendar, workerRule, dayMarks, geometry }: ClashLayerProps) {
  const clashes = useMemo(() => {
    const locked = (day: string) => dayMarks[day]?.closed === true;
    return workerClashes({
      days,
      split,
      alias,
      calendars,
      appointments: appointments.filter((a) => !locked(pragueDateKey(a.startUtc))),
      blocksByCalendar,
      workerOf: (id, day) => (locked(day) ? null : workerRule.workerOf(id, day)),
      exceptions: workerRule.exceptions,
      geometry,
    });
  }, [days, split, alias, calendars, appointments, blocksByCalendar, workerRule, dayMarks, geometry]);
  if (clashes.length === 0) return null;
  return (
    <div className="board-clashes" aria-hidden="true" data-testid="board-clashes">
      {clashes.map((c) => (
        <div
          key={c.key}
          className="board-clash"
          data-testid={`clash-${c.calendarId}-${c.day}-${c.sourceId}`}
          data-source-id={c.sourceId}
          title={`Pracovník je zaneprázdněn - ${c.reason}`}
          style={{ '--col': c.col, '--sub': c.sub, '--subs': c.subs, top: c.top, height: c.height } as CSSProperties}
        >
          <span className="board-sticky"><Icon name="lock" /><b>Zaneprázdněn</b><small>{c.reason}</small></span>
        </div>
      ))}
    </div>
  );
}
