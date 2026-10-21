/*
 * CompactOrderDock - the bottom bar of the tablet / phone layouts while a club order is planned:
 *
 *     [ "Právě plánujete: činnost ..."  (the file's `#active-plan-hint`)            ]
 *     [ ring + planned / requested | Zpět | Připravit formulář ]  [ Souhrn ]
 *
 * It is the file's own `#order-command` panel (progress ring, the figures, "Zpět", "Připravit formulář"), which the
 * desktop stage hides because the summary card of the deck shows the same; in the compact layouts the deck's
 * summary card is replaced by this bar, so the panel is shown and sticks to the bottom of the screen. The only
 * addition is the "Souhrn" button, the summary card's one other job: it opens the full order summary.
 * Standard ordering (no club order) has no bar: the dock is not drawn.
 */
import { useClubPlanner } from '../../club/ClubPlannerContext';
import { usePlannerModelState } from '../context';
import { Icon } from '../Icons';
import { OrderCommandPanel } from '../OrderCommandPanel';
import { usePlanActions } from '../plan/usePlanActions';

export function CompactOrderDock() {
  const standard = usePlannerModelState().order?.club === false;
  const plan = usePlanActions();
  const club = useClubPlanner();
  /* A club's overview has no order on the stage: no bar to plan with. */
  if (club !== null && !club.planning) return null;
  return (
    <div className="compact-dock" data-testid="compact-dock" data-standard={standard ? 'true' : undefined}>
      <OrderCommandPanel />
      {standard ? null : (
        <button
          type="button"
          className="compact-summary-button"
          data-testid="compact-summary-button"
          aria-label="Celkový přehled objednávky"
          title="Celkový přehled objednávky"
          onClick={plan.openSummary}
        >
          <Icon name="info" />
          <span>Souhrn</span>
        </button>
      )}
    </div>
  );
}
