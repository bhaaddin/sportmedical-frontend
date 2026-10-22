/*
 * Dragging a booking's card to another time (the owner, Etapa 12: "jeden klik a táhnout mi to
 * přesune, dvojklik mi ukáže celou info"). The logic of `TimeGrid`'s move, on the planner's board:
 *
 *   - a press that travels > 6 px (a long press on touch) is a drag; one that does not is a click
 *     and falls through to the card;
 *   - the ghost snaps to the calendar's step (or the finer grid), the whole card kept on the board;
 *   - `moveRefusal` says why a place cannot take it (closed day, outside the hours, busy,
 *     another calendar) - shown on the ghost and, on a drop, in the notice;
 *   - a drop on an allowed place keeps the card AT the new slot (an override over the server's data)
 *     and hangs `MoveConfirmDialog` off it: "Přesunout" / "Zrušit" and "Upozornit klienta na změnu".
 *     Esc, a click outside and "Zrušit" glide the card back; "Přesunout" commits through
 *     `onCommit` with `notifyPatient`, and a refusal of the server glides it back too, with the
 *     server's sentence in the notice.
 *
 * The arithmetic (snap, refusal, glide, notice words, the remembered checkbox) is
 * `components/booking/grid/moveDrag.ts`; nothing is re-derived here.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { MoveNotice } from '../../../api/appointments';
import { isTerminalStatus, type DayAppointment } from '../../../api/bookingContracts';
import { appointmentInColumn } from '../../../components/booking/calendar/model';
import type { GridMoveRequest } from '../../../components/booking/grid/moveRequest';
import {
  DRAG_THRESHOLD_PX,
  TOUCH_DRAG_PRESS_MS,
  TOUCH_SCROLL_SLACK_PX,
  columnStep,
  glideFrom,
  moveRefusal,
  movedNoticeText,
  refusalText,
  rememberedNotify,
  samePlace,
  settle,
  snapMove,
  type MoveRefusal,
} from '../../../components/booking/grid/moveDrag';
import { GRID_TEXT } from '../../../components/booking/grid/gridText';
import { dayBelongsTo } from '../../../components/booking/grid/filters';
import { localDateTime, rangeToInstants, spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import { pragueDateKey } from '../../../utils/time';
import type { DayMark, IsoDate } from '../../model';
import type { BoardCalendarData } from './boardCalendar';
import { cellAtFraction, type BoardGeometry } from './boardGeometry';
import type { BookingCardModel } from './boardModel';

export interface MoveTarget {
  col: number;
  /** The calendar's sub-column the pointer is over (0 of 1 when the day is not split). */
  sub: number;
  subs: number;
  day: IsoDate;
  calendarId: string;
  range: MinuteRange;
  /** `null`: the card may land here. */
  refusal: MoveRefusal | null;
}

export interface MovingState {
  appointment: DayAppointment;
  fromCalendarId: string;
  grabMinutes: number;
  length: number;
  pointerType: string;
  target: MoveTarget | null;
}

interface Press {
  appointment: DayAppointment;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  grabMinutes: number;
  length: number;
  timer: number | undefined;
  started: boolean;
}

interface Override {
  appointment: DayAppointment;
  startUtc: string;
  endUtc: string;
  /** The server has said yes; the override goes once the data shows the new time. */
  settled: boolean;
}

const NOT_TOLD: Record<string, string> = {
  no_email: 'pacient nemá e-mail',
  no_patient: 'rezervace nemá pacienta',
  no_change: 'čas se nezměnil',
  patient_initiated: 'změnu provedl pacient sám',
  queue_failed: 'oznámení se nepodařilo odeslat',
};

/**
 * The words after a confirmed move. The server says whether the patient was really told (`MoveNotice`): when the desk
 * asked for it and it did not happen, the notice says so and why - never "odesíláme oznámení" over a silence.
 */
export function movedNoticeFor(notifyPatient: boolean, notice: MoveNotice | null | void): string {
  if (!notice || typeof notice !== 'object') return movedNoticeText(notifyPatient);
  if (notice.patientNotified) return movedNoticeText(true);
  if (!notifyPatient || notice.reason === 'not_requested') return movedNoticeText(false);
  const why = notice.reason ? NOT_TOLD[notice.reason] ?? notice.reason : null;
  return `${GRID_TEXT.moved} · pacient nebyl upozorněn${why ? ` (${why})` : ''}`;
}

export interface BoardNotice {
  text: string;
  tone: 'info' | 'error';
}

