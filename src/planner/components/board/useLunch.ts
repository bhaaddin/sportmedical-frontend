/*
 * R17 on the board: the OBĚD band is clickable (pop-out: Přesunout / Smazat jen dnes / Objednat pacienta sem / Vrátit) and can be
 * dragged to any other time of the day. Everything is a one-day exception of the weekly lunch (`lunchActions`).
 *
 * The routes exist only on a Stage 2 server, so the band stays what it was (not clickable) until a probe - one list call of the first
 * calendar - has answered: an older server (404 / 405), a failed read or a user without the rights simply never see a button that
 * cannot work.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statusTally } from '../../../api/bookingContracts';
import { parseTimeOfDay, spanOnDay } from '../../../components/booking/grid/timeRange';
import { pragueDateKey } from '../../../utils/time';
import type { DayMark, IsoDate } from '../../model';
import type { BoardCalendarData } from './boardCalendar';
import type { BoardGeometry } from './boardGeometry';
import type { LunchAction } from './LunchPopover';
import type { LunchOutcome, LunchTarget } from './lunchActions';
import { LUNCH_TEXT, checkLunchMove, clockOf, draggedStart, lunchBandOf, lunchLength, type LunchBand } from './lunchModel';

const DRAG_THRESHOLD_PX = 4;

export interface LunchDrag {
  day: IsoDate;
  band: LunchBand;
  /** The start the band would land on (minutes). */
  start: number;
  /** What stops it landing there, or null. */
  problem: string | null;
  /** Minutes the lunch lasts. */
  length: number;
}

/** What the band element gets: a press (maybe the start of a drag) and a click (the pop-out). */
export interface LunchBandHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onClick: (e: { clientX: number; clientY: number; stopPropagation: () => void }) => void;
}

export interface LunchOpen {
  band: LunchBand;
  point: { x: number; y: number };
}

