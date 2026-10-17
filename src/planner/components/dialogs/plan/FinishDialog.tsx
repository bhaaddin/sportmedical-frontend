/*
 * `finish` - "Dokončení plánování" / "Kontrola rozpracovaného plánu" (prototype `finishPlan`), and the one place
 * the club's order is really written:
 *
 *   1. players without a slot, or places beyond the players, are never slipped through: the shortfall bubble
 *      asks first - "Doplnit termíny" / "Zkrátit na potřebu" / "Vytvořit i tak" (kept from pick mode);
 *   2. `finishPlan()` makes the ONE real call of the data source (create | update | update + confirm);
 *   3. a 409 that would cancel registered athletes lists them and repeats the call only after an explicit
 *      confirmation (`cancelAffectedAthletes`); a club that already holds a live order is told so and the
 *      desk chooses (`skipDuplicateCheck`) - never silently a second order.
 *
 * Success: the plan is marked completed, the summary experience (the command centre) opens with the real order
 * reference and prices. Nothing is e-mailed from here.
 */
import { useState } from 'react';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import type { AffectedAthlete } from '../../../data/PlannerDataSource';
import { contactReady, timeLeft } from '../../../model';
import { PickShortfallDialog } from '../../../../components/booking/calendar/PickShortfallDialog';
import type { ShortfallChoice } from '../../../../components/booking/calendar/pickTypes';
import { useDevice } from '../../../../layout/useDevice';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState, usePlannerProfile } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import { orderFigures } from '../../plan/orderFigures';
import { PlanDarkTheme } from '../../plan/PlanDarkTheme';
import { needsShortfallConfirm, shortfallOf, trimOps } from '../../plan/shortfall';
import { useClubPlanningContext } from '../../plan/useClubPlanningContext';
import { usePlanActions } from '../../plan/usePlanActions';
import { usePlanFigures } from '../../plan/usePlanFigures';
import { writeMessage } from '../../plan/usePlanCommit';
import { createFlowStore, useFlow } from './flowStore';

interface DuplicateOrder { id: string; code: string; serviceName: string; status: string; sameService: boolean }

interface FinishFlow {
  busy: boolean;
  shortfall: boolean;
  athletes: AffectedAthlete[] | null;
  ack: boolean;
  duplicates: DuplicateOrder[] | null;
  error: string | null;
}

const idle: FinishFlow = { busy: false, shortfall: false, athletes: null, ack: false, duplicates: null, error: null };
const flow = createFlowStore<FinishFlow>(idle);

/** A rejection that carries the live orders of the club (`PlannerDuplicateOrderError`), without importing the source. */
const duplicatesOf = (error: unknown): DuplicateOrder[] | null => {
  const rows = (error as { liveOrders?: unknown } | null)?.liveOrders;
  return Array.isArray(rows) ? (rows as DuplicateOrder[]) : null;
};

function useFinish() {
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const { order } = usePlannerModelState();
  return async (options: { cancelAffectedAthletes?: boolean; skipDuplicateCheck?: boolean } = {}) => {
    flow.set({ busy: true, error: null });
    try {
      const result = await commands.finishPlan(options);
      act.setPlanCompleted(result.ready);
      act.closeDialog();
      const code = result.orderCode ?? order?.code ?? null;
      act.toast(
        result.ready
          ? `Plán byl uložen a označen jako připravený.${code ? ` Objednávka ${code}.` : ''}`
          : `Plán byl uložen, objednávka zatím není kompletní.${code ? ` ${code}.` : ''}`,
        { durationMs: 6000 },
      );
      act.openSummary();
    } catch (error) {
      const duplicates = duplicatesOf(error);
      const athletes = (error as { affectedAthletes?: AffectedAthlete[] } | null)?.affectedAthletes ?? [];
      if (duplicates) flow.set({ busy: false, duplicates });
      else if (athletes.length > 0) flow.set({ busy: false, athletes, ack: false });
      else flow.set({ busy: false, error: writeMessage(error, 'Objednávku se nepodařilo uložit. Plán zůstal beze změny.') });
    }
  };
}

