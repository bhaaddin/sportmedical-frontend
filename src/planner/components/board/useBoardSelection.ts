/*
 * Marking free time on the board: press on an empty place of a day, drag down (or up) across the
 * slots, let go - the selection popover asks what to do with it (book a patient, block the time,
 * add it to a club order). A click without travelling marks that one slot. On touch a press held
 * 380 ms starts the drag and a tap marks one slot; moving first is a scroll.
 *
 * The drag lives in one day (the column it began in) and snaps to the step of the chosen
 * resolution (or the calendar's own, whichever is finer), exactly as the old grid's `SubColumn`.
 * It never starts on a card or a window, on a closed day, or while the planning layer owns the
 * pointer (`paused`).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { MinuteRange } from '../../../components/booking/grid/timeRange';
import type { IsoDate } from '../../model';
import { columnAtFraction, minuteAtY, selectionRange, type BoardGeometry } from './boardGeometry';

const LONG_PRESS_MS = 380;

export interface BoardSelection {
  col: number;
  day: IsoDate;
  range: MinuteRange;
  /** Client position where the pointer was let go (the popover opens there). */
  x: number;
  y: number;
}

export interface UseBoardSelectionArgs {
  boardRef: RefObject<HTMLElement | null>;
  geometry: BoardGeometry;
  days: readonly IsoDate[];
  /** Minutes of one slot in the drag. */
  step: number;
  enabled: boolean;
  /** Can this day be marked at all (not closed)? */
  dayOpen: (day: IsoDate) => boolean;
  onSelect: (selection: BoardSelection) => void;
}

interface Drag {
  col: number;
  anchor: number;
  current: number;
}

export function useBoardSelection(args: UseBoardSelectionArgs) {
  const { boardRef, geometry: g } = args;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const touch = useRef<{ x: number; y: number; col: number; minute: number; timer: number | undefined; dragging: boolean } | null>(null);
  const latest = useRef(args);
  latest.current = args;

  useEffect(
    () => () => {
      if (touch.current?.timer !== undefined) window.clearTimeout(touch.current.timer);
    },
    [],
  );

  /* A drag on a touch screen must not also scroll the page. */
  useEffect(() => {
    const node = boardRef.current;
    if (!node) return undefined;
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current !== null && event.cancelable) event.preventDefault();
    };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove);
  }, [boardRef]);

  const locate = (event: { clientX: number; clientY: number }): { col: number; minute: number } | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const scaleY = rect.height > 0 ? rect.height / g.height : 1;
    const col = columnAtFraction(rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0);
    return { col, minute: minuteAtY(g, Math.max(0, (event.clientY - rect.top) / scaleY)) };
  };

  const finish = (col: number, anchor: number, end: number, x: number, y: number) => {
    const a = latest.current;
    const day = a.days[col];
    if (!day) return;
    a.onSelect({ col, day, range: selectionRange(a.geometry, anchor, end, a.step), x, y });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const a = latest.current;
    if (!a.enabled || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-board-item], .schedule-event, .term-resize-handle, .board-chip')) return;
    const at = locate(event);
    if (!at) return;
    const day = a.days[at.col];
    if (!day || !a.dayOpen(day)) return;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      const press = { x: event.clientX, y: event.clientY, col: at.col, minute: at.minute, dragging: false, timer: undefined as number | undefined };
      press.timer = window.setTimeout(() => {
        press.dragging = true;
        setDrag({ col: at.col, anchor: at.minute, current: at.minute });
      }, LONG_PRESS_MS);
      touch.current = press;
      return;
    }
    const element = event.currentTarget;
    if (typeof element.setPointerCapture === 'function') {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        /* a pointer the browser no longer tracks; the drag still works inside the board */
      }
    }
    setDrag({ col: at.col, anchor: at.minute, current: at.minute });
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const press = touch.current;
    if (press && !press.dragging) {
      if (Math.abs(event.clientX - press.x) > 8 || Math.abs(event.clientY - press.y) > 8) {
        window.clearTimeout(press.timer);
        touch.current = null; // moving before the long press is a scroll
      }
      return;
    }
    const current = dragRef.current;
    if (!current) return;
    const at = locate(event);
    if (at) setDrag({ ...current, current: at.minute });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const press = touch.current;
    if (press) {
      touch.current = null;
      window.clearTimeout(press.timer);
      if (!press.dragging) {
        /* A tap on a free place: that one slot is the selection. */
        finish(press.col, press.minute, press.minute, event.clientX, event.clientY);
        return;
      }
    }
    const current = dragRef.current;
    if (!current) return;
    const at = locate(event);
    setDrag(null);
    finish(current.col, current.anchor, at ? at.minute : current.current, event.clientX, event.clientY);
  };

  const onPointerCancel = () => {
    if (touch.current) window.clearTimeout(touch.current.timer);
    touch.current = null;
    setDrag(null);
  };

  /* Esc drops a drag in progress. */
  useEffect(() => {
    if (drag === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const live = drag ? { col: drag.col, range: selectionRange(g, drag.anchor, drag.current, args.step) } : null;
  return { live, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
