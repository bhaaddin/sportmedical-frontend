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
import { TIMELINE_HEIGHT, slotMinutesOf } from '../model';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState } from './context';
import { MoveLayer, PlacementLayer, ResizeLayer } from './plan/BoardLayers';
import { PlanAskHost, heldWindow } from './plan/PlanAskHost';
import type { BoardSize } from './plan/boardOverlays';
import { usePlanCommit } from './plan/usePlanCommit';
import { useBoardGestures } from './plan/useBoardGestures';
import { usePlanFigures } from './plan/usePlanFigures';
import './plan/plan.css';

const FALLBACK: BoardSize = { width: 1000, height: TIMELINE_HEIGHT };

export interface PlanningBoardLayerProps {
  /** The board element, when the owner has it at hand; else it is the layer's parent element. */
  board?: HTMLElement | null;
}

export function PlanningBoardLayer({ board: boardProp }: PlanningBoardLayerProps = {}) {
  const ctx = usePlannerCtx();
  const { dayMarks, order } = usePlannerModelState();
  const { base } = usePlanFigures();
  const commit = usePlanCommit();
  const ask = usePlannerSelector((s) => s.planning.ask);
  const weekStart = usePlannerSelector((s) => s.weekStart);

  const anchor = useRef<HTMLElement | null>(null);
  const [board, setBoard] = useState<HTMLElement | null>(boardProp ?? null);
  const [size, setSize] = useState<BoardSize>(FALLBACK);

  useLayoutEffect(() => {
    const el = boardProp ?? anchor.current?.closest<HTMLElement>('#day-board') ?? anchor.current?.parentElement ?? null;
    setBoard(el);
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
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

  const wantsAsk = base.list.filter((f) => f.requested > 0 && !f.done).length >= 2;
  useBoardGestures(board, {
    ctx,
    figures: base,
    dayMarks,
    orderId: order?.id ?? null,
    wantsAsk,
    clubMode: order?.club !== false,
    commit,
  });

  const held = useMemo(() => (ask ? heldWindow(ask, slotMinutesOf(ctx, ask.categoryId), weekStart) : null), [ask, ctx, weekStart]);
  const heldVisible = held && held.col >= 0 && held.col <= 6 ? held : null;

  return (
    <>
      <i ref={anchor} hidden aria-hidden="true" data-testid="planning-board-layer" />
      <PlacementLayer board={size} held={heldVisible} />
      <MoveLayer board={size} />
      <ResizeLayer board={size} />
      <PlanAskHost />
    </>
  );
}
