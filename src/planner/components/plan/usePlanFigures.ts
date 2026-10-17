/*
 * The figures every club-planning panel shows, from the one calculation (`orderFigures`):
 *
 *   base   the order as it stands
 *   live   the order with the gesture in progress counted in (the placement drag, or a valid edge pull
 *          of a club term) - the cards, the summary card and the command panel preview it
 *
 * `hasPreview` is the category the live figures differ for, `added` the players the gesture adds there.
 */
import { useMemo } from 'react';
import { slotMinutesOf, timeAsMinutes } from '../../model';
import { usePlannerSelector } from '../../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { orderFigures, previewFigures, previewWindow, type OrderFigures } from './orderFigures';
import { useClubPlanningContext } from './useClubPlanningContext';

export interface PlanFigures {
  base: OrderFigures;
  live: OrderFigures;
  /** The činnost a valid gesture currently adds players to (null = no gesture / nothing added). */
  previewCategoryId: string | null;
  added: number;
  willComplete: boolean;
}

export function usePlanFigures(): PlanFigures {
  const ctx = usePlannerCtx();
  const { order } = usePlannerModelState();
  const { session } = useClubPlanningContext();
  const placement = usePlannerSelector((s) => s.planning.preview);
  const resize = usePlannerSelector((s) => s.planning.resizePreview);
  const baseline = session?.editOrder?.baseline;
  const orderId = order?.id ?? null;

  const base = useMemo(
    () => orderFigures(ctx, { orderId, ...(baseline ? { baseline } : {}) }),
    [ctx, orderId, baseline],
  );

  return useMemo<PlanFigures>(() => {
    const options = { orderId, ...(baseline ? { baseline } : {}) };
    if (placement && placement.validation.ok && placement.quantity > 0) {
      const window = previewWindow('preview', placement.date, placement.categoryId, placement.startMinutes, placement.quantity, slotMinutesOf(ctx, placement.categoryId));
      const p = previewFigures(ctx, base, window, options);
      return { base, live: p.after, previewCategoryId: p.added > 0 ? placement.categoryId : null, added: p.added, willComplete: p.willComplete };
    }
    if (resize && resize.validation.ok && resize.added > 0 && resize.original.origin !== 'public') {
      const slot = slotMinutesOf(ctx, resize.categoryId);
      const from = resize.edge === 'top' ? resize.startMinutes : timeAsMinutes(resize.original.end);
      const window = previewWindow('preview', resize.date, resize.categoryId, from, resize.added, slot);
      const p = previewFigures(ctx, base, window, options);
      return { base, live: p.after, previewCategoryId: p.added > 0 ? resize.categoryId : null, added: p.added, willComplete: p.willComplete };
    }
    return { base, live: base, previewCategoryId: null, added: 0, willComplete: false };
  }, [ctx, base, placement, resize, orderId, baseline]);
}
