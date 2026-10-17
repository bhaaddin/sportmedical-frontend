/*
 * The pointer gestures of the planning board (prototype `board.addEventListener('pointer…')`):
 *
 *   empty board + armed činnost     placement drag    -> live preview -> mouse-up drops the interval
 *   press on a club term            move              -> after 7 px: ghost + HUD -> mouse-up asks to confirm
 *   press on a term's top/bottom    edge pull         -> after 4 px: range + HUD -> mouse-up asks to confirm
 *
 * It listens on the board element (found from the layer), so it works whatever draws the term cards, provided
 * a card is `.schedule-event` carrying its term id (`data-session-id`, `data-event-id`, `data-id` or
 * `data-term-id`) and its edge handles are `.term-resize-handle[data-expand-edge="top|bottom"]`.
 *
 * Only CLUB terms are moved / resized here (public bookings are moved by the standard booking flow, which
 * asks the patient). The pure rules are the model's (`edit.ts`, `placement.ts`), counted per činnost by
 * `placementPlan.ts`; the writes are done by the confirm dialogs and `usePlanCommit`.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  beginMove,
  beginResize,
  moveConfirmModel,
  moveHasStarted,
  pointerCoords,
  proposalForMove,
  proposalForTermExpansion,
  resizeHasStarted,
  sourceFor,
  type DayMark,
  type MovePreview,
  type PlacementPreview,
  type PlannerContext,
  type PlannerSession,
  type ResizeEdge,
} from '../../model';
import { usePlannerActions, usePlannerStore } from '../../state/PlannerStoreProvider';
import { guardResize, planSelection, planStart } from './placementPlan';
import type { OrderFigures } from './orderFigures';
import type { PlanCommit } from './usePlanCommit';

/** Latest values the handlers read (they are attached once). */
export interface GestureInputs {
  ctx: PlannerContext;
  figures: OrderFigures;
  dayMarks: Readonly<Record<string, DayMark>>;
  orderId: string | null;
  /** The činnosti bubble is wanted for a dropped window (more than one činnost is still open). */
  wantsAsk: boolean;
  /** A club order is planned. Standard booking (`order.club === false`) has nothing to plan: the layer stays silent. */
  clubMode: boolean;
  commit: PlanCommit;
}

const ID_ATTRS = ['sessionId', 'eventId', 'id', 'termId'] as const;

/** The term id carried by a card element. */
export function sessionIdOf(card: Element | null): string | null {
  if (!(card instanceof HTMLElement)) return null;
  for (const attr of ID_ATTRS) {
    const v = card.dataset[attr];
    if (v) return v;
  }
  return null;
}

const samePreview = (a: PlacementPreview | null, b: PlacementPreview | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.date === b.date && a.start === b.start && a.end === b.end && a.quantity === b.quantity && a.validation.ok === b.validation.ok && a.validation.reason === b.validation.reason && a.categoryId === b.categoryId);

