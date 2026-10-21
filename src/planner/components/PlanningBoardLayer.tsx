/*
 * PlanningBoardLayer - everything club planning puts on the week board. PL-D's board mounts ONE of these
 * inside `#day-board` (after the term cards):
 *
 *     <div id="day-board" class="day-board"> … <div id="grid-events"/> <PlanningBoardLayer /> </div>
 *
 * It draws the three live overlays (placement preview + HUD, move ghost + lanes + HUD, edge-pull range + HUD),
 * keeps the board's `is-armed` / `drag-in-progress` / `moving-existing-term` / `resizing-existing-term` classes,
 * listens to the board's pointer gestures (`plan/useBoardGestures.ts`) and hosts the činnosti bubble of a
 * dropped window (`plan/PlanAskHost.tsx`). It owns the ids `drag-preview`, `drag-hud`, `move-lanes`,
 * `move-ghost`, `move-hud`, `term-resize-range`, `term-resize-added`, `term-resize-hud` - the board must NOT
 * render them itself.
 *
 * The cards stay the board's: a card is `.schedule-event` with its term id in `data-session-id` (or
 * `data-event-id` / `data-id` / `data-term-id`), its edge handles `.term-resize-handle[data-expand-edge]`.
 * The click that follows a move or an edge pull is swallowed here, so a card's own onClick (the detail) does not
 * fire after a drag.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TIMELINE_HEIGHT, piecesOf, slotMinutesOf } from '../model';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState } from './context';
import { MoveLayer, PlacementLayer, ResizeLayer } from './plan/BoardLayers';
import { PlanAskHost, heldWindow } from './plan/PlanAskHost';
import type { BoardSize } from './plan/boardOverlays';
import { usePlanCommit } from './plan/usePlanCommit';
import { useBoardGestures } from './plan/useBoardGestures';
import { usePlanFigures } from './plan/usePlanFigures';
import { placementSnapFor } from './board/boardZoom';
import { useBoardSettings } from './board/boardSettings';
import './plan/plan.css';

const FALLBACK: BoardSize = { width: 1000, height: TIMELINE_HEIGHT };

export interface PlanningBoardLayerProps {
  /** The board element, when the owner has it at hand; else it is the layer's parent element. */
  board?: HTMLElement | null;
}

export function PlanningBoardLayer({ board: boardProp }: PlanningBoardLayerProps = {}) {
  const ctx = usePlannerCtx();
  const { dayMarks: rawMarks, order, catalogue } = usePlannerModelState();
  /* A real source lists every day with its opening hours: a day without any is a non-working day. The lab's demo
     source draws the file, which plans on any day. */
  const strictHours = catalogue?.capabilities.simulateBookings === false;
  const dayMarks = useMemo(() => {
    if (!strictHours) return rawMarks;
    return Object.fromEntries(
      Object.entries(rawMarks).map(([d, m]) => [d, m.closed || m.hours ? m : { ...m, closed: true, label: m.label ?? 'nepracovní den' }]),
    );
  }, [rawMarks, strictHours]);
  const { base } = usePlanFigures();
  const commit = usePlanCommit();
  const ask = usePlannerSelector((s) => s.planning.ask);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  /* The pointer lands on the rows the board draws: the file's 5 minutes at 1x, the visible grid line from 2x up. */
  const snap = placementSnapFor(useBoardSettings().zoom);

  const anchor = useRef<HTMLElement | null>(null);
  const [board, setBoard] = useState<HTMLElement | null>(boardProp ?? null);
  const [size, setSize] = useState<BoardSize>(FALLBACK);
  /* How far the board's scroll region (a zoomed-in board scrolls inside its panel) shows: the HUDs stay inside it. */
  const [view, setView] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = boardProp ?? anchor.current?.closest<HTMLElement>('#day-board') ?? anchor.current?.parentElement ?? null;
    setBoard(el);
    if (!el) return undefined;
    const measure = () => {
      /* Layout px, fractional on the fluid stage (`clientWidth` / `clientHeight` are integers). */
      const cs = getComputedStyle(el);
      const w = parseFloat(cs.width) || el.clientWidth;
      const h = parseFloat(cs.height) || el.clientHeight;
      setSize((prev) => {
        const next = { width: w || FALLBACK.width, height: h || FALLBACK.height };
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardProp]);

  useLayoutEffect(() => {
    const el = board?.closest<HTMLElement>('.board-body') ?? null;
    if (!el) return undefined;
    const read = () => {
      const cs = getComputedStyle(el);
      const height = parseFloat(cs.height) || el.clientHeight;
      /* Only a body that really scrolls has a smaller view than the board. */
      setView((prev) => {
        const top = Math.round(el.scrollTop * 10) / 10;
        if (prev && prev.top === top && prev.height === height) return prev;
        return { top, height };
      });
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, [board]);

  const wantsAsk = base.list.filter((f) => f.requested > 0 && !f.done).length >= 2;
  useBoardGestures(board, {
    ctx,
    figures: base,
    dayMarks,
    orderId: order?.id ?? null,
    wantsAsk,
    clubMode: order?.club !== false,
    commit,
    snap,
  });

  const held = useMemo(() => (ask ? heldWindow(ask, slotMinutesOf(ctx, ask.categoryId), weekStart, piecesOf(ctx, ask.date)) : null), [ask, ctx, weekStart]);
  const heldVisible = held && held.col >= 0 && held.col <= 6 ? held : null;

  const sized = useMemo<BoardSize>(() => (view && view.height > 0 && view.height < size.height - 1 ? { ...size, viewTop: view.top, viewHeight: view.height } : size), [size, view]);

  return (
    <>
      <i ref={anchor} hidden aria-hidden="true" data-testid="planning-board-layer" />
      <PlacementLayer board={sized} held={heldVisible} />
      <MoveLayer board={sized} />
      <ResizeLayer board={sized} />
      <PlanAskHost />
    </>
  );
}
