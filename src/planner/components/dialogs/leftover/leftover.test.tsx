import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../../test/viewport';
import { DemoDataSource } from '../../../data/DemoDataSource';
import { PlannerDataProvider } from '../../../data/PlannerDataProvider';
import type { PlannerDataSource } from '../../../data/PlannerDataSource';
import type { DialogKind, PlannerSession } from '../../../model';
import { PlannerStoreProvider, createPlannerStore, type PlannerStore } from '../../../state/PlannerStoreProvider';
import { plannerActions } from '../../../state/plannerState';
import { PlannerModelProvider } from '../../context';
import { DialogLayer } from '../../DialogLayer';
import { dialogRegistry } from '../../dialogRegistry';
import { PlannerGate } from '../../PlannerGate';
import { Toast } from '../../Toast';

/*
 * The term dialogs nobody registered in the first pass: what each opens in OUR system, and that no dialog kind of the
 * file is left without a body.
 */

vi.mock('../../../../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: (props: { appointmentId: string; calendarId: string; calendar?: { name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Detail rezervace" data-testid="appointment-detail" data-id={props.appointmentId} data-calendar={props.calendarId} data-calendar-name={props.calendar?.name}>
      <button type="button" onClick={props.onClose}>close-detail</button>
    </div>
  ),
}));
vi.mock('../../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown> & { onClose: () => void }) => (
    <div role="dialog" aria-label="Nová objednávka" data-testid="new-appointment" data-props={JSON.stringify({ ...props, onClose: undefined, onBooked: undefined })}>
      <button type="button" onClick={props.onClose}>close-booking</button>
    </div>
  ),
}));
vi.mock('../../../../components/booking/calendar/ClubBlockPopover', () => ({
  ClubBlockPopover: (props: { pick: unknown; onOpenOrder: (id: string) => void; onOpen: (p: never) => void; onClose: () => void; onEditTerms?: unknown }) =>
    props.pick ? (
      <div role="dialog" aria-label="Blok klubu" data-testid="club-popover" data-pick={JSON.stringify(props.pick)} data-can-edit={props.onEditTerms ? 'yes' : 'no'}>
        <button type="button" onClick={() => props.onOpenOrder('order-9')}>Otevřít objednávku</button>
        <button type="button" onClick={() => props.onOpen(props.pick as never)}>Otevřít blok</button>
        <button type="button" onClick={props.onClose}>close-popover</button>
      </div>
    ) : null,
}));
vi.mock('../../../../api/clubBlocks', async (importActual) => {
  const actual = await importActual<typeof import('../../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: vi.fn().mockResolvedValue([]), clubBlocksApi: { get: vi.fn(), list: vi.fn().mockResolvedValue([]) } };
});

const TODAY = '2026-11-10';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

function Probe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-state={JSON.stringify(location.state ?? null)} />;
}

interface Mounted { store: PlannerStore; source: PlannerDataSource }
async function mount(source: PlannerDataSource, state: unknown = null): Promise<Mounted> {
  const store = createPlannerStore({ today: TODAY, selectedDate: '2026-11-18' });
  render(
    <MemoryRouter initialEntries={[{ pathname: '/planovani', state }]}>
      <PlannerDataProvider source={source} today={TODAY}>
        <PlannerStoreProvider initial={{ today: TODAY, selectedDate: '2026-11-18' }} store={store}>
          <PlannerModelProvider>
            <PlannerGate>
              <DialogLayer />
              <Toast />
              <Probe />
            </PlannerGate>
          </PlannerModelProvider>
        </PlannerStoreProvider>
      </PlannerDataProvider>
    </MemoryRouter>,
  );
  await screen.findByTestId('dialog-layer');
  return { store, source };
}
const openDialog = (m: Mounted, dialog: Parameters<typeof plannerActions.openDialog>[0]) => act(() => m.store.dispatch(plannerActions.openDialog(dialog)));
const layer = () => screen.getByTestId('dialog-layer');

