/*
 * `moveConfirm` and `expandConfirm` - "Opravdu přesunout termín?" / "Opravdu rozšířit termín?" (prototype
 * `showTermMoveConfirm`, `showTermExpansionConfirm`): the drag on the board only PROPOSES; nothing is written
 * until the desk confirms here.
 *
 *   Potvrdit        `moveInterval` / `resizeInterval` with the term's version (`expectedVersion`): when somebody
 *                   else changed it meanwhile the source answers 'stale' and nothing is overwritten.
 *   registrations   when the source answers that the change would cancel registered athletes (409), they are listed
 *                   and the same write is repeated only after an explicit confirmation
 *                   (`cancelAffectedAthletes`) - never silently.
 *   after           the undo handle ("↶ Vrátit změnu") and the line about the club link / the notified people.
 */
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import { PlannerWriteError, type AffectedAthlete } from '../../../data/PlannerDataSource';
import {
  expandConfirmModel,
  moveConfirmModel,
  type ExpandConfirmModel,
  type MoveConfirmModel,
  type MovePreview,
  type ResizePreview,
} from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import { Icon } from '../../Icons';
import { createFlowStore, useFlow } from './flowStore';
import { writeMessage } from '../../plan/usePlanCommit';
import type { CSSProperties } from 'react';

interface ConfirmFlow {
  ack: boolean;
  busy: boolean;
  athletes: AffectedAthlete[] | null;
  athletesAck: boolean;
  error: string | null;
}
const idle: ConfirmFlow = { ack: false, busy: false, athletes: null, athletesAck: false, error: null };
const flow = createFlowStore<ConfirmFlow>(idle);

function Athletes() {
  const state = useFlow(flow);
  if (!state.athletes) return null;
  return (
    <section className="plan-athletes" data-testid="affected-athletes" role="alert">
      <strong>Změna zruší přihlášky {state.athletes.length} sportovců</strong>
      <ul>
        {state.athletes.map((a, i) => <li key={`${a.name}-${i}`}>{a.name}{a.activityName ? ` (${a.activityName})` : ''}</li>)}
      </ul>
      <label className="plan-ack">
        <input type="checkbox" checked={state.athletesAck} onChange={(e) => flow.set({ athletesAck: e.target.checked })} data-testid="athletes-ack" />
        <span>Potvrzuji zrušení přihlášek těchto sportovců.</span>
      </label>
    </section>
  );
}

/** Shared failure handling of the two writes. */
function useFailure() {
  const act = usePlannerActions();
  return (error: unknown) => {
    const athletes = (error as { affectedAthletes?: AffectedAthlete[] } | null)?.affectedAthletes ?? [];
    if (error instanceof PlannerWriteError && error.code === 'conflict' && athletes.length > 0) {
      flow.set({ busy: false, athletes, athletesAck: false, error: null });
      return;
    }
    if (error instanceof PlannerWriteError && (error.code === 'stale' || error.code === 'notFound')) {
      flow.set({ busy: false });
      act.closeDialog();
      act.toast(error.message);
      return;
    }
    flow.set({ busy: false, error: writeMessage(error) });
  };
}

/* ------------------------------ move ------------------------------ */

