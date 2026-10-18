/*
 * CompactBoardChrome - what the tablet / phone board has beyond the file's toolbar:
 *
 *   - the calendar button that opens the mini-calendar + agenda drawer / sheet,
 *   - the "1 den / 7 dní" switch and, with one day shown, a strip of the seven days (swipe the board or tap a day),
 *   - `useBoardFit`: whether the board shows one day (it is too narrow for seven columns) or the whole week.
 *
 * The strip is portalled into `section.planner` (the board panel is not ours) and ordered between the toolbar and
 * the board by CSS. One day at a time is the SAME seven-column board, seven screens wide inside the board body's
 * horizontal scroller (`planner.compact.css`): every maths the board does - the marking of free time, the move of a
 * booking, the placement of a club window - is a ratio of the board's own rectangle, so nothing in it changes.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { weekHeadModel, type IsoDate } from '../../model';
import { usePlannerActions, usePlannerSelector } from '../../state/PlannerStoreProvider';
import { Icon } from '../Icons';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { WEEK_FIT_MIN_WIDTH } from './media';

export type BoardFit = 'day' | 'week';

/** One day or the week: the owner's choice, else what the board's width allows. */
export function useBoardFit(mainRef: RefObject<HTMLElement | null>): { fit: BoardFit; choose: (fit: BoardFit | null) => void; chosen: BoardFit | null } {
  const [width, setWidth] = useState<number>(0);
  const [chosen, setChosen] = useState<BoardFit | null>(null);
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mainRef]);
  /* A window with no layout (tests, hidden) reports 0: that is "narrow", the phone's default. */
  const auto: BoardFit = width >= WEEK_FIT_MIN_WIDTH ? 'week' : 'day';
  return { fit: chosen ?? auto, chosen, choose: setChosen };
}

/**
 * One day shown: keep the board body's horizontal scroll and the selected day in step. A swipe that settles on
 * another day selects it; a selected day (chip, mini calendar) scrolls the board to it.
 */
export function useDaySnap(mainRef: RefObject<HTMLElement | null>, fit: BoardFit, days: readonly IsoDate[], view: string): void {
  const act = usePlannerActions();
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const latest = useRef({ days, selectedDate });
  latest.current = { days, selectedDate };
  const settling = useRef(false);

  const dayWidth = (body: HTMLElement): number => {
    const hour = body.querySelector<HTMLElement>('.hour-column');
    return Math.max(1, body.clientWidth - (hour?.offsetWidth ?? 0));
  };
  const goTo = useCallback((body: HTMLElement, index: number, smooth: boolean) => {
    const left = index * dayWidth(body);
    if (Math.abs(body.scrollLeft - left) < 2) return;
    settling.current = true;
    if (typeof body.scrollTo === 'function') body.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    else body.scrollLeft = left;
    window.setTimeout(() => { settling.current = false; }, smooth ? 380 : 40);
  }, []);

  /* The selected day -> the scroll position. */
  useEffect(() => {
    if (fit !== 'day' || view !== 'week') return;
    const body = mainRef.current?.querySelector<HTMLElement>('#board-body');
    const index = days.indexOf(selectedDate);
    if (body && index >= 0) goTo(body, index, true);
  }, [fit, view, days, selectedDate, mainRef, goTo]);

  /* A swipe that comes to rest -> the day it rests on. */
  useEffect(() => {
    if (fit !== 'day' || view !== 'week') return undefined;
    const body = mainRef.current?.querySelector<HTMLElement>('#board-body');
    if (!body) return undefined;
    let timer: number | undefined;
    const settle = () => {
      const { days: list, selectedDate: current } = latest.current;
      const index = Math.min(list.length - 1, Math.max(0, Math.round(body.scrollLeft / dayWidth(body))));
      const day = list[index];
      goTo(body, index, true);
      if (day && day !== current) act.focusDate(day, false);
    };
    const onScroll = () => {
      if (settling.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 110);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    const index = latest.current.days.indexOf(latest.current.selectedDate);
    goTo(body, Math.max(0, index), false);
    return () => {
      window.clearTimeout(timer);
      body.removeEventListener('scroll', onScroll);
    };
  }, [fit, view, mainRef, act, goTo]);
}

export interface BoardStripProps {
  mainRef: RefObject<HTMLElement | null>;
  fit: BoardFit;
  onFit: (fit: BoardFit) => void;
  sidebarOpen: boolean;
  /** The sidebar is pinned as a column: there is nothing to open. */
  sidebarPinned: boolean;
  onOpenSidebar: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
}

export function BoardStrip({ mainRef, fit, onFit, sidebarOpen, sidebarPinned, onOpenSidebar, openerRef }: BoardStripProps) {
  const ctx = usePlannerCtx();
  const { dayMarks } = usePlannerModelState();
  const act = usePlannerActions();
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const view = usePlannerSelector((s) => s.view);
  const head = useMemo(() => weekHeadModel(weekStart, ctx.window), [weekStart, ctx.window]);
  const days = useMemo(() => head.days.map((d) => d.date), [head]);

  useDaySnap(mainRef, fit, days, view);

  /* The strip lives inside the board panel, which this file does not render. A passive effect: the wrapper's ref is
     attached after this component's layout effects, so only here is `mainRef` set on the very first pass. */
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = mainRef.current?.querySelector<HTMLElement>('section.planner') ?? null;
    if (el !== target) setTarget(el);
  });
  if (!target) return null;

  return createPortal(
    <div className="compact-strip" data-testid="compact-strip" data-fit={fit}>
      <div className="compact-strip-row">
        {sidebarPinned ? null : (
          <button
            ref={openerRef}
            type="button"
            className="compact-calendar-button"
            data-testid="compact-calendar-button"
            aria-haspopup="dialog"
            aria-expanded={sidebarOpen}
            onClick={onOpenSidebar}
          >
            <Icon name="calendar" />
            <span>Kalendář a termíny</span>
          </button>
        )}
        {view === 'week' ? (
          <div className="compact-fit view-segment" role="group" aria-label="Rozsah kalendáře">
            <button type="button" className={fit === 'day' ? 'active' : undefined} aria-pressed={fit === 'day'} data-testid="compact-fit-day" aria-label="Zobrazit jeden den" onClick={() => onFit('day')}>1 den</button>
            <button type="button" className={fit === 'week' ? 'active' : undefined} aria-pressed={fit === 'week'} data-testid="compact-fit-week" aria-label="Zobrazit celý týden" onClick={() => onFit('week')}>7 dní</button>
          </div>
        ) : null}
      </div>
      {view === 'week' && fit === 'day' ? (
        <div className="compact-days" role="group" aria-label="Dny týdne" data-testid="compact-days">
          {head.days.map((d) => {
            const mark = dayMarks[d.date];
            const selected = d.date === selectedDate;
            return (
              <button
                key={d.date}
                type="button"
                className={`compact-day${selected ? ' is-selected' : ''}${d.date === ctx.today ? ' is-today' : ''}${mark?.closed ? ' is-closed' : ''}`}
                data-day={d.date}
                aria-pressed={selected}
                aria-current={d.date === ctx.today ? 'date' : undefined}
                aria-label={`${d.weekName} ${d.label}${mark?.closed ? ' – zavřeno' : ''}`}
                onClick={() => act.focusDate(d.date, false)}
              >
                <span>{d.weekName}</span>
                <b>{d.label}</b>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>,
    target,
  );
}
