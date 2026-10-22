/*
 * The planner's mount point of the guide. It reads the planner state into one plain `HintInput` (cheap, in the planner's own
 * chunk) and hands it to the hint UI, which is a chunk of its own: fetched only when a club order with činnosti is on the
 * stage (never in the standard calendar), and never part of the planner's first download.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { usePlannerMetrics } from '../components/PlannerMetrics';
import { useStage } from '../components/PlannerStage';
import { usePlanFigures } from '../components/plan/usePlanFigures';
import { useClubPlanner } from '../club/ClubPlannerContext';
import type { HintInput } from './hints';

const GuideHost = lazy(() => import('./GuideHost'));

export function GuideSlot() {
  const { base } = usePlanFigures();
  const view = usePlannerSelector((s) => s.view);
  const armed = usePlannerSelector((s) => s.planning.selectedCategoryId !== null);
  const calloutOpen = usePlannerSelector((s) => s.planning.completion !== null);
  const dialogOpen = usePlannerSelector((s) => s.dialog !== null || s.summary.open);
  const page = usePlannerSelector((s) => s.carousel.index);
  const { layout } = useStage();
  const { deckVisible } = usePlannerMetrics();
  /* A club's overview (no order on the stage) is not planning: the deck there is the quick actions, nothing to hint at. */
  const club = useClubPlanner();
  const overview = club !== null && !club.planning;

  /* The person moved the strip (arrow, swipe, the escalator): the strip hint has nothing left to say. */
  const firstPage = useRef(page);
  const [stripUsed, setStripUsed] = useState(false);
  useEffect(() => { if (page !== firstPage.current) setStripUsed(true); }, [page]);

  const activities = base.list.length;
  if (activities === 0 || overview) return null;
  const input: HintInput = {
    active: true,
    activities,
    planned: base.planned,
    armed,
    view,
    layout,
    hiddenCards: Math.max(0, activities - deckVisible),
    stripUsed,
    dialogOpen,
    calloutOpen,
  };
  return (
    <Suspense fallback={null}>
      <GuideHost input={input} />
    </Suspense>
  );
}
