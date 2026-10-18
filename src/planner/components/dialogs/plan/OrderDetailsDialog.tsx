/*
 * `orderDetails` - "Přehled existující objednávky" (prototype `orderDetails`, opened by "Zpět" / `backToOrder`
 * and by the command panel): the order činnost by činnost with "Plánovat →" (arms that činnost), the overall
 * ring, and the way back to the club.
 *
 * On a club's own screen (`/clubs/:clubId`) the same dialog also carries the rest of the club - the figures, the
 * orders with their actions, the breakdown by služba, the windows, links and history, the older reservations, the
 * club's actions (`club/ClubOverviewSections`) - and its way back is "Zpět na kluby".
 */
import type { CSSProperties } from 'react';
import { timeLeft } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerModelState } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import { personsWord } from '../../plan/orderFigures';
import { stillNeededLine } from '../../plan/addDay';
import { usePlanActions } from '../../plan/usePlanActions';
import { useAddDay } from '../../plan/useAddDay';
import { usePlanFigures } from '../../plan/usePlanFigures';
import { ClubOverviewSections } from '../../../club/ClubOverviewSections';
import { useClubPlanner } from '../../../club/ClubPlannerContext';
import { useGoToClub } from './shared';

function OrderDetailsBody() {
  const { base: t } = usePlanFigures();
  const plan = usePlanActions();
  const act = usePlannerActions();
  const { addDay, busy } = useAddDay();
  const club = useClubPlanner();
  /* A club's screen without an order on the stage has no činnosti to list: the club's own sections are the dialog. */
  const planning = t.list.length > 0;
  return (
    <>
      {club !== null ? <span className="club-ov-wide-flag" aria-hidden="true" /> : null}
      {planning ? (
      <>
      <div className="planner-review">
        <div><strong>{t.planned} / {t.requested}</strong><span>Naplánované / objednané osoby · ještě {t.remaining} osob</span></div>
        <div className="percent">{t.percent}%</div>
      </div>
      <div className="activity-detail-list">
        {t.list.map((f) => (
          <div className="activity-detail-row" key={f.categoryId}>
            <div>
              <strong style={{ color: f.color }}>{f.name}</strong>
              <small>{f.slotMinutes} min / osoba · {f.remaining ? `zbývá ${f.remaining} ${personsWord(f.remaining)} (${timeLeft(f.remainingMinutes)})` : '✓ Plně naplánováno'}</small>
              <div className="capacity-bar" style={{ height: 5, marginTop: 9 } as CSSProperties}>
                <div style={{ width: `${f.percent}%`, background: f.color }} />
              </div>
              {f.remaining ? (
                <button type="button" className="plan-link-button" data-testid={`add-day-${f.categoryId}`} disabled={busy !== null} title={stillNeededLine(f, null)} onClick={() => void addDay(f.categoryId)}>
                  Přidat další den
                </button>
              ) : null}
            </div>
            <b>{f.planned} / {f.requested}</b>
            <button
              type="button"
              data-choose-activity={f.categoryId}
              disabled={!f.remaining}
              onClick={() => { act.closeDialog(); plan.arm(t, f.categoryId); }}
            >
              {f.remaining ? 'Plánovat →' : 'Hotovo'}
            </button>
          </div>
        ))}
      </div>
      <div className="contact-card-info" style={{ marginTop: 12 }}>
        Toto je plánovač již vytvořené objednávky. Naplánovaná místa nejsou totéž co rezervace pacientů.
      </div>
      </>
      ) : null}
      <ClubOverviewSections />
    </>
  );
}

function OrderDetailsFooter({ close }: { close: () => void }) {
  const { order, profile } = usePlannerModelState();
  const club = useClubPlanner();
  const toClub = useGoToClub(order?.clubId ?? profile?.clubId ?? null);
  const toList = useGoToClub(null);
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={close}>Zavřít</button>
      {club !== null ? (
        toList ? <button type="button" className="app-button" id="from-overview-clubs" onClick={toList}>Zpět na kluby</button> : null
      ) : toClub ? <button type="button" className="app-button" id="from-overview-club" onClick={toClub}>Zpět na klub</button> : null}
      <button type="button" className="app-button primary" id="from-overview-continue" onClick={close}>Pokračovat do kalendáře →</button>
    </>
  );
}

export const orderDetailsDialog: DialogRenderer<'orderDetails'> = ({ close, model }) => {
  /* A club's screen with no order on the stage: this is the club's overview, not an order's. */
  const noOrder = model.order?.club === true && !model.order.id;
  return {
    body: <OrderDetailsBody />,
    footer: <OrderDetailsFooter close={close} />,
    ...(noOrder ? { title: 'Přehled klubu a objednávek' } : {}),
    subtitle: `${model.profile?.clubName ?? ''} · ${noOrder ? 'Objednávky, údaje a akce klubu' : 'Přehled požadavků a plánování'}`,
  };
};