const base = { capacity: 0, booked: 0, showInList: true } as const;
const sessions: PlannerSession[] = [
  // one booking
  { ...base, id: 'appt:one', date: '2026-11-18', start: '09:00', end: '09:20', categoryId: 'medical', capacity: 1, booked: 1, origin: 'public', publicBooked: 1,
    appointments: [{ id: 'a-1', calendarId: 'cal-1', patientName: 'Jana Nováková', status: 0, heads: 1, priceCzk: 1200 }] },
  // two bookings in one term
  { ...base, id: 'appt:two', date: '2026-11-18', start: '10:00', end: '10:40', categoryId: 'vo2', capacity: 3, booked: 3, origin: 'public', publicBooked: 3,
    price: { totalCzk: 1600, priced: 1, unpriced: 1, adjusted: false },
    appointments: [
      { id: 'a-2', calendarId: 'cal-1', patientName: 'Petr Svoboda', status: 0, heads: 1, priceCzk: 1600 },
      { id: 'a-3', calendarId: 'cal-2', patientName: null, status: 0, heads: 2, priceCzk: null },
    ] },
  // a club window of the real calendar (with a block) and one that has only an order
  { ...base, id: 'club:b-1', date: '2026-11-18', start: '12:30', end: '14:00', categoryId: 'medical', capacity: 4, booked: 1, origin: 'club', clubBooked: 1, foreign: true, clubBlockId: 'b-1', clubOrderId: 'order-9', clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#ff8800' },
  { ...base, id: 'club:o-only', date: '2026-11-19', start: '12:30', end: '14:00', categoryId: 'medical', capacity: 4, booked: 0, origin: 'club', foreign: true, clubBlockId: null, clubOrderId: 'order-7', clubId: 'club-3', clubName: 'SK Říčany' },
  // a term of the order being planned
  { ...base, id: 'own:1', date: '2026-11-20', start: '08:00', end: '09:00', categoryId: 'medical', capacity: 3, origin: 'club', orderId: 'order-draft' },
];

function source(mode: 'club' | 'standard', list: PlannerSession[] = sessions): DemoDataSource {
  const s = new DemoDataSource({ today: TODAY, sessions: list });
  const catalogue = s.getCatalogue.bind(s);
  s.getCatalogue = async () => ({
    ...(await catalogue()),
    capabilities: { simulateBookings: false, logoUpload: false, realPublish: true, mode, canBook: true, canPlanClubs: true },
  });
  Object.assign(s, { getCalendars: async () => [{ id: 'cal-1', name: 'Ambulance', color: '#111111', clinicServiceId: null, stepMinutes: 15 }] });
  if (mode === 'standard') {
    const order = s.getOrder.bind(s);
    s.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
  }
  return s;
}

describe('every dialog kind of the file has a body', () => {
  it('registers a renderer for each DialogKind (a new kind without one fails the type check below)', () => {
    const kinds: Record<DialogKind, true> = {
      orderDetails: true, settings: true, search: true, notifications: true, profile: true, filterPicker: true, clubDetails: true, clubEdit: true,
      eventDetail: true, agendaDetail: true, agendaFullList: true, deleteConfirm: true, newEvent: true, smartEdit: true, smartEditConfirm: true,
      moveConfirm: true, expandConfirm: true, finish: true, publish: true, formPreview: true, emailPreview: true, clubOccupancy: true,
    };
    const missing = (Object.keys(kinds) as DialogKind[]).filter((k) => typeof dialogRegistry[k] !== 'function');
    expect(missing).toEqual([]);
  });
});

describe('eventDetail / agendaDetail - the real record behind a term', () => {
  it('a term with ONE booking is that booking\'s detail (status, cancel and price live there), without the planner\'s own frame', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'eventDetail', id: 'appt:one' });
    const detail = await screen.findByTestId('appointment-detail');
    expect(detail).toHaveAttribute('data-id', 'a-1');
    expect(detail).toHaveAttribute('data-calendar', 'cal-1');
    await waitFor(() => expect(detail).toHaveAttribute('data-calendar-name', 'Ambulance'));
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    fireEvent.click(within(detail).getByRole('button', { name: 'close-detail' }));
    expect(m.store.getState().dialog).toBeNull();
  });

  it('the agenda list opens the same detail for a booking term (agendaDetail is decided by what is behind the term)', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'agendaDetail', id: 'appt:one' });
    expect(await screen.findByTestId('appointment-detail')).toHaveAttribute('data-id', 'a-1');
  });

  it('a term with several bookings lists them with their prices; each opens its own detail', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'eventDetail', id: 'appt:two' });
    const list = await screen.findByTestId('term-bookings');
    expect(list).toHaveTextContent('3 / 3 osob');
    expect(screen.getByTestId('term-total')).toHaveTextContent(/1\s600\sKč/);
    const rows = within(list).getAllByTestId('term-booking');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Petr Svoboda');
    expect(rows[0]).toHaveTextContent(/1\s600\sKč/);
    expect(rows[1]).toHaveTextContent('Bez jména');
    expect(rows[1]).toHaveTextContent('2 osob');
    expect(rows[1]).toHaveTextContent('bez ceny');
    fireEvent.click(rows[1]!);
    const detail = await screen.findByTestId('appointment-detail');
    expect(detail).toHaveAttribute('data-id', 'a-3');
    expect(detail).toHaveAttribute('data-calendar', 'cal-2');
    // the list stays under it: closing the detail goes back to the term
    fireEvent.click(within(detail).getByRole('button', { name: 'close-detail' }));
    expect(screen.queryByTestId('appointment-detail')).toBeNull();
    expect(screen.getByTestId('term-bookings')).toBeInTheDocument();
    expect(m.store.getState().dialog?.kind).toBe('eventDetail');
  });

  it('a club\'s window is what a click on it on the board says: the club popover, with the order one click away', async () => {
    const m = await mount(source('standard'), null);
    openDialog(m, { kind: 'agendaDetail', id: 'club:b-1' });
    const popover = await screen.findByTestId('club-popover');
    expect(JSON.parse(popover.dataset.pick!)).toMatchObject({ clubBlockId: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#ff8800', range: { from: '2026-11-18', to: '2026-11-18' } });
    expect(popover).toHaveAttribute('data-can-edit', 'yes');
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    fireEvent.click(within(popover).getByRole('button', { name: 'Otevřít objednávku' }));
    expect(m.store.getState().dialog).toBeNull();
    const probe = screen.getByTestId('location');
    expect(probe.dataset.path).toBe('/clubs/objednavky');
    expect(JSON.parse(probe.dataset.state!)).toEqual({ openOrderId: 'order-9' });
  });

  it('the legacy block of a club (no order) leads to the club screen with the block', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'eventDetail', id: 'club:b-1' });
    fireEvent.click(within(await screen.findByTestId('club-popover')).getByRole('button', { name: 'Otevřít blok' }));
    const probe = screen.getByTestId('location');
    expect(probe.dataset.path).toBe('/clubs');
    expect(JSON.parse(probe.dataset.state!)).toEqual({ clubBlockId: 'b-1', clubId: 'club-1' });
  });

  it('a window that names only its order offers the order', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'agendaDetail', id: 'club:o-only' });
    const body = await screen.findByTestId('term-club-order');
    fireEvent.click(within(body).getByRole('button', { name: 'Otevřít objednávku' }));
    expect(JSON.parse(screen.getByTestId('location').dataset.state!)).toEqual({ openOrderId: 'order-7' });
  });

  it('another club\'s window seen while an order is planned (a public, foreign term) is the same popover - nothing there is editable', async () => {
    const foreign: PlannerSession = { ...sessions[2]!, origin: 'public' };
    const m = await mount(source('club', [foreign, sessions[4]!]));
    openDialog(m, { kind: 'eventDetail', id: 'club:b-1' });
    expect(await screen.findByTestId('club-popover')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit termín' })).toBeNull();
  });

  it('a term of the order being planned shows the file\'s detail with Upravit / Zobrazit / Zrušit', async () => {
    const m = await mount(source('club'));
    openDialog(m, { kind: 'agendaDetail', id: 'own:1' });
    const body = await screen.findByTestId('term-draft');
    expect(body).toHaveTextContent('Sportovní prohlídky');
    expect(body).toHaveTextContent('08:00–09:00');
    expect(body).toHaveTextContent('3 sloty');
    expect(screen.getByTestId('planner-dialog')).toHaveAttribute('aria-label', 'Detail vytvořeného termínu');
    fireEvent.click(screen.getByRole('button', { name: 'Upravit termín' }));
    expect(m.store.getState().dialog).toEqual({ kind: 'smartEdit', id: 'own:1' });
  });

  it('"Zobrazit v kalendáři" brings the board to the term\'s week and closes', async () => {
    const m = await mount(source('club'));
    openDialog(m, { kind: 'agendaDetail', id: 'own:1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Zobrazit v kalendáři' }));
    expect(m.store.getState().dialog).toBeNull();
    expect(m.store.getState().weekStart).toBe('2026-11-16');
    expect(m.store.getState().selectedDate).toBe('2026-11-20');
  });

  it('says so when the term is gone', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'eventDetail', id: 'nope' });
    expect(await screen.findByTestId('term-gone')).toHaveTextContent('Termín už neexistuje');
  });
});