export function useLunch(args: {
  calendar: BoardCalendarData | null;
  days: readonly IsoDate[];
  dayMarks: Readonly<Record<string, DayMark>>;
  geometry: BoardGeometry;
  boardRef: RefObject<HTMLElement | null>;
  step: number;
  calendarOpen: (calendarId: string, day: IsoDate) => boolean;
  paused: boolean;
  notify: (notice: { text: string; tone: 'info' | 'error' }) => void;
  refresh: () => Promise<void>;
}) {
  const { calendar, days, dayMarks, geometry, boardRef, step, calendarOpen, paused, notify, refresh } = args;
  const mayEdit = calendar?.mayBlock ?? false;
  const mayBook = calendar?.mayBook ?? false;

  /* The layer is mounted only on a Stage 2 server (booking-slots carries the shared-worker fields; the same release carries the lunch
     routes), so an older server is never asked and nothing 404s into the console; one list call confirms the routes. */
  const firstCalendar = calendar?.calendars[0]?.id ?? '';
  const today = days[0] ?? '';
  const probe = useQuery({
    queryKey: ['lunch-probe', firstCalendar],
    /* the lunch api (its schemas) is a chunk of its own: it is fetched when a Stage 2 server asks for it, not with the planner */
    queryFn: async () => (await import('../../../api/lunchExceptions')).lunchExceptionsApi.list(firstCalendar, today, today),
    enabled: firstCalendar !== '' && today !== '' && (mayEdit || mayBook),
    staleTime: Infinity,
    retry: false,
  });
  const supported = probe.isSuccess;

  const [open, setOpen] = useState<LunchOpen | null>(null);
  const [drag, setDrag] = useState<LunchDrag | null>(null);
  const suppressClick = useRef(false);

  /* The day's lunch is the clinic's (the day mark is the lunch ALL open calendars share), so a change goes to every open calendar - not only
     to the služby on screen, or the band would vanish for the others. */
  const targetsOf = useCallback(
    (day: IsoDate): LunchTarget[] =>
      (calendar?.allCalendars ?? []).filter((c) => calendarOpen(c.id, day)).map((c) => ({ id: c.id, name: c.name })),
    [calendar?.allCalendars, calendarOpen],
  );
  const bookingsOf = useCallback(
    (day: IsoDate): { start: number; end: number }[] => {
      const ids = new Set(targetsOf(day).map((t) => t.id));
      return (calendar?.appointments ?? [])
        .filter((a) => a.calendarId !== null && ids.has(a.calendarId) && statusTally(a.status) !== 'cancelled' && pragueDateKey(a.startUtc) === day)
        .map((a) => spanOnDay(a.startUtc, a.endUtc, day));
    },
    [calendar?.appointments, targetsOf],
  );
  const hoursOf = (day: IsoDate) => dayMarks[day]?.hours ?? null;

  const after = useCallback(
    async (action: (m: typeof import('./lunchActions')) => Promise<LunchOutcome>, success: string): Promise<LunchAction> => {
      const actions = await import('./lunchActions');
      const outcome = await action(actions);
      const said = actions.lunchOutcomeText(outcome, success);
      if (outcome.done > 0) await refresh();
      notify(said);
      return { ok: outcome.errors.length === 0, text: said.text };
    },
    [notify, refresh],
  );

  const moveTo = useCallback(
    (day: IsoDate, startTime: string) => after((m) => m.moveLunchTo(targetsOf(day), day, startTime), LUNCH_TEXT.done.moved),
    [after, targetsOf],
  );
  const removeToday = useCallback((day: IsoDate) => after((m) => m.removeLunchToday(targetsOf(day), day), LUNCH_TEXT.done.removed), [after, targetsOf]);
  const restore = useCallback((day: IsoDate) => after((m) => m.restoreLunch(targetsOf(day), day), LUNCH_TEXT.done.restored), [after, targetsOf]);

  /* ---- the band: a click opens the pop-out, a drag moves the lunch ---- */
  const press = useRef<{ pointerId: number; y0: number; day: IsoDate; band: LunchBand; started: boolean } | null>(null);
  const live = useRef({ drag, moveTo, bookingsOf, hoursOf });
  live.current = { drag, moveTo, bookingsOf, hoursOf };

  const windowMove = useRef<(e: PointerEvent) => void>(() => undefined);
  const windowUp = useRef<(e: PointerEvent) => void>(() => undefined);
  windowMove.current = (e) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const dy = e.clientY - p.y0;
    if (!p.started) {
      if (Math.abs(dy) <= DRAG_THRESHOLD_PX) return;
      p.started = true;
    }
    const board = boardRef.current;
    const rect = board?.getBoundingClientRect();
    const scaleY = rect && rect.height > 0 ? rect.height / geometry.height : 1;
    const deltaMinutes = dy / scaleY / geometry.pxPerMinute;
    const startMin = parseTimeOfDay(p.band.from) ?? 0;
    const length = lunchLength(p.band);
    const start = draggedStart(startMin, deltaMinutes, step, length);
    setDrag({ day: p.day, band: p.band, start, length, problem: checkLunchMove({ start, length, hours: live.current.hoursOf(p.day), bookings: live.current.bookingsOf(p.day) }) });
  };
  windowUp.current = (e) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    press.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (!p.started) return; /* a click: the band's onClick opens the pop-out */
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    const d = live.current.drag;
    setDrag(null);
    if (!d || d.day !== p.day) return;
    if (clockOf(d.start) === p.band.from) return;
    if (d.problem !== null) {
      notify({ text: d.problem, tone: 'error' });
      return;
    }
    void live.current.moveTo(p.day, clockOf(d.start));
  };
  const onMove = (e: PointerEvent) => windowMove.current(e);
  const onUp = (e: PointerEvent) => windowUp.current(e);
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const bandHandlers = (band: LunchBand): LunchBandHandlers | null => {
    if (!supported || !(mayEdit || mayBook) || paused) return null;
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        /* the band is not the board: a press on it never starts a selection of free time */
        e.stopPropagation();
        if (!mayEdit || band.state === 'removed' || e.button !== 0) return;
        press.current = { pointerId: e.pointerId, y0: e.clientY, day: band.day, band, started: false };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      },
      onClick: (e: { clientX: number; clientY: number; stopPropagation: () => void }) => {
        e.stopPropagation();
        if (suppressClick.current) return;
        setOpen({ band, point: { x: e.clientX, y: e.clientY } });
      },
    };
  };

  const bandOf = (day: IsoDate) => lunchBandOf(day, dayMarks[day]);
  const popover = useMemo(() => {
    if (!open) return null;
    const day = open.band.day;
    return { ...open, targets: targetsOf(day), bookings: bookingsOf(day), hours: hoursOf(day) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetsOf, bookingsOf, dayMarks]);

  return {
    supported,
    mayEdit,
    mayBook,
    bandOf,
    bandHandlers,
    drag,
    popover,
    closePopover: () => setOpen(null),
    moveTo,
    removeToday,
    restore,
  };
}
