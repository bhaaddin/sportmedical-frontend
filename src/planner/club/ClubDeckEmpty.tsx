/*
 * ClubDeckEmpty - what the deck under the board says when there is nothing to plan on a club's own screen: the club has
 * no order yet, or the order in view is not one the stage can edit (still an invitation, waiting for the desk, done).
 * One card in the deck's own drawing (`.plan-card`, `.fx-surface`, `.card-content`, the command panel's two buttons `.oc-back` / `.oc-create`) with
 * the reason and the way on: "Nová objednávka klubu" (the existing chooser) and, for an order, "Otevřít objednávku".
 * Draws nothing on any other route (the deck is then not empty by definition, or hidden).
 */
import { ORDER_STATUS_LABEL } from '../../api/clubOrders';
import { Icon } from '../components/Icons';
import { useClubPlanner } from './ClubPlannerContext';

export function emptyDeckReason(status: string | null, adhoc: 'new' | 'edit' | null): string {
  if (adhoc === 'new') return 'Nová objednávka: dokončete formulář a vyberte činnosti.';
  switch (status) {
    case null: return 'Klub zatím nemá žádnou objednávku.';
    case 'Invited': return 'Objednávku zatím nevyplnil klub - odkaz čeká na odpověď.';
    case 'Requested': return 'Klub objednávku odeslal. Čeká na zpracování a potvrzení.';
    case 'Completed': return 'Objednávka je dokončena, termíny už se neplánují.';
    default: return 'Objednávku nelze plánovat.';
  }
}

export function ClubDeckEmpty() {
  const club = useClubPlanner();
  if (club === null) return null;
  const root = club.selected?.root ?? null;
  return (
    <div className="plan-card plan-card-empty" data-testid="deck-empty" data-status={root?.status ?? 'none'} role="group" aria-label="Žádná činnost k plánování">
      <span className="fx-surface">
        <span className="fx-liquid" aria-hidden="true" />
        <span className="fx-spotlight" aria-hidden="true" />
        <span className="card-content">
          <span className="plan-card-head">
            <span className="plan-icon"><Icon name="users" /></span>
            <span className="plan-card-titles">
              <span className="plan-card-name">Žádná činnost k plánování</span>
              <span className="plan-card-sub">{club.club.name}{root !== null ? ` · ${ORDER_STATUS_LABEL[root.status]}` : ''}</span>
            </span>
          </span>
          <span className="plan-card-body club-deck-empty-body">
            <span data-testid="deck-empty-reason">{emptyDeckReason(root?.status ?? null, club.adhoc)}</span>
          </span>
          <span className="club-deck-empty-actions">
            {root !== null ? (
              <button type="button" className="oc-back" data-testid="deck-empty-open" onClick={() => club.openOrder(root.id)}>
                <span>Otevřít objednávku</span>
              </button>
            ) : null}
            <button type="button" className="oc-create" data-testid="deck-empty-new" onClick={club.newOrder}>
              <Icon name="plus" /><span>Nová objednávka klubu</span>
            </button>
          </span>
        </span>
      </span>
    </div>
  );
}
