/*
 * R17 - the lunch layer of the week board: a click target over every OBĚD band (and over the dashed ghost of a removed one), the drag
 * ghost and the pop-out. The band itself (its label, "přesunut" / "smazán dnes") is drawn by the board; this layer adds what needs a
 * Stage 2 server and a user who may edit or book, so it is loaded only then (the planner's first load does not carry it).
 */
import { useMemo, type CSSProperties, type RefObject } from 'react';
import type { DayMark, IsoDate } from '../../model';
import type { BoardCalendarData } from './boardCalendar';
import type { BoardGeometry } from './boardGeometry';
import { boxOfSpan } from './spanBox';
import type { DayShadeModel } from './boardModel';
import { LunchPopover } from './LunchPopover';
import { LUNCH_TEXT, clockOf, lunchBandLabel, type LunchBand } from './lunchModel';
import { useLunch } from './useLunch';

export interface LunchLayerProps {
  calendar: BoardCalendarData;
  days: readonly IsoDate[];
  dayMarks: Readonly<Record<string, DayMark>>;
  shades: readonly DayShadeModel[];
  geometry: BoardGeometry;
  boardRef: RefObject<HTMLElement | null>;
  step: number;
  calendarOpen: (calendarId: string, day: IsoDate) => boolean;
  paused: boolean;
  notify: (notice: { text: string; tone: 'info' | 'error' }) => void;
  refresh: () => Promise<void>;
  dayLabelOf: (day: IsoDate) => string;
  /** "Objednat pacienta sem": the booking dialog on the lunch slot. */
  onBook: (prefill: { initialDate: string; initialCalendarId: string; initialStart: string; initialEnd: string; intoLunch: true }) => void;
}

export default function LunchLayer({ calendar, days, dayMarks, shades, geometry, boardRef, step, calendarOpen, paused, notify, refresh, dayLabelOf, onBook }: LunchLayerProps) {
  const ctl = useLunch({ calendar, days, dayMarks, geometry, boardRef, step, calendarOpen, paused, notify, refresh });
  const hits = useMemo(
    () =>
      shades.flatMap((s) => {
        const out: { band: LunchBand; col: number; top: number; height: number }[] = [];
        if (s.lunch) out.push({ col: s.col, top: s.lunch.top, height: s.lunch.height, band: { day: s.day, from: s.lunch.from, to: s.lunch.to, state: s.lunch.moved ? 'moved' : 'weekly', original: s.lunch.original ?? null } });
        if (s.lunchRemoved) out.push({ col: s.col, top: s.lunchRemoved.top, height: s.lunchRemoved.height, band: { day: s.day, from: s.lunchRemoved.from, to: s.lunchRemoved.to, state: 'removed', original: null } });
        return out;
      }),
    [shades],
  );
  return (
    <>
      <div className="board-lunch-layer" aria-hidden={false}>
        {ctl.supported
          ? hits.map(({ band, col, top, height }) => {
              const handlers = ctl.bandHandlers(band);
              if (!handlers) return null;
              const label = lunchBandLabel(band.state);
              return (
                <button
                  key={`${band.day}:${band.state}`}
                  type="button"
                  className="board-lunch-hit"
                  style={{ '--col': col, top, height } as CSSProperties}
                  data-testid={`lunch-hit-${band.day}`}
                  data-lunch={band.state}
                  aria-haspopup="dialog"
                  aria-label={`${label}, ${band.from}–${band.to}`}
                  title={`${label} ${band.from}–${band.to}`}
                  {...handlers}
                />
              );
            })
          : null}
        {ctl.drag ? (
          <div
            className={`board-shade board-lunch-ghost${ctl.drag.problem ? ' is-invalid' : ''}`}
            data-testid="lunch-drag-ghost"
            style={{ '--col': days.indexOf(ctl.drag.day), ...boxOfSpan(geometry, ctl.drag.start, ctl.drag.start + ctl.drag.length) } as CSSProperties}
          >
            <span>{ctl.drag.problem ?? `${LUNCH_TEXT.band} ${clockOf(ctl.drag.start)}`}</span>
          </div>
        ) : null}
      </div>
      {ctl.popover ? (
        <LunchPopover
          band={ctl.popover.band}
          dateLabel={dayLabelOf(ctl.popover.band.day)}
          targets={ctl.popover.targets}
          hours={ctl.popover.hours}
          bookings={ctl.popover.bookings}
          mayEdit={ctl.mayEdit}
          mayBook={ctl.mayBook}
          point={ctl.popover.point}
          onMove={(startTime) => ctl.moveTo(ctl.popover!.band.day, startTime)}
          onMoveWeekly={ctl.mayEditWeekly ? (startTime) => ctl.moveWeekly(ctl.popover!.band.day, startTime) : undefined}
          weekday={new Date(`${ctl.popover.band.day}T12:00:00Z`).getUTCDay()}
          onRemove={() => ctl.removeToday(ctl.popover!.band.day)}
          onRestore={() => ctl.restore(ctl.popover!.band.day)}
          onBook={(calendarId) => {
            const band = ctl.popover!.band;
            onBook({ initialDate: band.day, initialCalendarId: calendarId, initialStart: `${band.day}T${band.from}`, initialEnd: `${band.day}T${band.to}`, intoLunch: true });
          }}
          onClose={ctl.closePopover}
        />
      ) : null}
    </>
  );
}
