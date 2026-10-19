/*
 * Marking days in the month - the pointer half of `model/daySelect.ts`. A mouse presses on a day and drags across the
 * others; Ctrl, Cmd or Shift keeps what is marked and adds one more place. Touch has no modifier key: a press held
 * 380 ms starts the drag (a quick touch is the scroll or the tap), and the toggles "Vybrat od–do" / "Vybrat víc dnů"
 * turn taps into marks. The day under a finger is found from its coordinates, because a pressed touch keeps reporting
 * to the tile it began on. Days are found by `data-range-day="yyyy-MM-dd"` on the tiles; the month owns the markup.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, type RefObject } from 'react';
import { daySelectReducer, highlightOf, INITIAL_DAY_SELECT, placeStateOf, type DayChoice, type DayPlace } from '../../../model/daySelect';
import type { IsoDate } from '../../../model';

const LONG_PRESS_MS = 380;
/** The click a browser fires after a drag ended is not a click on the day. */
const AFTER_DRAG_MS = 400;

type PointerLike = { pointerType?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

export interface DaySelectApi {
  /** The run to light up: being dragged, waiting for the last tap, or chosen. */
  highlight: { from: IsoDate; to: IsoDate } | null;
  chosen: DayChoice | null;
  places: readonly DayPlace[];
  tapMode: boolean;
  additiveMode: boolean;
  dragging: boolean;
  /** Taps mark days (a toggle is on): the day must not also open. */
  tapsSelect: boolean;
  setTapMode: (on: boolean) => void;
  setAdditiveMode: (on: boolean) => void;
  begin: (day: IsoDate, event: PointerLike) => void;
  cancelPress: () => void;
  /** A tap on a day; `true` when it was used for marking. */
  tap: (day: IsoDate, point: { x: number; y: number }) => boolean;
  /** The click that ended a drag or added a place: it must not open the day. */
  swallowClick: (event?: PointerLike) => boolean;
  placeState: (day: IsoDate) => 'active' | 'past' | null;
  remove: (id: string) => void;
  dismissChosen: () => void;
  clear: () => void;
}

export function useDaySelect(today: IsoDate, enabled: boolean, surface: RefObject<HTMLElement | null>): DaySelectApi {
  const [state, dispatch] = useReducer(daySelectReducer, INITIAL_DAY_SELECT);
  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef<number | undefined>(undefined);
  const finishedAt = useRef(0);
  const lastDay = useRef<IsoDate | null>(null);
  const byTouch = useRef(false);

  const stopTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const additiveOf = (event: PointerLike) => stateRef.current.additiveMode || Boolean(event.ctrlKey || event.metaKey || event.shiftKey);

  const begin = useCallback<DaySelectApi['begin']>(
    (day, event) => {
      if (!enabled || stateRef.current.tapMode) return;
      const additive = additiveOf(event);
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        stopTimer();
        timer.current = window.setTimeout(() => {
          byTouch.current = true;
          lastDay.current = day;
          dispatch({ type: 'begin', day, additive });
        }, LONG_PRESS_MS);
        return;
      }
      byTouch.current = false;
      lastDay.current = day;
      dispatch({ type: 'begin', day, additive });
    },
    [enabled, stopTimer],
  );

  const tap = useCallback<DaySelectApi['tap']>(
    (day, point) => {
      if (!enabled) return false;
      if (Date.now() - finishedAt.current < AFTER_DRAG_MS) return stateRef.current.tapMode || stateRef.current.additiveMode;
      const s = stateRef.current;
      if (!s.tapMode && !s.additiveMode) return false;
      dispatch({ type: 'tap', day, x: point.x, y: point.y });
      return true;
    },
    [enabled],
  );

  const swallowClick = useCallback<DaySelectApi['swallowClick']>((event) => {
    if (Date.now() - finishedAt.current < AFTER_DRAG_MS) return true;
    /* Ctrl, Cmd or Shift on a day adds it to the marked places; it does not open it. */
    return enabled && Boolean(event && (event.ctrlKey || event.metaKey || event.shiftKey));
  }, [enabled]);

  const dragging = state.dragging;
  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: PointerEvent) => {
      if (typeof document.elementFromPoint !== 'function') return;
      const day = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-range-day]')?.dataset.rangeDay;
      if (day && day !== lastDay.current) {
        lastDay.current = day;
        dispatch({ type: 'enter', day });
      }
    };
    const onUp = (event: PointerEvent) => {
      /* A press and release on one day is a plain click and must reach the day; anything that travelled or added a place must not. */
      const s = stateRef.current;
      if (s.additive || s.anchor !== s.current || byTouch.current) finishedAt.current = Date.now();
      dispatch({ type: 'finish', x: event.clientX, y: event.clientY });
    };
    const node = surface.current;
    /* A drag on a touch screen must not also scroll the list. */
    const onTouchMove = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    node?.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node?.removeEventListener('touchmove', onTouchMove);
    };
  }, [dragging, surface]);

  /* Esc drops what is marked. */
  const anything = state.places.length > 0 || state.chosen !== null || state.anchor !== null;
  useEffect(() => {
    if (!anything) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'clear' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anything]);

  useEffect(() => stopTimer, [stopTimer]);
  /* Leaving the month (or the permission to mark) drops the marks. */
  useEffect(() => {
    if (!enabled) dispatch({ type: 'clear' });
  }, [enabled]);

  return useMemo<DaySelectApi>(
    () => ({
      highlight: highlightOf(state),
      chosen: state.chosen,
      places: state.places,
      tapMode: state.tapMode,
      additiveMode: state.additiveMode,
      dragging: state.dragging,
      tapsSelect: state.tapMode || state.additiveMode,
      setTapMode: (on) => dispatch({ type: 'setTapMode', on }),
      setAdditiveMode: (on) => dispatch({ type: 'setAdditiveMode', on }),
      begin,
      cancelPress: stopTimer,
      tap,
      swallowClick,
      placeState: (day) => placeStateOf(day, state.places, today),
      remove: (id) => dispatch({ type: 'remove', id }),
      dismissChosen: () => dispatch({ type: 'dismissChosen' }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state, begin, stopTimer, tap, swallowClick, today],
  );
}