function FinishBody() {
  const ctx = usePlannerCtx();
  const profile = usePlannerProfile();
  const { base } = usePlanFigures();
  const state = useFlow(flow, true);
  const device = useDevice();
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const { order } = usePlannerModelState();
  const { session } = useClubPlanningContext();
  const finish = useFinish();
  const plan = usePlanActions();
  const [trimming, setTrimming] = useState(false);

  const ready = base.remaining === 0 && base.requested > 0;
  const editing = session?.editOrder?.mode === 'edit';

  const choose = async (choice: ShortfallChoice) => {
    flow.set({ shortfall: false });
    if (choice === 'fill') {
      /* Deferred a tick: when the bubble was left with Esc the global Esc handler must meet the open dialog first. */
      window.setTimeout(() => {
        act.closeDialog();
        const firstShort = base.list.find((x) => !x.done);
        if (firstShort) plan.arm(base, firstShort.categoryId);
      }, 0);
      return;
    }
    if (choice === 'trim') {
      setTrimming(true);
      try {
        for (const op of trimOps(ctx, base, order?.id)) {
          if (op.kind === 'delete') await commands.deleteInterval(op.id);
          else await commands.updateInterval({ id: op.id, date: op.date, categoryId: op.categoryId, start: op.start, end: op.end, capacity: op.capacity, expectedVersion: op.version });
        }
        act.toast('Termíny zkráceny na potřebu hráčů.');
      } catch (error) {
        flow.set({ error: writeMessage(error, 'Termíny se nepodařilo zkrátit.') });
      } finally {
        setTrimming(false);
      }
      return;
    }
    void finish();
  };

  return (
    <>
      <div className="planner-review">
        <div>
          <strong>{base.planned} / {base.requested}</strong>
          <span>{ready ? 'Všechny požadované osoby jsou naplánovány.' : `Zbývá naplánovat ${base.remaining} osob. Dokončení objednávky zatím není možné bez potvrzení.`}</span>
        </div>
        <b className="percent">{base.percent}%</b>
      </div>
      {base.list.map((f) => (
        <div className="ow-plan-summary-row" key={f.categoryId}>
          <span>{f.name}</span>
          <strong style={{ color: f.done ? '#28e9d3' : '#e6eff6' }}>{f.planned} / {f.requested} {f.done ? '✓' : ''}</strong>
        </div>
      ))}
      <div className="contact-card-info">
        Kontaktní osoba: <strong>{profile.contactName || 'nevyplněno'}</strong> · E-mail: {profile.contactEmail || 'nevyplněn'}
        <br /><br />
        Po potvrzení se objednávka uloží do systému. Klubu se nic neodesílá - odkaz a text e-mailu připravíte tlačítkem „Připravit formulář“.
      </div>
      {base.remainingMinutes > 0 ? (
        <p className="plan-dialog-note">Chybějící kapacita ≈ {timeLeft(base.remainingMinutes)} (celé sloty, činnost po činnosti).</p>
      ) : null}
      {state.error ? <p className="plan-dialog-error" role="alert">{state.error}</p> : null}
      {trimming ? <p className="plan-dialog-note" role="status">Zkracuji termíny…</p> : null}

      {state.athletes ? (
        <section className="plan-athletes" data-testid="affected-athletes" role="alert">
          <strong>Změna zruší přihlášky {state.athletes.length} sportovců</strong>
          <ul>
            {state.athletes.map((a, i) => <li key={`${a.name}-${i}`}>{a.name}{a.activityName ? ` (${a.activityName})` : ''}</li>)}
          </ul>
          <label className="plan-ack">
            <input type="checkbox" checked={state.ack} onChange={(e) => flow.set({ ack: e.target.checked })} data-testid="athletes-ack" />
            <span>Potvrzuji zrušení přihlášek těchto sportovců.</span>
          </label>
          <button type="button" className="app-button primary" disabled={!state.ack || state.busy} data-testid="athletes-cancel-confirm" onClick={() => void finish({ cancelAffectedAthletes: true })}>
            Zrušit přihlášky a uložit
          </button>
        </section>
      ) : null}

      {state.duplicates ? (
        <section className="plan-athletes" data-testid="duplicate-orders" role="alert">
          <strong>Klub už má živou objednávku</strong>
          <ul>
            {state.duplicates.map((d) => <li key={d.id}>{d.code} · {d.serviceName} · {d.status === 'Confirmed' ? 'potvrzená' : 'čeká na potvrzení'}{d.sameService ? ' · stejná služba' : ''}</li>)}
          </ul>
          <p className="plan-dialog-note">Termíny raději přidejte do té objednávky na kartě klubu („Upravit termíny“ / „Přidat další službu“). Chcete-li přesto samostatnou objednávku, potvrďte to.</p>
          <button type="button" className="app-button" disabled={state.busy} data-testid="duplicate-separate" onClick={() => { flow.set({ duplicates: null }); void finish({ skipDuplicateCheck: true }); }}>
            Vytvořit samostatnou objednávku
          </button>
        </section>
      ) : null}

      {state.shortfall ? (
        <PlanDarkTheme>
          <PickShortfallDialog shortfall={shortfallOf(base, editing)} device={device} onChoose={(c) => void choose(c)} />
        </PlanDarkTheme>
      ) : null}
      {/* the confirm button the bubble hangs off */}
    </>
  );
}

function FinishFooter({ close }: { close: () => void }) {
  const profile = usePlannerProfile();
  const { base } = usePlanFigures();
  const state = useFlow(flow);
  const act = usePlannerActions();
  const finish = useFinish();
  const ready = base.remaining === 0 && base.requested > 0;
  const contact = contactReady(profile);
  const confirm = () => {
    if (needsShortfallConfirm(base)) { flow.set({ shortfall: true }); return; }
    void finish();
  };
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={close}>Zpět</button>
      {ready && contact ? (
        <button type="button" className="app-button primary" id="confirm-local-plan" data-testid="pick-confirm" disabled={state.busy} onClick={confirm}>
          {base.spareSeats > 0 ? 'Zkontrolovat a označit plán jako připravený' : 'Označit plán jako připravený'}
        </button>
      ) : ready ? (
        <button type="button" className="app-button primary" id="review-close" onClick={() => { act.closeDialog(); act.openDialog({ kind: 'clubEdit' }); }}>Doplnit kontakt klubu</button>
      ) : (
        <>
          <button type="button" className="app-button" id="confirm-anyway" data-testid="pick-confirm" disabled={state.busy} onClick={confirm}>Uložit i tak</button>
          <button type="button" className="app-button primary" id="review-close" onClick={close}>Pokračovat v plánování</button>
        </>
      )}
    </>
  );
}

export const finishDialog: DialogRenderer<'finish'> = ({ close, model }) => {
  const figures = model.ctx ? orderFigures(model.ctx, { orderId: model.order?.id ?? null }) : null;
  const ready = figures ? figures.remaining === 0 && figures.requested > 0 : false;
  return {
    body: <FinishBody />,
    footer: <FinishFooter close={close} />,
    title: ready ? 'Dokončení plánování' : 'Kontrola rozpracovaného plánu',
  };
};
