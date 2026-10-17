/*
 * `smartEdit` and `smartEditConfirm` - "Inteligentní úprava termínu" and "Potvrdit úpravu termínu?" (prototype
 * `smartEditTerm`, `showSmartEditConfirmation`): date, činnost, start and number of slots of a planned term at
 * once, the end follows (or the other way round in the manual mode), every rule of the model is checked live and
 * nothing is written before the desk confirms on the second screen.
 *
 * The rules are the model's (`smartEditReduce`, `smartEditViewModel`, `smartConfirmModel`); the write is
 * `updateInterval` with the term's version; registered athletes are never cancelled silently (409 list + explicit
 * confirmation, `cancelAffectedAthletes`).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import { PlannerWriteError, type AffectedAthlete } from '../../../data/PlannerDataSource';
import {
  orderCategoryIds,
  smartConfirmModel,
  smartEditCandidate,
  smartEditEndInputValue,
  smartEditInitialDraft,
  smartEditIsLegacy,
  smartEditReduce,
  smartEditViewModel,
  clockDuration,
  detailedDate,
  minutesOf,
  type PlannerContext,
  type PlannerSession,
  type SmartEditDraft,
} from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import { Icon } from '../../Icons';
import { writeMessage } from '../../plan/usePlanCommit';
import { createFlowStore, useFlow } from './flowStore';

const edit = createFlowStore<{ draft: SmartEditDraft | null; valid: boolean }>({ draft: null, valid: false });

function SmartEditBody({ original, initial }: { original: PlannerSession; initial: SmartEditDraft }) {
  const ctx = usePlannerCtx();
  const [draft, setDraft] = useState<SmartEditDraft>(initial);
  const vm = smartEditViewModel(ctx, original, draft);
  useEffect(() => {
    edit.set({ draft, valid: vm.canContinue });
  }, [draft, vm.canContinue]);
  useEffect(() => () => edit.reset(), []);
  const reduce = (action: Parameters<typeof smartEditReduce>[2]) => setDraft((d) => smartEditReduce(ctx, d, action));
  const categoryIds = Array.from(new Set([...orderCategoryIds(ctx), original.categoryId]));
  const legacy = smartEditIsLegacy(ctx, original);

  return (
    <div className="smart-edit-shell" style={{ '--smart-accent': vm.accent } as CSSProperties}>
      <div className="smart-hero">
        <div className="smart-hero-icon"><Icon name="settings" /></div>
        <div className="smart-hero-copy">
          <span>SMART SCHEDULING ENGINE · LIVE</span>
          <strong>Čas, činnost i sloty propojené v reálném čase</strong>
          <small>Změníte začátek nebo činnost → konec se automaticky dopočítá. Ruční změna konce přepočítá počet slotů.</small>
        </div>
        <span className="smart-chip"><Icon name="check" /> AUTO</span>
      </div>
      <div className="smart-edit-sections">
        <div className="smart-edit-inputs">
          <div className="smart-mini-heading"><span>01 / PLÁNOVÁNÍ</span><span>Bez ztráty rezervací</span></div>
          <div className="smart-edit-fieldgrid">
            <label className="smart-field"><span>Datum termínu</span><input id="se-date" type="date" value={draft.date} onChange={(e) => reduce({ type: 'date', value: e.target.value })} /></label>
            <label className="smart-field">
              <span>Činnost <small>lze změnit</small></span>
              <select id="se-type" value={draft.categoryId} onChange={(e) => reduce({ type: 'category', value: e.target.value })}>
                {categoryIds.map((id) => <option key={id} value={id}>{ctx.categories.find((c) => c.id === id)?.name ?? id}</option>)}
              </select>
            </label>
            <label className="smart-field"><span>Od <small>začátek bloku</small></span><input id="se-start" type="time" step={300} value={draft.start} onChange={(e) => reduce({ type: 'start', value: e.target.value })} /></label>
            <label className="smart-field">
              <span>Do <small id="se-to-mode">{vm.toModeLabel}</small></span>
              <input id="se-end" type="time" step={300} value={smartEditEndInputValue(draft)} readOnly={vm.endReadOnly} onChange={(e) => reduce({ type: 'end', value: e.target.value })} />
            </label>
          </div>
          <div className="smart-time-toggle">
            <button id="se-mode" className="smart-tiny-button" type="button" onClick={() => reduce({ type: 'toggleMode' })}>
              <Icon name={draft.mode === 'auto' ? 'settings' : 'check'} /> {vm.modeButton}
            </button>
            <span id="se-mode-help">{vm.modeHelp}</span>
          </div>
          <div className="smart-quantity">
            <span><strong>Počet slotů</strong><small>Jednotlivé rezervace zůstávají svázané se sloty</small></span>
            <div className="smart-stepper">
              <button type="button" id="se-minus" aria-label="Odebrat jeden slot" onClick={() => reduce({ type: 'minus' })}>−</button>
              <output id="se-count">{vm.countText}</output>
              <button type="button" id="se-plus" aria-label="Přidat jeden slot" onClick={() => reduce({ type: 'plus' })}>+</button>
            </div>
          </div>
          <div className="smart-math">
            <span className="smart-math-badge"><Icon name="dumbbell" /></span>
            <span id="se-equation"><b>{vm.equation.count}</b> slotů × <b>{vm.equation.minutes} min</b></span>
            <strong id="se-duration">{vm.durationText}</strong>
          </div>
          {legacy ? <div className="smart-legacy-note">Termín má jinou délku, než odpovídá počtu slotů a délce slotu činnosti. Při první úpravě se přepočítá podle aktuální délky jedné činnosti.</div> : null}
        </div>
        <div className="smart-edit-review">
          <div className="smart-mini-heading"><span>02 / ŽIVÝ NÁHLED</span><span id="se-live-indicator" className="smart-live">● LIVE</span></div>
          <div className="smart-review-card smart-review-old">
            <small>PŮVODNÍ TERMÍN</small>
            <strong>{ctx.categories.find((c) => c.id === original.categoryId)?.name ?? original.categoryId}</strong>
            <span>{detailedDate(original.date)}</span>
            <b>{original.start} – {original.end}</b>
            <em>{original.capacity} slotů · {clockDuration(minutesOf(original))}</em>
          </div>
          <div className="smart-direction"><Icon name="arrow-right" /> <span>automatický přepočet</span></div>
          <div className={`smart-review-card smart-review-next${vm.invalidCard ? ' not-valid' : ''}`} id="se-live-card">
            <small>NAVRHOVANÝ TERMÍN</small>
            <strong id="se-next-name">{vm.next.name}</strong>
            <span id="se-next-date">{vm.next.date}</span>
            <b id="se-next-time">{vm.next.time}</b>
            <em id="se-next-facts">{vm.next.facts}</em>
          </div>
          <div className={`smart-edit-validation ${vm.validation.ok ? 'valid' : 'invalid'}`} id="se-validation" role="status">
            <Icon name={vm.validation.ok ? 'check' : 'info'} /><span>{vm.validation.reason}</span>
          </div>
          <div className="smart-impacts" id="se-impact">
            {vm.impacts.map((line) => <div key={line}><Icon name="check" /> {line}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmartEditFooter({ id, close }: { id: string; close: () => void }) {
  const act = usePlannerActions();
  const state = useFlow(edit);
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={close}>Zrušit beze změny</button>
      <button
        type="button"
        className="app-button primary smart-review-button"
        id="se-continue"
        disabled={!state.valid || state.draft === null}
        onClick={() => state.draft && act.openDialog({ kind: 'smartEditConfirm', id, draft: state.draft })}
      >
        <Icon name="arrow-right" /> Zkontrolovat změny
      </button>
    </>
  );
}

export const smartEditDialog: DialogRenderer<'smartEdit'> = ({ dialog, close, model }) => {
  const original = model.ctx?.sessions.find((s) => s.id === dialog.id);
  if (!original) return { body: <p className="plan-dialog-note">Termín už neexistuje.</p> };
  return {
    body: <SmartEditBody key={dialog.id} original={original} initial={dialog.prefill ?? smartEditInitialDraft(original)} />,
    footer: <SmartEditFooter id={dialog.id} close={close} />,
    className: 'smart-editor-modal',
  };
};

/* ------------------------------ confirmation ------------------------------ */