export interface UseBoardMoveArgs {
  boardRef: RefObject<HTMLElement | null>;
  geometry: BoardGeometry;
  days: readonly IsoDate[];
  calendar: BoardCalendarData | null;
  dayMarks: Readonly<Record<string, DayMark>>;
  /** The calendars each day is split into, in column order (reviewer 2.4); null / absent for the one-column week. */
  split?: readonly string[] | null;
  /** R2: calendar id -> the calendar whose column it is drawn in. */
  alias?: ReadonlyMap<string, string>;
  /** Minutes between the grid lines of the chosen resolution. */
  resolutionStep: number;
  /** The planning layer owns the pointer (a činnost is armed). */
  paused: boolean;
  onCommit: (request: GridMoveRequest) => Promise<MoveNotice | null | void>;
  onNotice: (notice: BoardNotice) => void;
  /** The server's sentence (Czech) for a rejected move. */
  describeError: (error: unknown) => string;
  /**
   * R4: a refusal the board answers itself (the shared-worker clash opens its override dialog). Return true when it did; the card is
   * back in its old place either way.
   */
  onRefused?: (error: unknown, request: GridMoveRequest) => boolean;
  /** A press that became a drag closes whatever summary / selection was open. */
  onDragStart: () => void;
}

export function useBoardMove(args: UseBoardMoveArgs) {
  const { boardRef, geometry: g, days, calendar, dayMarks } = args;
  const enabled = calendar !== null && calendar.mayBook && !args.paused;

  const [moving, setMoving] = useState<MovingState | null>(null);
  const movingRef = useRef<MovingState | null>(null);
  movingRef.current = moving;
  const pressRef = useRef<Press | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const justDraggedRef = useRef(false);
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map());
  const [proposal, setProposal] = useState<GridMoveRequest | null>(null);
  /** `undefined`: the moved card has not been looked up yet (the popover waits a layout pass for it). */
  const [proposalAnchor, setProposalAnchor] = useState<Element | null | undefined>(undefined);
  const flipRef = useRef<{ id: string; from: DOMRect } | null>(null);

  const latestArgs = useRef(args);
  latestArgs.current = args;

  const cardElement = useCallback(
    (id: string): HTMLElement | null =>
      Array.from(boardRef.current?.querySelectorAll<HTMLElement>('[data-booking-id]') ?? []).find((el) => el.dataset.bookingId === id) ?? null,
    [boardRef],
  );

  /* The server's bookings, with the moved ones at their new slot. */
  const appointments = useMemo(() => {
    const list = calendar?.appointments ?? [];
    if (overrides.size === 0) return list;
    const out = list.filter((a) => !overrides.has(a.id));
    for (const o of overrides.values()) out.push({ ...o.appointment, startUtc: o.startUtc, endUtc: o.endUtc });
    return out;
  }, [calendar?.appointments, overrides]);

  /* A settled override goes once the data shows the card at its new time (or no longer at all). */
  useEffect(() => {
    if (overrides.size === 0 || !calendar) return;
    const stale: string[] = [];
    for (const [id, o] of overrides) {
      if (!o.settled) continue;
      const found = calendar.appointments.find((a) => a.id === id);
      if (found === undefined || new Date(found.startUtc).getTime() === new Date(o.startUtc).getTime()) stale.push(id);
    }
    if (stale.length === 0) return;
    setOverrides((current) => {
      const next = new Map(current);
      for (const id of stale) next.delete(id);
      return next;
    });
  }, [calendar, overrides]);

  const setOverride = (id: string, value: Override | null) =>
    setOverrides((current) => {
      const next = new Map(current);
      if (value === null) next.delete(id);
      else next.set(id, value);
      return next;
    });

  /* The card is drawn back where the server has it: glide it there from where it was. */
  const releaseOverride = (id: string) => {
    const element = cardElement(id);
    if (element) flipRef.current = { id, from: element.getBoundingClientRect() };
    setOverride(id, null);
  };
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (flip === null) return;
    flipRef.current = null;
    const element = cardElement(flip.id);
    if (element) glideFrom(element, flip.from);
  }, [overrides, cardElement]);

  /* The confirm popover hangs off the moved card once it is drawn at its new slot. */
  useLayoutEffect(() => {
    if (proposal === null) {
      setProposalAnchor(undefined);
      return;
    }
    setProposalAnchor(cardElement(proposal.appointment.id));
  }, [proposal, overrides, cardElement]);

  const targetAt = (press: Press, x: number, y: number, fromCalendarId: string): MoveTarget | null => {
    const board = boardRef.current;
    const cal = latestArgs.current.calendar;
    if (!board || !cal) return null;
    const calendarRow = cal.calendarById.get(fromCalendarId);
    if (!calendarRow) return null;
    const rect = board.getBoundingClientRect();
    const scaleY = rect.height > 0 ? rect.height / g.height : 1;
    const split = latestArgs.current.split ?? null;
    const subs = split ? split.length : 1;
    const { col, sub } = cellAtFraction(rect.width > 0 ? (x - rect.left) / rect.width : 0, subs);
    const day = days[col];
    if (!day) return null;
    /* A booking stays in its own calendar: over another calendar's column the move is refused, and says why. */
    const ownSub = split ? Math.max(0, split.indexOf(latestArgs.current.alias?.get(fromCalendarId) ?? fromCalendarId)) : 0;
    const sameCalendar = split === null || sub === ownSub;
    const range = snapMove({
      pointerOffsetPx: (y - rect.top) / scaleY,
      grabMinutes: press.grabMinutes,
      length: press.length,
      step: columnStep(calendarRow, latestArgs.current.resolutionStep),
      pxPerMinute: g.pxPerMinute,
      topMinute: g.startMinutes,
      bottomMinute: g.endMinutes,
    });
    const row = cal.previewByCalendar.get(fromCalendarId)?.get(day);
    const mark = dayMarks[day];
    const open = !(mark?.closed ?? false) && (row === undefined || row.isOpen) && dayBelongsTo(row, cal.employeeId);
    const activity = cal.catalogue.activities.get(press.appointment.activityId);
    const column = { calendarId: fromCalendarId, activityId: press.appointment.activityId };
    const refusal = moveRefusal({
      appointment: press.appointment,
      range,
      dayKey: day,
      sameColumn: sameCalendar,
      open,
      row,
      blocks: (cal.blocksByCalendar.get(fromCalendarId) ?? []).filter((b) => touchesDay(b.startUtc, b.endUtc, day)),
      others: cal.appointments.filter(
        (a) => pragueDateKey(a.startUtc) === day && appointmentInColumn({ ...column, key: '', title: '', colorHex: '', serviceId: null, capacity: 1 }, a),
      ),
      capacity: activity?.parallelCapacity ?? 1,
    });
    return { col, sub, subs, day, calendarId: fromCalendarId, range, refusal };
  };

  const toMoveRequest = (appointment: DayAppointment, target: MoveTarget): GridMoveRequest => {
    const { startUtc, endUtc } = rangeToInstants(target.day, target.range);
    return {
      appointment,
      calendarId: target.calendarId,
      dayKey: target.day,
      start: localDateTime(target.day, target.range.start),
      end: localDateTime(target.day, target.range.end),
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
      notifyPatient: rememberedNotify(),
    };
  };

  const commit = (request: GridMoveRequest) => {
    const id = request.appointment.id;
    args.onCommit(request).then(
      (notice) => {
        setOverrides((current) => {
          const o = current.get(id);
          if (!o) return current;
          const next = new Map(current);
          next.set(id, { ...o, settled: true });
          return next;
        });
        const element = cardElement(id);
        if (element) settle(element);
        args.onNotice({ text: movedNoticeFor(request.notifyPatient, notice), tone: 'info' });
      },
      (error: unknown) => {
        releaseOverride(id);
        if (args.onRefused?.(error, request) === true) return;
        args.onNotice({ text: args.describeError(error), tone: 'error' });
      },
    );
  };

  const cancelProposal = () => {
    if (proposal === null) return;
    setProposal(null);
    releaseOverride(proposal.appointment.id);
  };
  const confirmProposal = (request: GridMoveRequest) => {
    setProposal(null);
    commit(request);
  };

  const windowHandlers = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);

  const endPress = () => {
    const press = pressRef.current;
    if (press?.timer !== undefined) window.clearTimeout(press.timer);
    pressRef.current = null;
    const w = windowHandlers.current;
    if (w) {
      window.removeEventListener('pointermove', w.move);
      window.removeEventListener('pointerup', w.up);
      window.removeEventListener('pointercancel', w.cancel);
    }
  };

  const startDrag = (press: Press) => {
    press.started = true;
    if (press.timer !== undefined) window.clearTimeout(press.timer);
    press.timer = undefined;
    const fromCalendarId = press.appointment.calendarId ?? '';
    args.onDragStart();
    const { x, y } = pointerRef.current;
    setMoving({
      appointment: press.appointment,
      fromCalendarId,
      grabMinutes: press.grabMinutes,
      length: press.length,
      pointerType: press.pointerType,
      target: targetAt(press, x, y, fromCalendarId),
    });
  };

  const cancelDrag = () => {
    const press = pressRef.current;
    if (press?.started) justDraggedRef.current = true;
    endPress();
    setMoving(null);
  };

  const dropCard = () => {
    const press = pressRef.current;
    const current = movingRef.current;
    endPress();
    setMoving(null);
    if (!press?.started || current === null) return;
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
    const target = current.target;
    if (target === null) return;
    if (samePlace(current.appointment, target.day, target.range, target.calendarId, current.fromCalendarId)) return;
    if (target.refusal !== null) {
      args.onNotice({ text: `${GRID_TEXT.moveRefused} · ${refusalText(target.refusal)}`, tone: 'error' });
      return;
    }
    const request = toMoveRequest(current.appointment, target);
    setOverride(request.appointment.id, {
      appointment: current.appointment,
      startUtc: request.startUtc,
      endUtc: request.endUtc,
      settled: false,
    });
    setProposal(request);
  };

  const latest = useRef({ startDrag, cancelDrag, dropCard, targetAt });
  latest.current = { startDrag, cancelDrag, dropCard, targetAt };
  if (windowHandlers.current === null) {
    windowHandlers.current = {
      move: (event) => {
        const press = pressRef.current;
        if (!press || event.pointerId !== press.pointerId) return;
        pointerRef.current = { x: event.clientX, y: event.clientY };
        const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
        if (!press.started) {
          if (press.pointerType === 'mouse') {
            if (distance > DRAG_THRESHOLD_PX) latest.current.startDrag(press);
          } else if (distance > TOUCH_SCROLL_SLACK_PX) {
            latest.current.cancelDrag(); // a finger that moves before the long press is scrolling
          }
          return;
        }
        if (event.cancelable) event.preventDefault();
        const current = movingRef.current;
        if (current === null) return;
        const target = latest.current.targetAt(press, event.clientX, event.clientY, current.fromCalendarId);
        setMoving((m) => {
          if (m === null) return m;
          const same =
            m.target === target ||
            (m.target !== null &&
              target !== null &&
              m.target.col === target.col &&
              m.target.range.start === target.range.start &&
              m.target.refusal === target.refusal);
          return same ? m : { ...m, target };
        });
      },
      up: (event) => {
        const press = pressRef.current;
        if (!press || event.pointerId !== press.pointerId) return;
        pointerRef.current = { x: event.clientX, y: event.clientY };
        if (press.started) latest.current.dropCard();
        else latest.current.cancelDrag();
      },
      cancel: (event) => {
        const press = pressRef.current;
        if (!press || event.pointerId !== press.pointerId) return;
        latest.current.cancelDrag();
      },
    };
  }

  const press = (event: ReactPointerEvent<HTMLElement>, card: BookingCardModel) => {
    const board = boardRef.current;
    if (!enabled || !board || event.button !== 0 || !card.draggable || isTerminalStatus(card.appointment.status)) return;
    if (pressRef.current !== null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const scaleY = boardRect.height > 0 ? boardRect.height / g.height : 1;
    const span = spanOnDay(card.appointment.startUtc, card.appointment.endUtc, card.day);
    const next: Press = {
      appointment: card.appointment,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      grabMinutes: Math.max(0, (event.clientY - rect.top) / (g.pxPerMinute * scaleY)),
      length: Math.max(1, span.end - span.start),
      timer: undefined,
      started: false,
    };
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (next.pointerType !== 'mouse') {
      next.timer = window.setTimeout(() => {
        if (pressRef.current === next && !next.started) latest.current.startDrag(next);
      }, TOUCH_DRAG_PRESS_MS);
    }
    pressRef.current = next;
    const w = windowHandlers.current!;
    window.addEventListener('pointermove', w.move, { passive: false });
    window.addEventListener('pointerup', w.up);
    window.addEventListener('pointercancel', w.cancel);
  };

  /* An unmount mid-press must not leave listeners on the window. */
  useEffect(() => endPress, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Esc drops the drag and snaps back. */
  useEffect(() => {
    if (moving === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      latest.current.cancelDrag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moving]);

  /* A dragged card must not also scroll the page under the finger. */
  useEffect(() => {
    const node = boardRef.current;
    if (node === null) return undefined;
    const onTouchMove = (event: TouchEvent) => {
      if (movingRef.current !== null && event.cancelable) event.preventDefault();
    };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove);
  }, [boardRef]);

  return {
    moving,
    proposal,
    proposalAnchor,
    /** The bookings to draw: the server's, the moved ones at their new slot. */
    appointments,
    press,
    cancelProposal,
    confirmProposal,
    /** The click the browser fires after a drop is not a click on the card: read once, then cleared. */
    consumeJustDragged: () => {
      const was = justDraggedRef.current;
      justDraggedRef.current = false;
      return was;
    },
  };
}
