/*
 * The term dialogs the first pass of the planner left without a body: `agendaDetail`, `eventDetail`,
 * `deleteConfirm`, `newEvent` and `agendaFullList`.
 *
 * A planner term (`PlannerSession`) is a stretch of one činnost. What is BEHIND it decides what the desk may do, and
 * that is read from the session itself - never from which dialog kind opened it (the file opens `agendaDetail` for a
 * club's term and `eventDetail` for a public one, but the real calendar mixes both: another club's window is a
 * `public`, `foreign` term while an order is planned, and a club's own window is a `club` term in standard ordering):
 *
 *   bookings     (`appointments`)  one booking  -> `AppointmentDetail`, the dialog the grid opens on a card (status,
 *                                  cancel, price all live there); several -> the term's figures and a row per booking,
 *                                  each opening its `AppointmentDetail`;
 *   club window  (`foreign` + block/order) -> `ClubBlockPopover`, exactly what a click on the window on the board says:
 *                                  the order ("Otevřít objednávku"), "Upravit termíny", or the legacy block;
 *   draft term   (club, not foreign) a term of the order being planned -> the file's detail with "Upravit termín"
 *                                  (`smartEdit`), "Zobrazit v kalendáři" and "Zrušit termín" (`deleteConfirm`);
 *   plain        the demo source's public term -> the file's occupancy detail.
 *
 * Cancelling is therefore never done here for a booking or for another club's window: `deleteConfirm` for those
 * falls back to the detail that owns the real cancel flow. The one delete it performs is a term of the order that is
 * being planned, which is the order's DRAFT (`PlannerDataSource.deleteInterval`; the real order is written once, at
 * "Dokončit plánování").
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchBlockableActivities } from '../../../../api/clubBlocks';
import type { ClubOrderView } from '../../../../api/clubOrders';
import { ClubBlockPopover, type ClubBlockPick } from '../../../../components/booking/calendar/ClubBlockPopover';
import { NewAppointmentDialog } from '../../../../components/booking/NewAppointmentDialog';
import { priceWord } from '../../../../components/booking/price/agreedPrice';
import { editSessionFor } from '../../../../components/clubs/order/editSession';
import { PlannerWriteError, plannerKeys } from '../../../data/PlannerDataSource';
import { usePlannerData } from '../../../data/PlannerDataProvider';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import {
  agendaDetailModel,
  agendaFullListModel,
  automaticCapacityText,
  categoryOrFallback,
  newEventDefaults,
  orderCategoryIds,
  publicEventDetailModel,
  slotMinutesOf,
  sourceFor,
  type CategoryId,
  type DialogState,
  type IsoDate,
  type PlannerContext,
  type PlannerSession,
} from '../../../model';
import { usePlannerActions, usePlannerSelector } from '../../../state/PlannerStoreProvider';
import type { PlannerModel } from '../../../state/usePlannerModel';
import { useSafeNavigate } from '../../board/useSafeNavigate';
import { usePlannerCtx, usePlannerModelState } from '../../context';
import type { DialogContent, DialogRenderer } from '../../dialogRegistry';
import { Icon } from '../../Icons';
import { isTermOfOrder } from '../../left/agendaView';
import { writeMessage } from '../../plan/usePlanCommit';
import { createFlowStore, useFlow } from '../plan/flowStore';
import { AppointmentRecord } from '../reservation/useRecordOpener';
import './leftover.css';

const tone = (value: string): CSSProperties => ({ '--agenda-tone': value }) as CSSProperties;

/* -------------------------------------------------------------------------- */
/* What a term is                                                              */
/* -------------------------------------------------------------------------- */

export type TermKind = 'bookings' | 'clubWindow' | 'draft' | 'plain';

/** The records behind a term decide what the desk may do with it (see the file's header). */
export function termKindOf(s: PlannerSession): TermKind {
  if (s.appointments && s.appointments.length > 0) return 'bookings';
  if (s.foreign === true && (s.clubBlockId || s.clubOrderId)) return 'clubWindow';
  if (sourceFor(s) === 'club' && s.foreign !== true) return 'draft';
  return 'plain';
}

/** The demo source simulates bookings: its public terms are the file's own (editable, deletable). */
const editableTerm = (kind: TermKind, model: PlannerModel): boolean =>
  kind === 'draft' || (kind === 'plain' && model.catalogue?.capabilities.simulateBookings === true);

const gone: DialogContent = { body: <p className="plan-dialog-note" data-testid="term-gone">Termín už neexistuje - mezitím ho někdo změnil nebo zrušil.</p> };

