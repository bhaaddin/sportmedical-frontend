/*
 * OrderCommandPanel - `section#order-command.oc-panel` (prototype lines 2977-2995) plus the
 * two small helpers that live beside it in the stage: `#active-plan-hint` (the strip that
 * says which činnost is being planned) and `#corner-return`.
 *
 * In the final prototype CSS `#order-command` is hidden in live mode - the same numbers are
 * shown by the summary card inside the carousel - but the element, its ids and its data stay
 * (`updateOrderCommand`), because the live drag preview writes into it (`.previewing`).
 *
 * SHELL. Done: the whole structure wired to `orderCommandModel(ctx)`, the hint strip wired to
 * `activePlanHint`, and the buttons (open the order overview / publish dialog). TO DO by the owner:
 * the drag-preview figures (`previewedOrderCommand`) and any refinement of the hint markup
 * (the model returns plain strings; the prototype bolds the činnost name and the remaining count).
 * Store: `planning.selectedCategoryId`, `planning.preview`.
 */
import { activePlanHint, orderCommandModel } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import type { CSSProperties } from 'react';
import { Icon } from './Icons';
import { usePlannerCtx } from './context';

export function OrderCommandPanel() {
  const ctx = usePlannerCtx();
  const selected = usePlannerSelector((s) => s.planning.selectedCategoryId);
  const preview = usePlannerSelector((s) => s.planning.preview);
  const act = usePlannerActions();
  const m = orderCommandModel(ctx);
  const hint = activePlanHint(
    ctx,
    selected,
    preview && preview.validation.ok ? { quantity: preview.quantity, isLimit: preview.isLimit } : null,
  );
  const goBack = () => {
    act.clearPlanningSelection();
    act.openDialog({ kind: 'orderDetails' });
  };
  return (
    <>
      <section id="order-command" className="oc-panel" aria-label="Průběh plánování existující klubové objednávky" data-testid="order-command">
        <button type="button" className="oc-overview" data-command="orderDetails" title="Detail rozpracované objednávky" onClick={() => act.openDialog({ kind: 'orderDetails' })}>
          <span className="oc-progress" id="oc-ring" style={{ '--oc-progress': `${Math.min(100, m.percent)}%` } as CSSProperties}>
            <span id="oc-percent">{m.percent}%</span>
          </span>
          <span className="oc-overview-copy">
            <span className="oc-kicker"><span className="oc-led" /> PLÁNOVÁNÍ OBJEDNÁVKY</span>
            <strong id="oc-total">{m.planned} <span>/ {m.requested}</span></strong>
            <small id="oc-remaining">{m.remainingText}</small>
          </span>
        </button>
        <div className="oc-right">
          <div className="oc-stats">
            <span className="oc-stat"><Icon name="calendar" /><span>Termíny <b id="oc-terms">{m.terms}</b></span></span>
            <i className="oc-stat-divider" />
            <span className="oc-stat"><Icon name="dumbbell" /><span>Nové sloty <b id="oc-slots">{m.newSlots}</b></span></span>
          </div>
          <div className="oc-actions">
            <button type="button" className="oc-back" data-command="backToOrder" onClick={goBack}>
              <Icon name="chevron-left" /><span>Zpět</span>
            </button>
            <button type="button" className={`oc-create${m.ready ? ' ready' : ''}`} id="finish-plan" data-command="publishDemo" onClick={() => act.openDialog({ kind: 'publish' })}>
              <Icon name="check" /><span>Připravit formulář</span>
            </button>
          </div>
        </div>
      </section>
      <div id="active-plan-hint" className={`active-plan-hint${hint.active ? ' active' : ''}${hint.dragging ? ' is-dragging' : ''}`} aria-live="polite" data-testid="active-plan-hint">
        <i className="tiny-light" />
        {hint.parts.map((p) => <span key={p}>{p}</span>)}
        <em>{hint.tail}</em>
      </div>
      <button id="corner-return" type="button" data-command="backToOrder" aria-label="Zpět na objednávku" onClick={goBack}>
        <Icon name="chevron-left" />Zpět
      </button>
    </>
  );
}
