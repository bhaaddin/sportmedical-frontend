/*
 * The planner's global keyboard / mouse rules (prototype `document` listeners):
 *
 *   Escape        `plannerActions.escape()` - closes, in the prototype's priority order: the summary,
 *                 a running move / edge pull, the reservation drawer, the mini-calendar flyout, the dialog,
 *                 then a running placement drag and the armed činnost.
 *   Ctrl / Cmd+Z  reverts the last write (`planning.undoToken`) when no field has focus and no dialog is open.
 *   N             opens "Vytvořit termín" (or reminds to pick a činnost first).
 *   right click   anywhere in the planner while a činnost is armed: disarm it, no browser menu
 *                 (capture phase, so it also reaches layers that stop the event).
 *
 * The right-click rule is scoped to the planner root; the others are global while it is mounted.
 */
import { useEffect } from 'react';
import { usePlannerCommands } from '../data/usePlannerCommands';
import { usePlannerActions, usePlannerStore } from '../state/PlannerStoreProvider';
import { useStage } from './PlannerStage';

export function usePlannerKeyboard(): void {
  const store = usePlannerStore();
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const { stageEl } = useStage();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = store.getState();
      if (e.key === 'Escape') {
        act.escape();
        return;
      }
      const active = document.activeElement;
      if (active?.matches?.('input,textarea,select') || state.dialog) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.planning.undoToken) {
        e.preventDefault();
        const token = state.planning.undoToken;
        commands
          .undo(token)
          .then(() => {
            act.setUndoToken(null);
            act.toast('Poslední plánovací krok byl vrácen.');
          })
          .catch((error: unknown) => act.toast(error instanceof Error ? error.message : 'Změnu se nepodařilo vrátit.'));
        return;
      }
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!state.planning.selectedCategoryId) {
          act.toast('Nejprve vyberte činnost z dolních karet.');
          return;
        }
        act.openDialog({ kind: 'newEvent' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [store, act, commands]);

  useEffect(() => {
    const root = stageEl?.closest('.sm-planner');
    const onContextMenu = (e: MouseEvent) => {
      if (!store.getState().planning.selectedCategoryId) return;
      if (root && !(e.target instanceof Node && root.contains(e.target))) return;
      e.preventDefault();
      act.rightClick(false);
    };
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => document.removeEventListener('contextmenu', onContextMenu, true);
  }, [store, act, stageEl]);
}