/* -------------------------------------------------------------------------- */
/* Bookings                                                                    */
/* -------------------------------------------------------------------------- */

function BookingsBody({ session }: { session: PlannerSession }) {
  const ctx = usePlannerCtx();
  const [open, setOpen] = useState<{ id: string; calendarId: string } | null>(null);
  const m = publicEventDetailModel(ctx, session);
  const people = session.appointments ?? [];
  const price = session.price ?? null;
  return (
    <div data-testid="term-bookings">
      <div className="info-statline">
        <div className="event-big-icon"><Icon name={m.iconKey} /></div>
        <div>
          <div className="info-label">TERMÍN</div>
          <strong style={{ fontSize: 24 }}>{m.name}</strong>
          <div className="hint">{m.dateline}</div>
        </div>
      </div>
      <div className="info-details">
        <div><div className="info-label">Čas termínu</div><div className="info-value">{m.time}</div></div>
        <div><div className="info-label">Obsazenost</div><div className="info-value">{m.occupancy}</div></div>
        <div><div className="info-label">Zbývající kapacita</div><div className="info-value">{m.free}</div></div>
        <div>
          <div className="info-label">Součet cen</div>
          <div className="info-value" data-testid="term-total">{price && price.priced > 0 ? priceWord(price.totalCzk) : 'bez ceny'}</div>
        </div>
      </div>
      <div className="capacity-bar" aria-hidden="true"><div style={{ width: `${m.fillBar}%` }} /></div>
      <div className="lo-section">REZERVACE V TERMÍNU <span>kliknutím otevřete detail rezervace</span></div>
      <div className="lo-bookings">
        {people.map((p) => (
          <button key={p.id} type="button" className="lo-booking" data-testid="term-booking" data-appointment={p.id} onClick={() => setOpen({ id: p.id, calendarId: p.calendarId })}>
            <span className="lo-booking-name">
              <b>{p.patientName ?? 'Bez jména'}</b>
              {p.heads > 1 ? <small>{p.heads} osob</small> : null}
            </span>
            <span className="lo-booking-price">{priceWord(p.priceCzk)}</span>
            <Icon name="chevron-right" />
          </button>
        ))}
      </div>
      {open ? <AppointmentRecord appointmentId={open.id} calendarId={open.calendarId} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Another club's window                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What a click on a club's window on the board says (`ClubBlockPopover`), drawn in the middle of the screen. A window of
 * an order opens the ORDER, a legacy block the club screen; "Upravit termíny" starts club planning on that order.
 */
function ClubWindowHost({ session, close }: { session: PlannerSession; close: () => void }) {
  const ctx = usePlannerCtx();
  const nav = useSafeNavigate();
  const { catalogue } = usePlannerModelState();
  const mayEdit = catalogue?.capabilities.canPlanClubs === true && nav.available;
  const pick = useMemo<ClubBlockPick>(
    () => ({
      clubBlockId: session.clubBlockId ?? '',
      clubId: session.clubId ?? null,
      clubName: session.clubName?.trim() || 'Klub',
      colorHex: session.clubColorHex ?? null,
      range: { from: session.date, to: session.date },
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 3),
    }),
    [session],
  );
  const goOrder = (orderId: string) => {
    close();
    nav.go('/clubs/objednavky', { state: { openOrderId: orderId } });
  };
  const goBlock = (p: ClubBlockPick) => {
    close();
    nav.go('/clubs', { state: { clubBlockId: p.clubBlockId, ...(p.clubId ? { clubId: p.clubId } : {}) } });
  };
  const editTerms = async (order: ClubOrderView) => {
    close();
    let activities: Awaited<ReturnType<typeof fetchBlockableActivities>> = [];
    try {
      activities = await fetchBlockableActivities();
    } catch {
      /* the session is built without the catalogue; the page asks for what is missing */
    }
    nav.go(nav.pathname, { state: { pickOrder: { start: editSessionFor(order, activities, ctx.today) } } });
  };
  return (
    <ClubBlockPopover
      pick={pick}
      today={ctx.today}
      onOpen={goBlock}
      onOpenOrder={goOrder}
      {...(mayEdit ? { onEditTerms: (order: ClubOrderView) => void editTerms(order) } : {})}
      onClose={close}
    />
  );
}

/** A window that names an order but no block (never seen from the real source): the order is one click away. */
function ClubOrderOnly({ session }: { session: PlannerSession }) {
  const nav = useSafeNavigate();
  const act = usePlannerActions();
  const orderId = session.clubOrderId ?? '';
  return (
    <div data-testid="term-club-order">
      <p className="plan-dialog-note">{session.clubName?.trim() || 'Klub'} má v tomto čase vlastní objednávku.</p>
      <button
        type="button"
        className="app-button primary"
        disabled={!nav.available}
        onClick={() => {
          act.closeDialog();
          nav.go('/clubs/objednavky', { state: { openOrderId: orderId } });
        }}
      >
        Otevřít objednávku
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A term of the order being planned (the file's detail)                       */
/* -------------------------------------------------------------------------- */

function DraftBody({ session }: { session: PlannerSession }) {
  const ctx = usePlannerCtx();
  const m = agendaDetailModel(ctx, session);
  return (
    <div data-testid="term-draft">
      <div className="agenda-detail-hero" style={tone(m.tone)}>
        <span className="big-icon"><Icon name={m.iconKey} /></span>
        <div>
          <small>{m.dateline}</small>
          <h3>{m.name}</h3>
          <small>{m.subline}</small>
        </div>
      </div>
      <div className="agenda-detail-stats">
        <div><small>ČAS TERMÍNU</small><strong>{m.stats.time}</strong></div>
        <div><small>VYTVOŘENÉ SLOTY</small><strong>{m.stats.slots}</strong></div>
        <div><small>CELKOVÁ DÉLKA</small><strong>{m.stats.length}</strong></div>
      </div>
      <div className="agenda-detail-note">{m.note}</div>
    </div>
  );
}

/** The demo source's public term: the file's occupancy view. */
function PlainBody({ session }: { session: PlannerSession }) {
  const ctx = usePlannerCtx();
  const m = publicEventDetailModel(ctx, session);
  return (
    <div data-testid="term-plain">
      <div className="info-statline">
        <div className="event-big-icon"><Icon name={m.iconKey} /></div>
        <div>
          <div className="info-label">VYTVOŘENÝ TERMÍN</div>
          <strong style={{ fontSize: 24 }}>{m.name}</strong>
          <div className="hint">{m.dateline}</div>
        </div>
      </div>
      <div className="info-details">
        <div><div className="info-label">Čas vyšetření</div><div className="info-value">{m.time}</div></div>
        <div><div className="info-label">Obsazenost</div><div className="info-value">{m.occupancy}</div></div>
        <div><div className="info-label">Zbývající kapacita</div><div className="info-value">{m.free}</div></div>
        <div><div className="info-label">Naplnění</div><div className="info-value">{m.fillPercent} %</div></div>
      </div>
      <div className="capacity-bar" aria-hidden="true"><div style={{ width: `${m.fillBar}%` }} /></div>
    </div>
  );
}

function EditableFooter({ id, close }: { id: string; close: () => void }) {
  const act = usePlannerActions();
  const date = usePlannerCtx().sessions.find((s) => s.id === id)?.date ?? null;
  return (
    <>
      <button type="button" className="app-button danger" id="agenda-delete" onClick={() => act.openDialog({ kind: 'deleteConfirm', id })}>Zrušit termín</button>
      <button
        type="button"
        className="app-button"
        id="agenda-locate"
        onClick={() => {
          if (date) act.focusDate(date, true);
          close();
          act.toast('Termín se nachází v zobrazeném týdnu.');
        }}
      >
        Zobrazit v kalendáři
      </button>
      <button type="button" className="app-button primary" id="agenda-edit" onClick={() => act.openDialog({ kind: 'smartEdit', id })}>Upravit termín</button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* agendaDetail / eventDetail / deleteConfirm                                  */
/* -------------------------------------------------------------------------- */

/** The content for a term, whichever dialog kind asked. `deleteConfirm` asks for the deletion variant of a draft term. */
function contentOfTerm(id: string, model: PlannerModel, close: () => void, variant: 'detail' | 'delete'): DialogContent {
  const session = model.ctx?.sessions.find((s) => s.id === id);
  if (!session) return gone;
  const kind = termKindOf(session);
  const category = model.ctx ? categoryOrFallback(model.ctx, session.categoryId).name : '';

  if (kind === 'bookings') {
    const only = session.appointments!.length === 1 ? session.appointments![0]! : null;
    if (only) {
      return { frameless: true, body: <AppointmentRecord appointmentId={only.id} calendarId={only.calendarId} onClose={close} /> };
    }
    return { title: 'Detail termínu', subtitle: `${category} · ${session.date}`, body: <BookingsBody session={session} /> };
  }
  if (kind === 'clubWindow') {
    if (session.clubBlockId) return { frameless: true, body: <ClubWindowHost session={session} close={close} /> };
    return { title: 'Klubová objednávka', subtitle: session.clubName?.trim() || 'Klub', body: <ClubOrderOnly session={session} /> };
  }
  if (variant === 'delete' && editableTerm(kind, model)) {
    return {
      title: 'Zrušit termín?',
      subtitle: 'Odstranění termínu z rozvrhu',
      body: <DeleteBody session={session} categoryName={category} />,
      footer: <DeleteFooter id={session.id} />,
    };
  }
  if (kind === 'draft') {
    return { title: 'Detail vytvořeného termínu', subtitle: 'SPRÁVA TERMÍNU', body: <DraftBody session={session} />, footer: <EditableFooter id={session.id} close={close} /> };
  }
  return {
    title: 'Detail termínu',
    body: <PlainBody session={session} />,
    ...(editableTerm(kind, model) ? { footer: <EditableFooter id={session.id} close={close} /> } : {}),
  };
}

export const agendaDetailDialog: DialogRenderer<'agendaDetail'> = ({ dialog, close, model }) => contentOfTerm(dialog.id, model, close, 'detail');
export const eventDetailDialog: DialogRenderer<'eventDetail'> = ({ dialog, close, model }) => contentOfTerm(dialog.id, model, close, 'detail');
/**
 * A booking is cancelled in its own detail and another club's window in that club's order - so for those the
 * confirmation IS that detail. Only a term of the order being planned is dropped here.
 */
export const deleteConfirmDialog: DialogRenderer<'deleteConfirm'> = ({ dialog, close, model }) => contentOfTerm(dialog.id, model, close, 'delete');

function DeleteBody({ session, categoryName }: { session: PlannerSession; categoryName: string }) {
  return (
    <p style={{ fontSize: 17, lineHeight: 1.7 }} data-testid="term-delete-text">
      Opravdu chcete odstranit termín <strong>{categoryName}</strong> dne <strong>{session.date}</strong> ({session.start} – {session.end})?
    </p>
  );
}

function DeleteFooter({ id }: { id: string }) {
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const result = await commands.deleteInterval(id);
      act.setUndoToken(result.undoToken);
      act.closeDialog();
      act.toast('Termín odstraněn. Jeho kapacita se vrátila do objednávky.', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
    } catch (error) {
      setBusy(false);
      act.toast(writeMessage(error, 'Termín se nepodařilo odstranit.'));
    }
  };
  return (
    <>
      <button type="button" className="app-button" onClick={() => act.openDialog({ kind: 'agendaDetail', id })}>Zpět</button>
      <button type="button" className="app-button danger" id="confirm-delete" disabled={busy} onClick={() => void remove()}>Odstranit termín</button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* newEvent                                                                    */
/* -------------------------------------------------------------------------- */

/** Standard ordering: "a new term" is a new booking - the application's own booking dialog, on the given day and time. */
function NewBookingHost({ defaults, close }: { defaults: { date?: IsoDate; start?: string; end?: string } | undefined; close: () => void }) {
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const { source } = usePlannerData();
  const client = useQueryClient();
  const date = defaults?.date ?? selectedDate;
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['day-range'] });
    void client.invalidateQueries({ queryKey: ['blocks'] });
    void client.invalidateQueries({ queryKey: plannerKeys.all(source.id) });
  };
  return (
    <NewAppointmentDialog
      open
      onClose={close}
      onBooked={refresh}
      initialDate={date}
      {...(defaults?.start ? { initialStart: `${date}T${defaults.start}` } : {})}
      {...(defaults?.start && defaults.end ? { initialEnd: `${date}T${defaults.end}` } : {})}
    />
  );
}

interface NewTermForm {
  date: IsoDate;
  start: string;
  end: string;
  error: string;
  busy: boolean;
}
const newTermForm = createFlowStore<NewTermForm>({ date: '', start: '', end: '', error: '', busy: false });

function NewTermBody({ categoryId, initial }: { categoryId: CategoryId; initial: Pick<NewTermForm, 'date' | 'start' | 'end'> }) {
  const ctx = usePlannerCtx();
  const form = useFlow(newTermForm, true);
  useEffect(() => {
    newTermForm.set({ ...initial, error: '', busy: false });
  }, [initial]);
  const name = categoryOrFallback(ctx, categoryId).name;
  const mins = slotMinutesOf(ctx, categoryId);
  return (
    <form id="event-form" onSubmit={(e) => e.preventDefault()} data-testid="new-term-form">
      <div className="contact-card-info">
        {name} · {mins} min / osoba. Kapacita se u nového termínu vypočítá automaticky z délky vybraného času. Termín = skupina navazujících slotů.
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="new-date">Datum</label><input id="new-date" type="date" value={form.date} required onChange={(e) => newTermForm.set({ date: e.target.value, error: '' })} /></div>
        <div className="field"><label htmlFor="new-type">Činnost</label><input id="new-type" value={name} disabled readOnly /></div>
        <div className="field"><label htmlFor="new-start">Od</label><input id="new-start" type="time" step={300} value={form.start} required onChange={(e) => newTermForm.set({ start: e.target.value, error: '' })} /></div>
        <div className="field"><label htmlFor="new-end">Do</label><input id="new-end" type="time" step={300} value={form.end} required onChange={(e) => newTermForm.set({ end: e.target.value, error: '' })} /></div>
        <div className="field full">
          <label>Počet slotů</label>
          <div className="hint" id="automatic-cap" data-testid="new-term-capacity">{automaticCapacityText(form.start, form.end, mins)}</div>
        </div>
      </div>
      {form.error ? <p className="plan-dialog-note" role="alert" data-testid="new-term-error" style={{ color: '#ffb661' }}>{form.error}</p> : null}
    </form>
  );
}

function NewTermFooter({ categoryId }: { categoryId: CategoryId }) {
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const form = useFlow(newTermForm);
  const save = async () => {
    const { date, start, end } = newTermForm.get();
    newTermForm.set({ busy: true, error: '' });
    try {
      const result = await commands.createTerm({ date, categoryId, start, end });
      act.setUndoToken(result.undoToken);
      act.focusDate(date, true);
      act.closeDialog();
      act.toast('Termín byl vytvořen.', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
    } catch (error) {
      newTermForm.set({ busy: false, error: writeMessage(error, 'Termín se nepodařilo vytvořit.') });
      if (!(error instanceof PlannerWriteError)) act.toast('Termín se nepodařilo vytvořit.');
    }
  };
  return (
    <>
      <button type="button" className="app-button" data-close="1" onClick={() => act.closeDialog()}>Zrušit</button>
      <button type="button" className="app-button primary" id="save-event" disabled={form.busy || !form.date || !form.start || !form.end} onClick={() => void save()}>Vytvořit termín</button>
    </>
  );
}

export const newEventDialog: DialogRenderer<'newEvent'> = ({ dialog, close, model }) => {
  const caps = model.catalogue?.capabilities;
  if (caps?.mode === 'standard') {
    if (caps.canBook === false) {
      return { title: 'Nová rezervace', subtitle: 'Rezervace pacienta', body: <p className="plan-dialog-note" data-testid="new-term-denied">Nové rezervace vytvářet nemůžete - chybí oprávnění.</p> };
    }
    return { frameless: true, body: <NewBookingHost defaults={dialog.defaults} close={close} /> };
  }
  const ctx = model.ctx;
  return { body: <NewTermEntry dialogDefaults={dialog.defaults} ctx={ctx} />, footer: <NewTermEntryFooter dialogDefaults={dialog.defaults} ctx={ctx} /> };
};

type NewEventDefaultsInput = Extract<DialogState, { kind: 'newEvent' }>['defaults'];

/** The armed činnost lives in the store, so the club form reads it in a component. */
function useNewTermDefaults(ctx: PlannerContext | null, given: NewEventDefaultsInput) {
  const armed = usePlannerSelector((s) => s.planning.selectedCategoryId);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  return useMemo(() => (ctx ? newEventDefaults(ctx, armed, selectedDate, given ?? {}) : null), [ctx, armed, selectedDate, given]);
}

function NewTermEntry({ dialogDefaults, ctx }: { dialogDefaults: NewEventDefaultsInput; ctx: PlannerContext | null }) {
  const d = useNewTermDefaults(ctx, dialogDefaults);
  const initial = useMemo(() => (d ? { date: d.date, start: d.start, end: d.end } : null), [d]);
  if (!d || !initial) return <p className="plan-dialog-note" data-testid="new-term-pick">Nejprve vyberte činnost z dolních karet.</p>;
  return <NewTermBody categoryId={d.categoryId} initial={initial} />;
}

function NewTermEntryFooter({ dialogDefaults, ctx }: { dialogDefaults: NewEventDefaultsInput; ctx: PlannerContext | null }) {
  const act = usePlannerActions();
  const d = useNewTermDefaults(ctx, dialogDefaults);
  if (!d) return <button type="button" className="app-button" data-close="1" onClick={() => act.closeDialog()}>Zavřít</button>;
  return <NewTermFooter categoryId={d.categoryId} />;
}

/* -------------------------------------------------------------------------- */
/* agendaFullList                                                              */
/* -------------------------------------------------------------------------- */

/** The terms the agenda lists: the order's own while a club order is planned, every term of the calendar otherwise. */
function listedContext(ctx: PlannerContext, club: boolean): PlannerContext {
  if (club) return { ...ctx, sessions: ctx.sessions.filter(isTermOfOrder) };
  return {
    ...ctx,
    sessions: ctx.sessions
      .filter((s) => s.showInList !== false && s.categoryId !== '')
      // Only so that the model's list (which hides a club's term outside the ordered činnosti) keeps it; ids stay.
      .map((s) => (sourceFor(s) === 'public' ? s : { ...s, origin: 'public' as const })),
  };
}

function FullListBody({ initialCategory }: { initialCategory: CategoryId | 'all' }) {
  const base = usePlannerCtx();
  const { catalogue } = usePlannerModelState();
  const act = usePlannerActions();
  const club = catalogue?.capabilities.mode ? catalogue.capabilities.mode === 'club' : base.demands.length > 0;
  const ctx = useMemo(() => listedContext(base, club), [base, club]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | 'all'>(initialCategory);
  const [date, setDate] = useState('');
  const categories: CategoryId[] = club
    ? orderCategoryIds(ctx)
    : [...new Set(ctx.sessions.map((s) => s.categoryId))];
  const m = agendaFullListModel(ctx, { query, categoryId, date });
  return (
    <div data-testid="agenda-full">
      <div className="agenda-full-tools">
        <input id="agenda-full-search" type="search" placeholder="Hledat činnost, datum nebo čas…" aria-label="Hledat termín" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select id="agenda-full-type" aria-label="Filtr činností" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">Všechny činnosti</option>
          {categories.map((id) => <option key={id} value={id}>{categoryOrFallback(ctx, id).name}</option>)}
        </select>
        <input id="agenda-full-date" type="date" aria-label="Filtr data" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="agenda-full-reset" id="agenda-full-reset" onClick={() => { setQuery(''); setCategoryId('all'); setDate(''); }}>Vymazat</button>
      </div>
      <div className="agenda-full-stats" id="agenda-full-stats">
        <div className="agenda-full-stat"><strong>{m.stats.terms}</strong><small>{club ? 'vytvořených termínů' : 'termínů'}</small></div>
        <div className="agenda-full-stat"><strong>{m.stats.slots}</strong><small>{club ? 'vytvořených slotů' : 'slotů'}</small></div>
        <div className="agenda-full-stat"><strong>{m.stats.time}</strong><small>{club ? 'celkový naplánovaný čas' : 'celkový čas'}</small></div>
      </div>
      <div className="agenda-full-list" id="agenda-full-results" aria-live="polite">
        {m.groups.length === 0 ? (
          <div className="agenda-full-empty">{m.empty}</div>
        ) : (
          m.groups.map((g) => (
            <div key={g.date}>
              <div className="agenda-full-day"><span>{g.title}</span><small>{g.summary}</small></div>
              {g.rows.map((row) => (
                <button key={row.id} type="button" className="agenda-full-row" data-agenda-detail={row.id} style={tone(row.tone)} onClick={() => act.openDialog({ kind: 'agendaDetail', id: row.id })}>
                  <span className="time">{row.timeRange}</span>
                  <span className="act"><i className="dot" /><span className="act-label"><b>{row.name}</b><small>{row.subtitle}</small></span></span>
                  <span className="slot-count">{row.slotsLabel}</span>
                  <Icon name="chevron-right" />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const agendaFullListDialog: DialogRenderer<'agendaFullList'> = ({ dialog, model }) => {
  const club = model.catalogue?.capabilities.mode ? model.catalogue.capabilities.mode === 'club' : (model.ctx?.demands.length ?? 0) > 0;
  return {
    title: club ? 'Všechny vytvořené termíny' : 'Všechny termíny',
    subtitle: club ? 'Klubová objednávka' : 'Kalendář kliniky',
    body: <FullListBody key={dialog.categoryId} initialCategory={dialog.categoryId} />,
  };
};
