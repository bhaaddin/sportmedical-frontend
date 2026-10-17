/*
 * Shows the loading / error state of the planner's data and mounts the panels only when it is
 * ready, so a panel can call `usePlannerCtx()` without a null check.
 */
import type { ReactNode } from 'react';
import { usePlannerModelState } from './context';

export function PlannerGate({ children }: { children: ReactNode }) {
  const model = usePlannerModelState();
  if (model.status === 'loading') {
    return (
      <div className="planner-state" role="status" data-testid="planner-loading">
        <span className="planner-state-spinner" aria-hidden="true" />
        Načítám plánovač…
      </div>
    );
  }
  if (model.status === 'error') {
    return (
      <div className="planner-state is-error" role="alert" data-testid="planner-error">
        <strong>Plánovač se nepodařilo načíst.</strong>
        <span>{model.error?.message || 'Zkuste to prosím znovu.'}</span>
        <button type="button" className="app-button primary" onClick={model.refetch}>Zkusit znovu</button>
      </div>
    );
  }
  return <>{children}</>;
}