function MoveBody({ m }: { m: MoveConfirmModel }) {
  const state = useFlow(flow, true);
  return (
    <div className="move-review" style={{ '--move-tone': m.tone } as CSSProperties}>
      <div className="move-review-heading">
        <span className="move-review-icon"><Icon name="calendar" /></span>
        <span><small>CHYSTANÁ ZMĚNA · NENÍ JEŠTĚ ULOŽENA</small><strong>{m.name}</strong></span>
        <span className="move-review-pill">{m.slotsPill}</span>
      </div>
      <div className="move-review-compare">
        <section className="move-compare-card move-old"><small>PŮVODNÍ TERMÍN</small><strong>{m.oldDate}</strong><b>{m.oldTime}</b><span>Dosud platný čas</span></section>
        <div className="move-compare-arrow"><Icon name="arrow-right" /></div>
        <section className="move-compare-card move-new"><small>NOVÝ TERMÍN</small><strong>{m.newDate}</strong><b>{m.newTime}</b><span>Navrhovaný čas</span></section>
      </div>
      <div className="move-review-facts">{m.facts.map((fact) => <span key={fact}><Icon name="check" /> {fact}</span>)}</div>
      <div className={`move-review-notice${m.needsAck ? ' has-reservations' : ''}`}>
        <Icon name={m.needsAck ? 'users' : 'info'} />
        <div><strong>{m.noticeTitle}</strong><p>{m.noticeText}</p></div>
      </div>
      {m.needsAck ? (
        <label className="move-reservation-ack">
          <input id="move-booking-ack" type="checkbox" checked={state.ack} onChange={(e) => flow.set({ ack: e.target.checked })} />
          <span>{m.ackText}</span>
        </label>
      ) : null}
      <Athletes />
      {state.error ? <p className="plan-dialog-error" role="alert">{state.error}</p> : null}
      <div className="move-review-tip">Zrušení ponechá termín beze změny. Po potvrzení můžete přesun ihned vrátit.</div>
    </div>
  );
}

function MoveFooter({ proposal, m, close }: { proposal: MovePreview; m: MoveConfirmModel; close: () => void }) {
  const ctx = usePlannerCtx();
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const state = useFlow(flow);
  const fail = useFailure();
  const blocked = (m.needsAck && !state.ack) || (state.athletes !== null && !state.athletesAck) || state.busy;
  const commit = async () => {
    const original = ctx.sessions.find((s) => s.id === proposal.eventId);
    flow.set({ busy: true, error: null });
    try {
      const r = await commands.moveInterval({
        id: proposal.eventId,
        date: proposal.date,
        start: proposal.start,
        end: proposal.end,
        expectedVersion: original?.version ?? null,
        ...(state.athletes !== null && state.athletesAck ? { cancelAffectedAthletes: true } : {}),
      });
      act.setUndoToken(r.undoToken);
      act.focusDate(proposal.date);
      act.closeDialog();
      const notes = [r.notified.clubLinkUpdated ? 'odkaz klubu aktualizován' : null, r.notified.individuals > 0 ? `oznámení: ${r.notified.individuals}` : null].filter(Boolean);
      act.toast(`Termín přesunut · ${proposal.date} ${proposal.start}–${proposal.end}${notes.length ? ` · ${notes.join(' · ')}` : ''}`, {
        tone: 'moved', actionLabel: '↶ Vrátit změnu', actionKey: 'undo', durationMs: 6500,
      });
    } catch (error) {
      fail(error);
    }
  };
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={close}>Ponechat původní termín</button>
      <button type="button" className="app-button primary move-confirm-button" id="commit-term-move" disabled={blocked} onClick={() => void commit()}>
        <Icon name="check" /> Potvrdit přesun
      </button>
    </>
  );
}

export const moveConfirmDialog: DialogRenderer<'moveConfirm'> = ({ dialog, close, model }) => {
  const m = model.ctx ? moveConfirmModel(model.ctx, dialog.proposal) : null;
  if (!m) return { body: <p className="plan-dialog-note">Termín už neexistuje.</p> };
  return { body: <MoveBody m={m} />, footer: <MoveFooter proposal={dialog.proposal} m={m} close={close} /> };
};

/* ------------------------------ expand ------------------------------ */

