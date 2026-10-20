/*
 * "Výchozí pohled" (Nastavení -> Provoz -> Kalendář a mřížka): the view the calendar opens in. The setting was stored and
 * read back but nothing consumed it once the planner replaced the old grid (settings audit, O1). It is applied ONCE, when
 * the setting has arrived, and only while the person has not already picked a view themselves: the board opens on the
 * prototype's week, so a view other than "week" means somebody got there first and must not be moved.
 */
import { useEffect, useRef } from 'react';
import type { PlannerView } from '../state/plannerState';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';

const OPENING_VIEW: PlannerView = 'week';

export function ApplyDefaultView({ view }: { view: PlannerView | undefined }) {
  const current = usePlannerSelector((s) => s.view);
  const { setView } = usePlannerActions();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || view === undefined) return;
    applied.current = true;
    if (view !== OPENING_VIEW && current === OPENING_VIEW) setView(view);
  }, [view, current, setView]);
  return null;
}