interface ConfirmFlow { ack: boolean; busy: boolean; athletes: AffectedAthlete[] | null; athletesAck: boolean; error: string | null }
const idle: ConfirmFlow = { ack: false, busy: false, athletes: null, athletesAck: false, error: null };
const confirmFlow = createFlowStore<ConfirmFlow>(idle);

function ConfirmBody({ ctx, original, next }: { ctx: PlannerContext; original: PlannerSession; next: PlannerSession }) {
  const m = smartConfirmModel(ctx, original, next);
  const state = useFlow(confirmFlow, true);
  return (
    <div className="smart-confirm" style={{ '--smart-accent': m.tone } as CSSProperties}>
      <div className="smart-confirm-banner">
        <Icon name="check" />
        <span><strong>Kontrola změny před uložením</strong><small>Žádná změna zatím není uložena. Ověřte činnost, datum, čas i kapacitu.</small></span>
      </div>
      <div className="move-review-compare">
        <section className="move-compare-card move-old"><small>PŮVODNÍ TERMÍN</small><strong>{m.oldCard.name}</strong><span>{m.oldCard.date}</span><b>{m.oldCard.time}</b><span>{m.oldCard.facts}</span></section>
        <div className="move-compare-arrow"><Icon name="arrow-right" /></div>
        <section className="move-compare-card move-new"><small>NOVÝ TERMÍN</small><strong>{m.newCard.name}</strong><span>{m.newCard.date}</span><b>{m.newCard.time}</b><span>{m.newCard.facts}</span></section>
      </div>
      <div className="smart-confirm-stats">
        <span><Icon name="dumbbell" /> {m.stats.slotMinutes}</span>
        <span><Icon name="users" /> {m.stats.booked}</span>
        <span><Icon name="check" /> Kontrola kolizí</span>
      </div>
      <div className={`smart-confirm-delivery${m.needsAck ? ' sensitive' : ''}`}>
        <Icon name={m.club ? 'calendar' : 'bell'} />
        <div><strong>{m.deliveryTitle}</strong><p>{m.deliveryText}</p>{m.deliveryNote ? <small>{m.deliveryNote}</small> : null}</div>
      </div>
      {m.needsAck ? (
        <label className="move-reservation-ack smart-agree">
          <input id="se-confirm-ack" type="checkbox" checked={state.ack} onChange={(e) => confirmFlow.set({ ack: e.target.checked })} />
          <span>{m.ackText}</span>
        </label>
      ) : null}
      {state.athletes ? (
        <section className="plan-athletes" data-testid="affected-athletes" role="alert">
          <strong>Změna zruší přihlášky {state.athletes.length} sportovců</strong>
          <ul>{state.athletes.map((a, i) => <li key={`${a.name}-${i}`}>{a.name}{a.activityName ? ` (${a.activityName})` : ''}</li>)}</ul>
          <label className="plan-ack">
            <input type="checkbox" checked={state.athletesAck} onChange={(e) => confirmFlow.set({ athletesAck: e.target.checked })} data-testid="athletes-ack" />
            <span>Potvrzuji zrušení přihlášek těchto sportovců.</span>
          </label>
        </section>
      ) : null}
      {state.error ? <p className="plan-dialog-error" role="alert">{state.error}</p> : null}
    </div>
  );
}

