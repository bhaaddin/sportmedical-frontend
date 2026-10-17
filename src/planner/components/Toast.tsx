/*
 * Toast - `#toast-layer` (prototype `toast()`, `showPlanToast`, the "moved-toast" variants).
 *
 * Shows the newest entry of `state.toasts` and dismisses it after its `durationMs`
 * (2.8 s default; the prototype keeps undo toasts 5.2-7.5 s). A toast with
 * `actionKey: 'undo'` has a button that reverts the last write through the data source
 * (`planning.undoToken`), the equivalent of "↶ Zpět" / "↶ Vrátit změnu".
 *
 * SHELL, functionally complete for the plain and the undo toast; the owner of this file may
 * restyle / queue them. To raise one: `act.toast('Text', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 })`.
 */
import { useEffect } from 'react';
import { usePlannerCommands } from '../data/usePlannerCommands';
import { selectCurrentToast } from '../state/selectors';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';

export function Toast() {
  const toast = usePlannerSelector(selectCurrentToast);
  const undoToken = usePlannerSelector((s) => s.planning.undoToken);
  const act = usePlannerActions();
  const commands = usePlannerCommands();

  useEffect(() => {
    if (!toast || toast.durationMs <= 0) return undefined;
    const id = toast.id;
    const timer = setTimeout(() => act.dismissToast(id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, act]);

  const runAction = async () => {
    if (!toast) return;
    const id = toast.id;
    act.dismissToast(id);
    if (toast.actionKey === 'undo' && undoToken) {
      try {
        await commands.undo(undoToken);
        act.setUndoToken(null);
        act.toast('Poslední plánovací krok byl vrácen.');
      } catch (error) {
        act.toast(error instanceof Error ? error.message : 'Změnu se nepodařilo vrátit.');
      }
    }
  };

  return (
    <div id="toast-layer" aria-live="polite" data-testid="toast-layer">
      {toast ? (
        <div className={`toast${toast.tone === 'moved' ? ' moved-toast' : ''}`} key={toast.id}>
          {toast.tone === 'moved' ? <Icon name="check" /> : null} {toast.message}
          {toast.actionLabel ? (
            <button type="button" id="undo-plan-action" onClick={() => void runAction()}>{toast.actionLabel}</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
