/*
 * The few things club planning does from several places (the carousel's summary card, the command panel,
 * the corner button, the dialogs): arming a činnost, going back to the order, opening the publication.
 */
import { useMemo, useRef } from 'react';
import { usePlannerMetrics } from '../PlannerMetrics';
import { usePlannerActions, usePlannerStore } from '../../state/PlannerStoreProvider';
import { planFx } from '../../motion/planFx';
import type { OrderFigures } from './orderFigures';

export interface PlanActions {
  /** Arm a činnost for planning (or disarm it again, or say it is already complete). */
  selectCategory: (figures: OrderFigures, categoryId: string) => void;
  /**
   * Arm a činnost whatever the way (the callout's "Jiná činnost", the overview's "Plánovat →", "Doplnit termíny"):
   * the deck first turns to the page that shows its card (a page change would end the selection), then it is armed.
   * `extra`: the one extra drop beyond the players ("Přidat termín navíc").
   */
  arm: (figures: OrderFigures, categoryId: string, options?: { extra?: boolean; toast?: string }) => void;
  /** "Zpět": nothing armed, the order overview opens (`backToOrder`). */
  backToOrder: () => void;
  /** The order overview without leaving the armed činnost (`orderDetails`). */
  orderDetails: () => void;
  /** "Připravit formulář" (`adaptivePublishDialog`). */
  publish: () => void;
  openSummary: () => void;
}

export function usePlanActions(): PlanActions {
  const act = usePlannerActions();
  const store = usePlannerStore();
  /* Cards the deck shows at once (2 in the file, more on a wider fluid stage): read when a činnost is armed. */
  const deckVisibleRef = useRef(2);
  deckVisibleRef.current = usePlannerMetrics().deckVisible;
  return useMemo<PlanActions>(() => {
    const arm: PlanActions['arm'] = (figures, categoryId, options = {}) => {
      const f = figures.byId.get(categoryId);
      if (!f) return;
      const quantity = figures.list.length;
      const index = figures.list.findIndex((x) => x.categoryId === categoryId);
      const page = store.getState().carousel.index;
      const visible = deckVisibleRef.current;
      if (quantity > visible && (index < page || index > page + visible - 1)) act.carouselTo(Math.min(index, quantity - visible), quantity, visible);
      act.setExtraArmed(options.extra === true);
      if (store.getState().planning.selectedCategoryId === categoryId) return; // already armed: arming twice would disarm it
      act.selectPlanningCategory(categoryId, options.toast ?? `Aktivní: ${f.name}. Táhněte myší v kalendáři.`);
    };
    return {
      arm,
      selectCategory: (figures, categoryId) => {
        const f = figures.byId.get(categoryId);
        if (!f) return;
        const planning = store.getState().planning;
        // Clicking the armed card again disarms it (the reducer says "Výběr činnosti zrušen").
        if (planning.selectedCategoryId === categoryId) {
          act.selectPlanningCategory(categoryId);
          return;
        }
        if (f.done) {
          planFx.refuse();
          act.clearPlanningSelection();
          act.showCompletion(categoryId, true);
          return;
        }
        arm(figures, categoryId);
      },
      backToOrder: () => {
        act.clearPlanningSelection();
        act.openDialog({ kind: 'orderDetails' });
      },
      orderDetails: () => act.openDialog({ kind: 'orderDetails' }),
      publish: () => act.openDialog({ kind: 'publish' }),
      openSummary: () => act.openSummary(),
    };
  }, [act, store]);
}
