/*
 * CompletionCallout - `#planner-feedback.planner-feedback` (prototype `showCompletionCallout`,
 * `hideCompletionCallout`): the "Požadavek naplněn / Celá objednávka naplánována" card that
 * appears when a činnost (or the whole order) is fully planned, or when the desk tries to plan
 * a činnost that is already complete. Auto-hides after 10 s.
 *
 * SHELL: the hidden layer (mounts when `planning.completion` is set). TO DO by the owner of
 * this file: the `.completion-card` markup from `completionCalloutModel(ctx, categoryId, pending,
 * name, tone)` ('../model/placement.ts'): close (`act.hideCompletion`), "Prohlédnout plán" (hide +
 * `{ kind: 'finish' }`), "Jiná činnost" (hide + `act.selectPlanningCategory(model.nextCategoryId)`),
 * `--feedback-tone`, the 10 s timer.
 */
import { usePlannerSelector } from '../state/PlannerStoreProvider';

export function CompletionCallout() {
  const completion = usePlannerSelector((s) => s.planning.completion);
  return (
    <div id="planner-feedback" className="planner-feedback" hidden={!completion} aria-live="polite" data-testid="completion-callout" />
  );
}
