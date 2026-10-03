import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { DateOnly } from "../../../utils/time";
import { orderRange, type DayRange } from "./model";

/*
 * Picking a run of days by dragging across them (month and week), or - on a
 * touch screen - by pressing and holding, or by tapping the first day and then
 * the last. One small state machine shared by both views, so a range looks and
 * ends the same wherever it was drawn.
 *
 *   idle ──begin──▶ dragging ──finish (2+ days)──▶ chosen (popover open)
 *                               └─ finish (1 day) ─▶ idle
 *   idle ──tap(first)──▶ waiting ──tap(last)──▶ chosen
 *
 * Days are found with `data-range-day="yyyy-MM-dd"` on the cells, so the view
 * that draws them owns the markup and this owns the gesture.
 */

export interface RangeChoice extends DayRange {
  /** Where the pointer was let go - the popover opens next to it. */
  x: number;
  y: number;
}

export interface DayRangeApi {
  /** The days to highlight right now: being dragged, waiting for the last tap, or chosen. */
  highlight: DayRange | null;
  /** The finished pick whose popover is open. */
  chosen: RangeChoice | null;
  /** Touch "tap first, tap last" mode, switched on from the toolbar. */
  tapMode: boolean;
  setTapMode: (on: boolean) => void;
  /** Pointer pressed on a day. Touch presses wait for a long press first. */
  begin: (day: DateOnly, event?: { pointerType?: string }) => void;
  /** The pointer is over another day while pressed. */
  enter: (day: DateOnly) => void;
  /** The pointer was let go. */
  finish: (point: { x: number; y: number }) => void;
  /** A touch lifted before the long press finished - it was a tap, not a drag. */
  cancelPress: () => void;
  /** A tap on a day in tap mode; `true` when it was used. */
  tap: (day: DateOnly, point: { x: number; y: number }) => boolean;
  /** Anything in progress or chosen is dropped. */
  clear: () => void;
  /** Whether a drag is under way (the surface stops scrolling then). */
  dragging: boolean;
}

const LONG_PRESS_MS = 380;

export function useDayRange(): DayRangeApi {
  const [anchor, setAnchor] = useState<DateOnly | null>(null);
  const [current, setCurrent] = useState<DateOnly | null>(null);
  const [dragging, setDragging] = useState(false);
  const [chosen, setChosen] = useState<RangeChoice | null>(null);
  const [tapMode, setTapMode] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const draggingRef = useRef(false);
  const lastRef = useRef<DateOnly | null>(null);

  const stopTimer = () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  const start = useCallback((day: DateOnly) => {
    draggingRef.current = true;
    lastRef.current = day;
    setDragging(true);
    setAnchor(day);
    setCurrent(day);
    setChosen(null);
  }, []);

  const begin = useCallback<DayRangeApi["begin"]>(
    (day, event) => {
      if (event?.pointerType === "touch" || event?.pointerType === "pen") {
        stopTimer();
        timer.current = window.setTimeout(() => start(day), LONG_PRESS_MS);
        return;
      }
      start(day);
    },
    [start],
  );

  const enter = useCallback((day: DateOnly) => {
    if (!draggingRef.current) return;
    lastRef.current = day;
    setCurrent(day);
  }, []);

  const clear = useCallback(() => {
    stopTimer();
    draggingRef.current = false;
    lastRef.current = null;
    setDragging(false);
    setAnchor(null);
    setCurrent(null);
    setChosen(null);
  }, []);

  const finish = useCallback<DayRangeApi["finish"]>(
    (point) => {
      stopTimer();
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      const a = anchor;
      const c = lastRef.current ?? current;
      if (a === null || c === null || a === c) {
        setAnchor(null);
        setCurrent(null);
        return;
      }
      setChosen({ ...orderRange(a, c), x: point.x, y: point.y });
    },
    [anchor, current],
  );

  const cancelPress = useCallback(() => stopTimer(), []);

  const tap = useCallback<DayRangeApi["tap"]>(
    (day, point) => {
      if (!tapMode) return false;
      if (anchor === null || chosen !== null) {
        setChosen(null);
        setAnchor(day);
        setCurrent(day);
        return true;
      }
      if (anchor === day) {
        setAnchor(null);
        setCurrent(null);
        return true;
      }
      setChosen({ ...orderRange(anchor, day), x: point.x, y: point.y });
      return true;
    },
    [tapMode, anchor, chosen],
  );

  useEffect(() => () => stopTimer(), []);

  const highlight: DayRange | null = chosen
    ? { from: chosen.from, to: chosen.to }
    : anchor !== null && current !== null
      ? orderRange(anchor, current)
      : null;

  return { highlight, chosen, tapMode, setTapMode, begin, enter, finish, cancelPress, tap, clear, dragging };
}

/**
 * Wires the moves of a drag that the cells themselves cannot see: a pressed
 * touch keeps reporting to the cell it started on, so the day under the finger
 * is found from its coordinates; the page is stopped from scrolling while a
 * drag is under way; and a button let go outside the grid still ends it.
 */
export function useDayRangeSurface(ref: RefObject<HTMLElement | null>, api: DayRangeApi | undefined) {
  const enter = api?.enter;
  const finish = api?.finish;
  const dragging = api?.dragging ?? false;
  useEffect(() => {
    const node = ref.current;
    if (!node || !dragging || !enter || !finish) return;
    const onMove = (event: PointerEvent) => {
      if (typeof document.elementFromPoint !== "function") return;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const day = el?.closest<HTMLElement>("[data-range-day]")?.dataset.rangeDay;
      if (day) enter(day);
    };
    const onUp = (event: PointerEvent) => finish({ x: event.clientX, y: event.clientY });
    const onTouchMove = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [ref, dragging, enter, finish]);
}