describe('deleteConfirm', () => {
  it('drops a term of the order being planned only after the question, from the order\'s draft, and offers undo', async () => {
    const s = source('club');
    const m = await mount(s);
    openDialog(m, { kind: 'agendaDetail', id: 'own:1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));
    expect(await screen.findByTestId('term-delete-text')).toHaveTextContent('Opravdu chcete odstranit termín Sportovní prohlídky dne 2026-11-20 (08:00 – 09:00)?');
    expect(s.snapshotSessions().some((x) => x.id === 'own:1')).toBe(true);
    // "Zpět" goes back to the detail
    fireEvent.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(m.store.getState().dialog).toEqual({ kind: 'agendaDetail', id: 'own:1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Odstranit termín' }));
    await waitFor(() => expect(s.snapshotSessions().some((x) => x.id === 'own:1')).toBe(false));
    await waitFor(() => expect(m.store.getState().dialog).toBeNull());
    expect(await screen.findByText(/Termín odstraněn/)).toBeInTheDocument();
    expect(m.store.getState().planning.undoToken).not.toBeNull();
  });

  it('never deletes a booking or another club\'s window: it IS their own detail (the real cancel flows)', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'deleteConfirm', id: 'appt:one' });
    expect(await screen.findByTestId('appointment-detail')).toHaveAttribute('data-id', 'a-1');
    expect(screen.queryByRole('button', { name: 'Odstranit termín' })).toBeNull();
    act(() => m.store.dispatch(plannerActions.openDialog({ kind: 'deleteConfirm', id: 'club:b-1' })));
    expect(await screen.findByTestId('club-popover')).toBeInTheDocument();
  });
});