export function useBoardGestures(board: HTMLElement | null, inputs: GestureInputs): void {
  const store = usePlannerStore();
  const act = usePlannerActions();
  const latest = useRef(inputs);
  useLayoutEffect(() => {
    latest.current = inputs;
  });
  const suppress = useRef<{ id: string; until: number } | null>(null);
  const originCard = useRef<HTMLElement | null>(null);

  /* The board knows when a činnost is armed (`is-armed`) and what is going on (`drag-in-progress` …). */
  useEffect(() => {
    if (!board) return undefined;
    const sync = () => {
      const p = store.getState().planning;
      board.classList.toggle('is-armed', p.selectedCategoryId !== null);
      board.classList.toggle('drag-in-progress', p.drag !== null);
      board.classList.toggle('moving-existing-term', p.move?.started === true);
      board.classList.toggle('resizing-existing-term', p.resize?.started === true);
      const card = originCard.current;
      if (card) {
        card.classList.toggle('is-moving-origin', p.move?.started === true);
        card.classList.toggle('is-resizing-origin', p.resize?.started === true);
        if (!p.move && !p.resize) originCard.current = null;
      }
    };
    sync();
    return store.subscribe(sync);
  }, [board, store]);

  useEffect(() => {
    if (!board) return undefined;

    const rectOf = () => board.getBoundingClientRect();
    const scaleOf = () => {
      const r = rectOf();
      return r.height / Math.max(1, board.clientHeight) || 1;
    };

    const findClubTerm = (target: EventTarget | null): { card: HTMLElement; session: PlannerSession } | null => {
      const card = target instanceof Element ? target.closest<HTMLElement>('.schedule-event') : null;
      const id = sessionIdOf(card);
      if (!card || !id) return null;
      const session = latest.current.ctx.sessions.find((s) => s.id === id);
      if (!session || sourceFor(session) !== 'club' || session.foreign) return null;
      return { card, session };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!latest.current.clubMode) return;
      const state = store.getState();
      if (e.button !== 0 || state.dialog || state.summary.open || state.drawer || state.planning.ask) return;
      if (state.view !== 'week') return;
      const p = state.planning;
      if (p.move || p.resize) return;
      const { ctx, figures } = latest.current;
      const target = e.target instanceof Element ? e.target : null;
      const onCard = target?.closest('.schedule-event') ?? null;

      if (onCard) {
        const hit = findClubTerm(onCard);
        if (!hit || p.drag) return;
        const handle = target?.closest<HTMLElement>('.term-resize-handle');
        if (handle) {
          const edge = (handle.dataset.expandEdge ?? handle.dataset.edge) as ResizeEdge | undefined;
          const drag = edge ? beginResize(hit.session, edge, e) : null;
          if (!drag) return;
          originCard.current = hit.card;
          act.beginResize(drag);
        } else {
          originCard.current = hit.card;
          act.beginMove(beginMove(ctx, hit.session, e, rectOf()));
        }
        try { board.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
        e.preventDefault();
        return;
      }

      // Empty board: placement of the armed činnost.
      const selected = p.selectedCategoryId;
      if (!selected) {
        /* The board's own marking of free time (the real calendar) owns an unarmed press. */
        if (board.dataset.pickable !== 'true') act.toast('Nejprve klikněte na činnost ve spodních kartách.');
        return;
      }
      const start = planStart(ctx, figures, selected, pointerCoords(rectOf(), e.clientX, e.clientY), p.extraArmed);
      if (start.kind === 'noSelection') {
        act.toast('Nejprve klikněte na činnost ve spodních kartách.');
        return;
      }
      if (start.kind === 'complete') {
        act.clearPlanningSelection();
        act.showCompletion(start.categoryId, true);
        return;
      }
      act.beginPlacement(start.drag);
      try { board.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      act.updatePlacement(planSelection(ctx, figures, start.drag, selected, store.getState().weekStart, pointerCoords(rectOf(), e.clientX, e.clientY), latest.current.dayMarks, p.extraArmed));
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = store.getState();
      const p = state.planning;
      const { ctx, figures, dayMarks } = latest.current;
      if (p.move && e.pointerId === p.move.pointerId) {
        if (!p.move.started) {
          if (!moveHasStarted(p.move, e.clientX, e.clientY)) return;
          act.updateMove(true, null);
        }
        act.updateMove(true, proposalForMove(ctx, p.move, e, rectOf(), state.weekStart));
        return;
      }
      if (p.resize && e.pointerId === p.resize.pointerId) {
        if (!p.resize.started) {
          if (!resizeHasStarted(p.resize, e.clientY)) return;
          act.updateResize(true, null);
        }
        act.updateResize(true, guardResize(proposalForTermExpansion(ctx, p.resize, e.clientY, scaleOf(), state.weekStart, board.clientHeight || undefined), figures));
        return;
      }
      if (p.drag && p.selectedCategoryId) {
        const next = planSelection(ctx, figures, p.drag, p.selectedCategoryId, state.weekStart, pointerCoords(rectOf(), e.clientX, e.clientY), dayMarks, p.extraArmed);
        if (!samePreview(p.preview, next)) act.updatePlacement(next);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const state = store.getState();
      const p = state.planning;
      const { ctx, figures, dayMarks, wantsAsk, commit, orderId } = latest.current;

      if (p.move && e.pointerId === p.move.pointerId) {
        const drag = p.move;
        const proposal = drag.started ? proposalForMove(ctx, drag, e, rectOf(), state.weekStart) : null;
        suppress.current = { id: drag.id, until: Date.now() + 450 };
        act.endMove();
        if (!drag.started || !proposal) return;
        if (!proposal.validation.ok) {
          act.toast(proposal.validation.reason || 'Přesun nebyl možný. Termín zůstal beze změny.');
          return;
        }
        const model = moveConfirmModel(ctx, proposal as MovePreview);
        if (!model || model.unchanged) return;
        act.openDialog({ kind: 'moveConfirm', proposal });
        return;
      }
      if (p.resize && e.pointerId === p.resize.pointerId) {
        const drag = p.resize;
        const proposal = drag.started ? guardResize(proposalForTermExpansion(ctx, drag, e.clientY, scaleOf(), state.weekStart, board.clientHeight || undefined), figures) : null;
        suppress.current = { id: drag.id, until: Date.now() + 550 };
        act.endResize();
        if (!drag.started || !proposal || !proposal.added) return;
        if (!proposal.validation.ok) {
          act.toast(proposal.validation.reason);
          return;
        }
        act.openDialog({ kind: 'expandConfirm', proposal });
        return;
      }
      if (p.drag && p.selectedCategoryId) {
        const result = planSelection(ctx, figures, p.drag, p.selectedCategoryId, state.weekStart, pointerCoords(rectOf(), e.clientX, e.clientY), dayMarks, p.extraArmed);
        act.endPlacement();
        try { if (board.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId); } catch { /* released */ }
        if (!result) return;
        if (!result.validation.ok) {
          act.toast(result.validation.reason);
          return;
        }
        if (wantsAsk && !p.extraArmed) {
          act.openPlanAsk({ date: result.date, categoryId: result.categoryId, startMinutes: result.startMinutes, slots: result.quantity });
          return;
        }
        void commit.drop(ctx, figures, { date: result.date, categoryId: result.categoryId, startMinutes: result.startMinutes, quantity: result.quantity }, { orderId });
      }
    };

    const onPointerCancel = () => {
      const p = store.getState().planning;
      if (p.move) act.endMove();
      if (p.resize) act.endResize();
      if (p.drag) act.endPlacement();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      act.rightClick(true);
    };

    /* The click that follows a move / an edge pull must not open the term's detail. */
    const onClickCapture = (e: MouseEvent) => {
      const s = suppress.current;
      if (!s || Date.now() > s.until) return;
      const id = sessionIdOf(e.target instanceof Element ? e.target.closest('.schedule-event') : null);
      if (id === s.id) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', onPointerCancel);
    board.addEventListener('contextmenu', onContextMenu);
    board.addEventListener('click', onClickCapture, true);
    return () => {
      board.removeEventListener('pointerdown', onPointerDown);
      board.removeEventListener('pointermove', onPointerMove);
      board.removeEventListener('pointerup', onPointerUp);
      board.removeEventListener('pointercancel', onPointerCancel);
      board.removeEventListener('contextmenu', onContextMenu);
      board.removeEventListener('click', onClickCapture, true);
    };
  }, [board, store, act]);
}
