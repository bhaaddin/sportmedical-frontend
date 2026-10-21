/*
 * Hooks every panel uses to get at the planner's data.
 *
 *   const ctx = usePlannerCtx();          // PlannerContext for '../model' (ready model guaranteed)
 *   const model = usePlannerModelState(); // + catalogue, profile, order, dayMarks, status
 *   const cmd = usePlannerCommands();     // writes (from '../data')
 *   const st = usePlannerSelector(s => s.view);  // store slice (from '../state')
 *
 * `PlannerModelBoundary` (inside PlannerShell) renders the loading / error
 * states and only mounts the panels once the data is ready, so panels may call
 * `usePlannerCtx()` without a null check.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ClubProfile, PlannerContext } from '../model';
import type { PlannerCatalogue } from '../data/PlannerDataSource';
import { usePlannerModel, type PlannerModel } from '../state/usePlannerModel';

const ModelContext = createContext<PlannerModel | null>(null);

export function PlannerModelProvider({ children }: { children: ReactNode }) {
  const model = usePlannerModel();
  return <ModelContext.Provider value={model}>{children}</ModelContext.Provider>;
}

/** The model when a provider is above, else null (the board toolbar is also drawn on its own in tests). */
export function useOptionalPlannerModel(): PlannerModel | null {
  return useContext(ModelContext);
}

export function usePlannerModelState(): PlannerModel {
  const model = useContext(ModelContext);
  if (!model) throw new Error('Planner panels must render inside <PlannerModelProvider>.');
  return model;
}

/** The pure-model context; throws if the data is not ready yet (panels render only when it is). */
export function usePlannerCtx(): PlannerContext {
  const { ctx } = usePlannerModelState();
  if (!ctx) throw new Error('usePlannerCtx() called before the planner data was ready.');
  return ctx;
}

export function usePlannerProfile(): ClubProfile {
  const { profile } = usePlannerModelState();
  if (!profile) throw new Error('usePlannerProfile() called before the planner data was ready.');
  return profile;
}

export function usePlannerCatalogue(): PlannerCatalogue {
  const { catalogue } = usePlannerModelState();
  if (!catalogue) throw new Error('usePlannerCatalogue() called before the planner data was ready.');
  return catalogue;
}