describe('newEvent', () => {
  it('in standard ordering is a new booking: the application\'s booking dialog on the day (and time) given', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'newEvent', defaults: { date: '2026-11-19', start: '10:30', end: '11:00' } });
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({ open: true, initialDate: '2026-11-19', initialStart: '2026-11-19T10:30', initialEnd: '2026-11-19T11:00' });
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });

  it('without a time it starts on the day the board shows', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'newEvent' });
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props.initialDate).toBe('2026-11-18');
    expect(props.initialStart).toBeUndefined();
  });

  it('says it cannot book without the permission', async () => {
    const s = source('standard');
    const catalogue = s.getCatalogue.bind(s);
    s.getCatalogue = async () => {
      const c = await catalogue();
      return { ...c, capabilities: { ...c.capabilities, canBook: false } };
    };
    const m = await mount(s);
    openDialog(m, { kind: 'newEvent' });
    expect(await screen.findByTestId('new-term-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('new-appointment')).toBeNull();
  });

  it('while an order is planned, without an armed činnost it asks to pick one first', async () => {
    const m = await mount(source('club'));
    openDialog(m, { kind: 'newEvent' });
    expect(await screen.findByTestId('new-term-pick')).toHaveTextContent('Nejprve vyberte činnost');
  });

  it('while an order is planned the armed činnost gets a term written into the order\'s draft, with the capacity worked out from the time', async () => {
    const s = source('club', []);
    const m = await mount(s);
    act(() => m.store.dispatch(plannerActions.selectPlanningCategory('medical')));
    openDialog(m, { kind: 'newEvent', defaults: { date: '2026-11-24', start: '09:00', end: '10:00' } });
    const form = await screen.findByTestId('new-term-form');
    expect(form).toHaveTextContent('Sportovní prohlídky · 20 min / osoba');
    await waitFor(() => expect(screen.getByLabelText('Od')).toHaveValue('09:00'));
    expect(screen.getByTestId('new-term-capacity')).toHaveTextContent('3 slotů · 20 min na osobu');
    fireEvent.change(screen.getByLabelText('Do'), { target: { value: '09:50' } });
    expect(screen.getByTestId('new-term-capacity')).toHaveTextContent('neúplný interval');
    fireEvent.change(screen.getByLabelText('Do'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit termín' }));
    await waitFor(() => expect(s.snapshotSessions()).toHaveLength(1));
    expect(s.snapshotSessions()[0]).toMatchObject({ date: '2026-11-24', start: '09:00', end: '10:00', categoryId: 'medical', capacity: 3 });
    await waitFor(() => expect(m.store.getState().dialog).toBeNull());
    expect(m.store.getState().selectedDate).toBe('2026-11-24');
    expect(m.store.getState().planning.undoToken).not.toBeNull();
  });

  it('a range the order refuses stays in the form with the reason', async () => {
    const s = source('club', []);
    const m = await mount(s);
    act(() => m.store.dispatch(plannerActions.selectPlanningCategory('medical')));
    openDialog(m, { kind: 'newEvent', defaults: { date: '2026-11-24', start: '09:00', end: '09:50' } });
    await screen.findByTestId('new-term-form');
    await waitFor(() => expect(screen.getByLabelText('Do')).toHaveValue('09:50'));
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit termín' }));
    expect(await screen.findByTestId('new-term-error')).toHaveTextContent('Rozsah musí být násobkem 20 minut.');
    expect(s.snapshotSessions()).toHaveLength(0);
    expect(m.store.getState().dialog?.kind).toBe('newEvent');
  });
});

describe('agendaFullList', () => {
  it('lists the calendar\'s terms by day in standard ordering and filters them; a row opens its record', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'agendaFullList', categoryId: 'all' });
    const dialog = await screen.findByTestId('agenda-full');
    expect(screen.getByTestId('planner-dialog')).toHaveAttribute('aria-label', 'Všechny termíny');
    const stats = within(dialog).getByText('termínů').closest('.agenda-full-stat')!;
    expect(stats).toBeInTheDocument();
    const rows = () => dialog.querySelectorAll('[data-agenda-detail]');
    // the club windows count too: they are in the clinic's calendar
    expect([...rows()].map((r) => r.getAttribute('data-agenda-detail'))).toEqual(['appt:one', 'appt:two', 'club:b-1', 'club:o-only', 'own:1']);
    fireEvent.change(within(dialog).getByLabelText('Filtr činností'), { target: { value: 'vo2' } });
    expect([...rows()].map((r) => r.getAttribute('data-agenda-detail'))).toEqual(['appt:two']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vymazat' }));
    fireEvent.change(within(dialog).getByLabelText('Filtr data'), { target: { value: '2026-11-19' } });
    expect([...rows()].map((r) => r.getAttribute('data-agenda-detail'))).toEqual(['club:o-only']);
    fireEvent.click(rows()[0]!);
    expect(m.store.getState().dialog).toEqual({ kind: 'agendaDetail', id: 'club:o-only' });
  });

  it('while an order is planned lists only the order\'s own terms (another club\'s windows are busy time, not terms of the order)', async () => {
    const m = await mount(source('club'));
    openDialog(m, { kind: 'agendaFullList', categoryId: 'all' });
    const dialog = await screen.findByTestId('agenda-full');
    expect(screen.getByTestId('planner-dialog')).toHaveAttribute('aria-label', 'Všechny vytvořené termíny');
    const ids = [...dialog.querySelectorAll('[data-agenda-detail]')].map((r) => r.getAttribute('data-agenda-detail'));
    expect(ids).toContain('own:1');
    expect(ids).not.toContain('club:b-1');
  });

  it('opens on the činnost the agenda tab was showing', async () => {
    const m = await mount(source('standard'));
    openDialog(m, { kind: 'agendaFullList', categoryId: 'vo2' });
    const dialog = await screen.findByTestId('agenda-full');
    expect(within(dialog).getByLabelText('Filtr činností')).toHaveValue('vo2');
    expect([...dialog.querySelectorAll('[data-agenda-detail]')].map((r) => r.getAttribute('data-agenda-detail'))).toEqual(['appt:two']);
  });
});