function ConfirmFooter({ original, next, draft }: { original: PlannerSession; next: PlannerSession; draft: SmartEditDraft }) {
  const ctx = usePlannerCtx();
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const state = useFlow(confirmFlow);
  const m = smartConfirmModel(ctx, original, next);
  const blocked = (m.needsAck && !state.ack) || (state.athletes !== null && !state.athletesAck) || state.busy;
  const commit = async () => {
    confirmFlow.set({ busy: true, error: null });
    try {
      const r = await commands.updateInterval({
        id: original.id,
        date: next.date,
        categoryId: next.categoryId,
        start: next.start,
        end: next.end,
        capacity: next.capacity,
        expectedVersion: original.version ?? null,
        ...(state.athletes !== null && state.athletesAck ? { cancelAffectedAthletes: true } : {}),
      });
      act.setUndoToken(r.undoToken);
      act.focusDate(next.date, true);
      act.closeDialog();
      act.toast(m.club ? 'Klubový termín byl aktualizován.' : 'Termín byl aktualizován.', { tone: 'moved', actionLabel: '↶ Vrátit změnu', actionKey: 'undo', durationMs: 7500 });
    } catch (error) {
      const athletes = (error as { affectedAthletes?: AffectedAthlete[] } | null)?.affectedAthletes ?? [];
      if (error instanceof PlannerWriteError && error.code === 'conflict' && athletes.length > 0) {
        confirmFlow.set({ busy: false, athletes, athletesAck: false });
      } else if (error instanceof PlannerWriteError && (error.code === 'stale' || error.code === 'notFound')) {
        confirmFlow.set({ busy: false });
        act.closeDialog();
        act.toast(error.message);
      } else {
        confirmFlow.set({ busy: false, error: writeMessage(error, 'Úpravu nelze uložit: změnila se dostupnost nebo kapacita.') });
      }
    }
  };
  return (
    <>
      <button type="button" className="app-button" id="se-back-editor" onClick={() => act.openDialog({ kind: 'smartEdit', id: original.id, prefill: draft })}>Zpět k úpravě</button>
      <button type="button" className="app-button primary smart-review-button" id="se-confirm-save" disabled={blocked} onClick={() => void commit()}>
        <Icon name="check" /> Potvrdit a uložit změnu
      </button>
    </>
  );
}

export const smartEditConfirmDialog: DialogRenderer<'smartEditConfirm'> = ({ dialog, model }) => {
  const ctx = model.ctx;
  const original = ctx?.sessions.find((s) => s.id === dialog.id);
  if (!ctx || !original) return { body: <p className="plan-dialog-note">Termín už neexistuje.</p> };
  const next = smartEditCandidate(ctx, original, dialog.draft);
  return {
    body: <ConfirmBody ctx={ctx} original={original} next={next} />,
    footer: <ConfirmFooter original={original} next={next} draft={dialog.draft} />,
    className: 'smart-editor-modal smart-confirm-modal',
  };
};
