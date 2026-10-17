/*
 * SummaryExperience - `#summary-experience-layer.s41-layer` (prototype line 3002): the full-stage
 * "CELKOVÁ OBJEDNÁVKA" command centre opened from the carousel's summary card
 * (`openSummaryExperience`, `closeSummaryExperience`, `showSummarySheet`, `s41Icon`,
 * `s41BuildProgressRow`).
 *
 * SHELL: the hidden layer. It is `hidden` / `aria-hidden` until `state.summary.open`.
 * TO DO by the owner of this file: render `summaryExperienceModel(ctx, profile)` (status,
 * readiness line, top four bars) with `.s41-scene` / `.s41-topbar` / `.s41-panel`, the sheet
 * "Přehled všech činností" (`summaryDetailLine`) and "Klubové termíny" (`summaryTermRows`) selected by
 * `state.summary.sheet` (`act.setSummarySheet`), the actions Zpět (`act.closeSummary`),
 * Připravit formulář (`act.closeSummary()` then `act.openDialog({ kind: 'publish' })`), focus trap and
 * focus return, close on click outside the panel and on right click. Esc is handled by the store.
 * The summary's own icon set (`s41Icon`) is separate from the shared sprite.
 */
import { usePlannerSelector } from '../state/PlannerStoreProvider';

export function SummaryExperience() {
  const open = usePlannerSelector((s) => s.summary.open);
  return (
    <div id="summary-experience-layer" className="s41-layer" hidden={!open} aria-hidden={!open} data-testid="summary-layer" />
  );
}
