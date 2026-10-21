/*
 * ClubOverviewDeck - what the deck under the board is while the club's screen is its OVERVIEW (reviewer 2.3): a club opened from
 * the list, a card or a link lands here, in the same planner layout and the club's own data, and nothing of its order is put on
 * the stage until the person chooses an action that plans ("Plánovat termíny"; an order's own "Upravit termíny"; a new order).
 *
 *   left   the club and the order in view: code, status, players, služba(s), how many windows, the reason when it cannot be planned
 *   right  the quick actions as icon buttons - Nová objednávka, Plánovat termíny, Přidat hráče, Otevřít objednávku, Přehled klubu
 *
 * It takes the deck's own box (`#planning-cards`, desktop stage and the compact strip alike) and its card language (`.plan-card`,
 * `.fx-surface`, the command panel's two buttons), so the planner looks the same whether it is planning or not. Every action is
 * one `ClubPlannerContext` already has - the dialogs and the navigation of the old club page; nothing here is new logic.
 */
import { ORDER_STATUS_LABEL } from '../../api/clubOrders';
import { windowDates } from '../../components/clubs/orders/orderWindows';
import { Icon } from '../components/Icons';
import { usePlannerActions } from '../state/PlannerStoreProvider';
import { emptyDeckReason } from './ClubDeckEmpty';
import { groupPlayers, groupServices } from './clubGroups';
import { useClubPlanner } from './ClubPlannerContext';
import './club.css';

export const OVERVIEW_TEXT = {
  kicker: 'PŘEHLED KLUBU',
  noOrder: 'Klub zatím nemá žádnou objednávku.',
  actions: 'Rychlé akce klubu',
  newOrder: 'Nová objednávka',
  planTerms: 'Plánovat termíny',
  planTermsHint: 'Otevře plánovač s termíny objednávky',
  planDisabled: (reason: string) => reason,
  processRequest: 'Zpracovat poptávku',
  addPlayers: 'Přidat hráče',
  openOrder: 'Otevřít objednávku',
  overview: 'Přehled klubu',
  windows: (n: number) => `${n} ${n === 1 ? 'termín' : n >= 2 && n <= 4 ? 'termíny' : 'termínů'}`,
  noWindows: 'zatím bez termínů',
} as const;

export function ClubOverviewDeck() {
  const club = useClubPlanner();
  const act = usePlannerActions();
  if (club === null) return null;
  const group = club.selected;
  const root = group?.root ?? null;
  const live = root !== null && (root.status === 'Requested' || root.status === 'Confirmed');
  const windowCount = group?.blockIds.length ?? 0;

  return (
    <section
      id="planning-cards"
      className="planning-cards club-overview-deck"
      data-testid="club-overview-deck"
      data-status={root?.status ?? 'none'}
      aria-label="Přehled klubu a rychlé akce"
    >
      <div className="plan-card club-overview-card" data-testid="club-overview-summary">
        <span className="fx-surface">
          <span className="fx-liquid" aria-hidden="true" />
          <span className="card-content">
            <span className="club-ov-kicker"><i className="s42-led" aria-hidden="true" />{OVERVIEW_TEXT.kicker}</span>
            <span className="club-ov-name" data-testid="club-overview-name">{club.club.name}</span>
            {group !== null && root !== null ? (
              <>
                <span className="club-ov-line" data-testid="club-overview-order">
                  {`Objednávka ${group.code}`}
                  <b className={`club-ov-status is-${root.status.toLowerCase()}`} data-testid="club-overview-status">{ORDER_STATUS_LABEL[root.status]}</b>
                </span>
                <span className="club-ov-meta">
                  <span>{groupServices(group)}</span>
                  <span>{groupPlayers(group)}</span>
                  <span data-testid="club-overview-windows">
                    {windowCount > 0 && group.firstDate !== null ? `${OVERVIEW_TEXT.windows(windowCount)} · ${windowDates(group.firstDate, group.lastDate ?? group.firstDate)}` : OVERVIEW_TEXT.noWindows}
                  </span>
                </span>
                {!group.editable ? <span className="club-ov-reason" data-testid="club-overview-reason">{emptyDeckReason(root.status, null)}</span> : null}
              </>
            ) : (
              <span className="club-ov-reason" data-testid="club-overview-reason">{OVERVIEW_TEXT.noOrder}</span>
            )}
          </span>
        </span>
      </div>

      <div className="club-ov-actions" role="group" aria-label={OVERVIEW_TEXT.actions} data-testid="club-overview-actions">
        <button type="button" className="club-ov-action is-primary" data-testid="ov-new-order" onClick={club.newOrder}>
          <Icon name="plus" /><span>{OVERVIEW_TEXT.newOrder}</span>
        </button>
        {group !== null && root !== null && group.editable ? (
          <button type="button" className="club-ov-action is-primary" data-testid="ov-plan-terms" title={OVERVIEW_TEXT.planTermsHint} onClick={() => club.planGroup(group.id)}>
            <Icon name="calendar" /><span>{OVERVIEW_TEXT.planTerms}</span>
          </button>
        ) : null}
        {group !== null && root !== null && root.status === 'Requested' ? (
          <button type="button" className="club-ov-action is-primary" data-testid="ov-process-request" onClick={() => club.openOrder(root.id)}>
            <Icon name="calendar" /><span>{OVERVIEW_TEXT.processRequest}</span>
          </button>
        ) : null}
        {group !== null && root !== null && live ? (
          <button type="button" className="club-ov-action" data-testid="ov-add-players" onClick={() => club.changePlayers(root, 'add')}>
            <Icon name="users" /><span>{OVERVIEW_TEXT.addPlayers}</span>
          </button>
        ) : null}
        {group !== null && root !== null ? (
          <button type="button" className="club-ov-action" data-testid="ov-open-order" onClick={() => club.openOrder(root.id)}>
            <Icon name="arrow-up-right" /><span>{OVERVIEW_TEXT.openOrder}</span>
          </button>
        ) : null}
        <button type="button" className="club-ov-action" data-testid="ov-overview" onClick={() => act.openDialog({ kind: 'orderDetails' })}>
          <Icon name="info" /><span>{OVERVIEW_TEXT.overview}</span>
        </button>
      </div>
    </section>
  );
}