function ExpandBody({ m }: { m: ExpandConfirmModel }) {
  const state = useFlow(flow, true);
  return (
    <div className="move-review expand-review" style={{ '--move-tone': m.tone } as CSSProperties}>
      <div className="move-review-heading">
        <span className="move-review-icon"><Icon name="calendar" /></span>
        <span><small>CHYSTANÉ ROZŠÍŘENÍ · ZATÍM NEULOŽENO</small><strong>{m.name}</strong></span>
        <span className="move-review-pill">{m.pill}</span>
      </div>
      <div className="move-review-compare">
        <section className="move-compare-card move-old"><small>PŮVODNÍ TERMÍN</small><strong>{m.date}</strong><b>{m.oldTime}</b><span>{m.oldFacts}</span></section>
        <div className="move-compare-arrow"><Icon name="arrow-right" /></div>
        <section className="move-compare-card move-new"><small>ROZŠÍŘENÝ TERMÍN</small><strong>{m.date}</strong><b>{m.newTime}</b><span>{m.newFacts}</span></section>
      </div>
      <div className="expand-figures">
        <div><small>ROZŠÍŘENÍ</small><strong className="is-added">{m.figures.added}</strong></div>
        <div><small>ČAS NAVÍC</small><strong>{m.figures.extraTime}</strong></div>
        <div><small>{m.figures.lastLabel}</small><strong>{m.figures.lastValue}</strong></div>
      </div>
      <div className={`move-review-notice${m.needsAck ? ' has-reservations' : ''}`}>
        <Icon name={m.needsAck ? 'users' : 'info'} />
        <div><strong>{m.noticeTitle}</strong><p>{m.noticeText}</p></div>
      </div>
      {m.needsAck ? (
        <label className="move-reservation-ack">
          <input id="expand-booking-ack" type="checkbox" checked={state.ack} onChange={(e) => flow.set({ ack: e.target.checked })} />
          <span>{m.ackText}</span>
        </label>
      ) : null}
      <Athletes />
      {state.error ? <p className="plan-dialog-error" role="alert">{state.error}</p> : null}
      <div className="move-review-tip">Zrušení ponechá původní termín beze změny. Po potvrzení lze poslední změnu vrátit.</div>
    </div>
  );
}

function ExpandFooter({ proposal, m, close }: { proposal: ResizePreview; m: ExpandConfirmModel; close: () => void }) {
  const ctx = usePlannerCtx();
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const state = useFlow(flow);
  const fail = useFailure();
  const blocked = (m.needsAck && !state.ack) || (state.athletes !== null && !state.athletesAck) || state.busy;
  const commit = async () => {
    const original = ctx.sessions.find((s) => s.id === proposal.eventId) ?? proposal.original;
    flow.set({ busy: true, error: null });
    try {
      const r = await commands.resizeInterval({
        id: proposal.eventId,
        edge: proposal.edge,
        start: proposal.start,
        end: proposal.end,
        added: proposal.added,
        expectedVersion: original.version ?? null,
        ...(state.athletes !== null && state.athletesAck ? { cancelAffectedAthletes: true } : {}),
      });
      act.setUndoToken(r.undoToken);
      act.focusDate(proposal.date);
      act.closeDialog();
      act.toast(`Termín rozšířen o ${proposal.added} ${proposal.added === 1 ? 'místo' : 'míst'} · ${r.session.capacity} celkem`, {
        tone: 'moved', actionLabel: '↶ Vrátit změnu', actionKey: 'undo', durationMs: 7500,
      });
    } catch (error) {
      fail(error);
    }
  };
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={close}>Ponechat původní termín</button>
      <button type="button" className="app-button primary move-confirm-button" id="commit-term-expand" disabled={blocked} onClick={() => void commit()}>
        <Icon name="check" /> Potvrdit rozšíření
      </button>
    </>
  );
}

export const expandConfirmDialog: DialogRenderer<'expandConfirm'> = ({ dialog, close, model }) => {
  const m = model.ctx ? expandConfirmModel(model.ctx, dialog.proposal) : null;
  if (!m) return { body: <p className="plan-dialog-note">Termín už neexistuje.</p> };
  return { body: <ExpandBody m={m} />, footer: <ExpandFooter proposal={dialog.proposal} m={m} close={close} /> };
};
