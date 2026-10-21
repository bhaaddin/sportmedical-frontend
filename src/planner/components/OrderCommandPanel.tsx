/*
 * OrderCommandPanel - `section#order-command.oc-panel` (prototype `updateOrderCommand`) plus the two small
 * helpers that live beside it in the stage: `#active-plan-hint` (the strip that says which činnost is being
 * planned, or what the running drag adds) and `#corner-return`.
 *
 * In the final prototype CSS `#order-command` and `#corner-return` are hidden in live mode - the same numbers
 * and buttons are shown by the summary card inside the carousel - but the elements, their ids and their data
 * stay, because the live drag preview writes into them (`.previewing`) and the keyboard / tests reach them.
 *
 * The figures are the club order's own counter (`orderFigures`, plan/orderFigures.ts); "Zpět" opens the order
 * overview, "Připravit formulář" the publication (link, e-mail text, form preview).
 */
import type { CSSProperties } from 'react';
import { timeLeft } from '../model';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { useClubPlanner } from '../club/ClubPlannerContext';
import { Icon } from './Icons';
import { personsWord } from './plan/orderFigures';
import { usePlannerModelState } from './context';
import { stillNeededLine } from './plan/addDay';
import { usePlanActions } from './plan/usePlanActions';
import { useAddDay } from './plan/useAddDay';
import { usePlanFigures } from './plan/usePlanFigures';
import './plan/plan.css';

export function OrderCommandPanel() {
  const selected = usePlannerSelector((s) => s.planning.selectedCategoryId);
  const preview = usePlannerSelector((s) => s.planning.preview);
  const plan = usePlanActions();
  const { addDay, busy: addingDay } = useAddDay();
  /* The planning chrome (progress, hint, "Zpět") is for planning: not in the standard calendar, not on a club's overview. */
  const club = useClubPlanner();
  const hide = usePlannerModelState().order?.club === false || (club !== null && !club.planning) ? { display: 'none' as const } : undefined;
  const { base, live, previewCategoryId, added } = usePlanFigures();
  const previewing = added > 0;
  const shown = previewing ? live : base;
  const remainingText = previewing
    ? shown.remaining === 0 ? '✓ Celá objednávka bude splněna' : `Náhled: ${shown.remaining} osob zbývá`
    : base.remaining > 0 ? `${base.remaining} osob zbývá naplánovat` : '✓ Požadavek klubu splněn';

  const figure = selected ? base.byId.get(selected) : undefined;
  const dragging = preview && preview.validation.ok && figure && previewCategoryId === selected && added > 0 ? preview : null;

  return (
    <>
      <section id="order-command" className={`oc-panel${previewing ? ' previewing' : ''}`} style={hide} aria-label="Průběh plánování existující klubové objednávky" data-testid="order-command">
        <button type="button" className="oc-overview" data-command="orderDetails" title="Detail rozpracované objednávky" onClick={plan.orderDetails}>
          <span className="oc-progress" id="oc-ring" style={{ '--oc-progress': `${Math.min(100, shown.percent)}%` } as CSSProperties}>
            <span id="oc-percent">{shown.percent}%</span>
          </span>
          <span className="oc-overview-copy">
            <span className="oc-kicker"><span className="oc-led" /> PLÁNOVÁNÍ OBJEDNÁVKY</span>
            <strong id="oc-total">{shown.planned} <span>/ {shown.requested}</span></strong>
            <small id="oc-remaining">{remainingText}</small>
          </span>
        </button>
        <div className="oc-right">
          <div className="oc-stats">
            <span className="oc-stat"><Icon name="calendar" /><span>Termíny <b id="oc-terms">{base.termCount}</b></span></span>
            <i className="oc-stat-divider" />
            <span className="oc-stat"><Icon name="dumbbell" /><span>Nové sloty <b id="oc-slots">{base.newSlots}</b></span></span>
          </div>
          <div className="oc-actions">
            <button type="button" className="oc-back" data-command="backToOrder" onClick={plan.backToOrder}>
              <Icon name="chevron-left" /><span>Zpět</span>
            </button>
            <button type="button" className={`oc-create${base.remaining === 0 ? ' ready' : ''}`} id="finish-plan" data-command="publishDemo" onClick={plan.publish}>
              <Icon name="check" /><span>Připravit formulář</span>
            </button>
          </div>
        </div>
      </section>
      <div id="active-plan-hint" style={hide} className={`active-plan-hint${figure ? ' active' : ''}${dragging ? ' is-dragging' : ''}`} aria-live="polite" data-testid="active-plan-hint">
        <i className="tiny-light" />
        {!figure ? (
          <>
            <span><strong>Vyberte činnost</strong> v dolních kartách a tažením v kalendáři vytvářejte její sloty</span>
            <em>Žádná činnost není vybraná</em>
          </>
        ) : dragging ? (
          <>
            <span>NÁHLED: <strong>{figure.name}</strong></span>
            <span>+{added} {personsWord(added) === 'osoba' ? 'osoba' : 'osob'} · {timeLeft(dragging.quantity * figure.slotMinutes)}</span>
            <span className="drag-hint-total">{figure.planned} → <b>{figure.planned + added} / {figure.requested}</b></span>
            <em>{dragging.isLimit ? 'MAXIMUM' : 'UPUŠTĚNÍM VYTVOŘÍTE'}</em>
          </>
        ) : (
          <>
            <span>Právě plánujete: <strong>{figure.name}</strong></span>
            <span>{figure.slotMinutes} min / osoba · zbývá <b>{figure.remaining}</b> osob</span>
            <button
              type="button"
              className="plan-add-day"
              data-testid="add-day"
              disabled={addingDay !== null || figure.remaining <= 0}
              title={stillNeededLine(figure, null)}
              onClick={() => void addDay(figure.categoryId)}
            >
              Přidat další den
            </button>
            <em>ESC ukončit výběr</em>
          </>
        )}
      </div>
      <button id="corner-return" style={hide} type="button" data-command="backToOrder" aria-label="Zpět na objednávku" onClick={plan.backToOrder}>
        <Icon name="chevron-left" />Zpět
      </button>
    </>
  );
}
