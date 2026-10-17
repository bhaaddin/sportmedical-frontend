import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { DemoDataSource } from '../../data/DemoDataSource';
import { plannerActions } from '../../state/plannerState';
import { ReservationDrawer } from '../ReservationDrawer';
import { DialogLayer } from '../DialogLayer';
import { mountPanels } from './testHarness';

const clubBlockGet = vi.hoisted(() => vi.fn());
vi.mock('../../../api/clubBlocks', () => ({ clubBlocksApi: { get: clubBlockGet } }));
vi.mock('../../../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: (props: { appointmentId: string; calendarId: string; calendar?: { name: string }; onClose: () => void; onChanged: () => void }) => (
    <div data-testid="appointment-detail" data-id={props.appointmentId} data-calendar={props.calendarId} data-calendar-name={props.calendar?.name}>
      <button type="button" onClick={props.onChanged}>changed</button>
      <button type="button" onClick={props.onClose}>close-detail</button>
    </div>
  ),
}));
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: { open: boolean; initialDate?: string; onClose: () => void; onBooked: () => void }) =>
    props.open ? (
      <div data-testid="new-booking" data-date={props.initialDate}>
        <button type="button" onClick={props.onBooked}>booked</button>
        <button type="button" onClick={props.onClose}>close-booking</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  clubBlockGet.mockReset();
});
afterEach(() => cleanup());

function Probe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-state={JSON.stringify(location.state ?? null)} />;
}

const mount = async (options: Parameters<typeof mountPanels>[1] = {}) => {
  const m = mountPanels(
    <>
      <ReservationDrawer />
      <DialogLayer />
      <Probe />
    </>,
    { router: true, ...options },
  );
  await screen.findByTestId('reservation-drawer');
  return m;
};
const open = (m: Awaited<ReturnType<typeof mount>>, date: string, tab?: 'overview' | 'bookings' | 'club') => {
  act(() => m.store.dispatch(plannerActions.openReservationDrawer(date)));
  if (tab) act(() => m.store.dispatch(plannerActions.setDrawerTab(tab)));
};
const panel = () => screen.getByTestId('reservation-drawer-panel');
const kpi = (label: string) => document.querySelector(`[data-kpi="${label}"] strong`)!.textContent;

describe('ReservationDrawer figures', () => {
  it('is hidden until a day is opened, then shows the day with its ring and four-part breakdown', async () => {
    const m = await mount();
    expect(screen.getByTestId('reservation-drawer')).toHaveAttribute('hidden');
    open(m, '2026-11-18');
    expect(screen.getByTestId('reservation-drawer')).not.toHaveAttribute('hidden');
    expect(panel()).toHaveAttribute('role', 'dialog');
    expect(panel()).toHaveAccessibleName('Rezervace a obsazenost dne 2026-11-18');
    expect(within(panel()).getByRole('heading', { name: 'Středa, 18. 11.' })).toBeInTheDocument();
    expect(panel().querySelector('.rd-ring')).toHaveStyle('--rd-pct: 100%');
    expect(panel().querySelector('.rd-big')).toHaveTextContent('20 / 20 míst');
    expect(panel().querySelector('.rd-hero-copy p')).toHaveTextContent('Naplánovaných 3 h 30 min z referenční kapacity 12 h (29 %).');
    expect(kpi('Klub potvrzen')).toBe('12');
    expect(kpi('Jednotlivci potvrzeni')).toBe('8');
    expect(kpi('Drženo pro klub')).toBe('0');
    expect(kpi('Veřejně volná místa')).toBe('0');
    expect(panel().querySelectorAll('.rd-occupancy-split i')).toHaveLength(4);
    expect(panel().querySelector('.rd-release')).toHaveTextContent('již uvolněné');
    // overview tab: činnost lines and term cards without actions
    expect(panel().querySelectorAll('.rd-mini-grid')).toHaveLength(2);
    expect(panel()).toHaveTextContent('Sportovní prohlídky');
    expect(within(panel()).getAllByTestId('rd-event-card')).toHaveLength(2);
    expect(panel().querySelector('.rd-event-actions')).toBeNull();
  });

  it('names the release date of the club places that are still held', async () => {
    const m = await mount();
    open(m, '2026-11-19');
    expect(kpi('Klub potvrzen')).toBe('16');
    expect(kpi('Drženo pro klub')).toBe('4');
    const release = panel().querySelector('.rd-release small')!;
    expect(release).toHaveTextContent('Neobsazená klubová místa se 7 dní před termínem (12. 11.) zpřístupní také veřejnosti.');
    expect(release.querySelector('b')).toHaveTextContent('12. 11.');
  });

  it('uses the release days of the catalogue', async () => {
    const source = new DemoDataSource({ today: '2026-11-10' });
    const catalogue = source.getCatalogue.bind(source);
    source.getCatalogue = async () => ({ ...(await catalogue()), releaseDaysBefore: 3 });
    const m = await mount({ source });
    open(m, '2026-11-19');
    expect(panel().querySelector('.rd-release small')).toHaveTextContent('3 dní před termínem (16. 11.)');
  });

  it('says so for a day without terms', async () => {
    const m = await mount();
    open(m, '2026-11-25');
    expect(panel().querySelector('.rd-empty')).toHaveTextContent('Pro tento den zatím nejsou vytvořené žádné termíny.');
    expect(panel().querySelector('.rd-big')).toHaveTextContent('0 / 0 míst');
  });

  it('closes with the buttons, the backdrop and Esc, and the focus starts on the close button', async () => {
    const m = await mount();
    open(m, '2026-11-18');
    expect(document.activeElement).toBe(within(panel()).getByRole('button', { name: 'Zavřít' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Zavřít' }));
    expect(m.store.getState().drawer).toBeNull();
    open(m, '2026-11-18');
    fireEvent.click(within(panel()).getByRole('button', { name: /Zpět do plánovače/ }));
    expect(m.store.getState().drawer).toBeNull();
    open(m, '2026-11-18');
    fireEvent.click(document.querySelector('.rd-backdrop')!);
    expect(m.store.getState().drawer).toBeNull();
    open(m, '2026-11-18');
    // Esc is the store's rule (usePlannerKeyboard forwards the key to it)
    act(() => m.store.dispatch(plannerActions.escape()));
    expect(m.store.getState().drawer).toBeNull();
  });
});

describe('ReservationDrawer tabs and the demo simulation', () => {
  it('switches tabs and lists the cards with their actions on "Rezervace"', async () => {
    const m = await mount();
    open(m, '2026-11-19');
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Rezervace' }));
    expect(m.store.getState().drawer?.tab).toBe('bookings');
    expect(within(panel()).getByRole('tab', { name: 'Rezervace' })).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveTextContent('REZERVACE A KAPACITA TERMÍNŮ');
    expect(panel()).toHaveTextContent('2 TERMÍNŮ');
    const cards = within(panel()).getAllByTestId('rd-event-card');
    expect(cards[0]).toHaveTextContent('Pohybová analýza');
    expect(cards[0]).toHaveTextContent('Potvrzeno 6 / 8');
    expect(cards[0]).toHaveTextContent('🔒 2 pro klub');
    expect(cards[0]).toHaveTextContent('KLUBOVÝ TERMÍN');
    expect(cards[0]!.querySelector('.rd-progress i')).toHaveStyle({ width: '75%' });
    expect(within(cards[0]!).getByRole('button', { name: '+ Klub' })).toBeEnabled();
    expect(within(cards[0]!).getByRole('button', { name: '+ Jednotlivec' })).toBeDisabled();
  });

  it('adds a simulated booking and releases the day through the data source', async () => {
    const m = await mount();
    open(m, '2026-11-19', 'bookings');
    fireEvent.click(within(within(panel()).getAllByTestId('rd-event-card')[0]!).getByRole('button', { name: '+ Klub' }));
    await waitFor(() => expect(kpi('Klub potvrzen')).toBe('17'));
    expect(kpi('Drženo pro klub')).toBe('3');
    expect(m.store.getState().toasts.map((t) => t.message)).toContain('Demo: přidána rezervace sportovce klubu');
    fireEvent.click(within(panel()).getByRole('button', { name: /Simulovat uvolnění blokací 7 dní předem/ }));
    await waitFor(() => expect(kpi('Drženo pro klub')).toBe('0'));
    expect(kpi('Veřejně volná místa')).toBe('3');
    expect(panel().querySelector('.rd-release')).toHaveTextContent('již uvolněné');
    expect(within(panel()).queryByRole('button', { name: /Simulovat uvolnění/ })).toBeNull();
  });

  it('shows no simulation, no demo wording and no release button on a real source', async () => {
    const source = new DemoDataSource({ today: '2026-11-10' });
    const catalogue = source.getCatalogue.bind(source);
    source.getCatalogue = async () => ({ ...(await catalogue()), capabilities: { simulateBookings: false, logoUpload: false, realPublish: true } });
    const m = await mount({ source });
    open(m, '2026-11-19', 'bookings');
    expect(within(panel()).queryByRole('button', { name: '+ Klub' })).toBeNull();
    expect(within(panel()).queryByRole('button', { name: /Simulovat/ })).toBeNull();
    expect(panel().querySelector('.rd-demo-tag')).toBeNull();
    expect(panel()).not.toHaveTextContent('DEMO');
    expect(within(panel()).getAllByRole('button', { name: /Detail termínu/ })).toHaveLength(2);
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Přehled dne' }));
    expect(panel()).toHaveTextContent('Otevřít jednotlivé rezervace →');
    expect(panel()).not.toHaveTextContent('simulaci');
  });

  it('opens the detail of a term: a club term as agendaDetail, a public one as eventDetail', async () => {
    const m = await mount();
    open(m, '2026-11-18', 'bookings');
    fireEvent.click(within(panel()).getAllByRole('button', { name: /Detail termínu/ })[0]!);
    expect(m.store.getState().drawer).toBeNull();
    expect(m.store.getState().dialog).toEqual({ kind: 'agendaDetail', id: 'm1' });
    open(m, '2026-11-18', 'bookings');
    fireEvent.click(within(panel()).getAllByRole('button', { name: /Detail termínu/ })[1]!);
    expect(m.store.getState().dialog).toEqual({ kind: 'eventDetail', id: 'v1' });
  });

  it('shows the club profile on the "Klub" tab and opens the club data', async () => {
    const m = await mount();
    open(m, '2026-11-18', 'club');
    expect(panel().querySelectorAll('.rd-profile-item')).toHaveLength(8);
    expect(panel().querySelector('.rd-profile')).toHaveTextContent('KlubRC Mountfield Říčany');
    expect(panel().querySelector('.rd-profile')).toHaveTextContent('IČO—');
    fireEvent.click(within(panel()).getByRole('button', { name: /Upravit \/ doplnit údaje klubu/ }));
    expect(m.store.getState().dialog).toEqual({ kind: 'clubDetails' });
    expect(m.store.getState().drawer).toBeNull();
  });
});

describe('club occupancy overview ("Rozhraní klubu")', () => {
  it('opens from the drawer with the club terms, the totals and the focused day', async () => {
    const m = await mount();
    open(m, '2026-11-18');
    fireEvent.click(within(panel()).getByRole('button', { name: /Rozhraní klubu/ }));
    expect(m.store.getState().drawer).toBeNull();
    expect(m.store.getState().dialog).toEqual({ kind: 'clubOccupancy', focusDate: '2026-11-18' });
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Rezervace klubu' })).toBeInTheDocument();
    const overview = within(dialog).getByTestId('club-occupancy');
    expect(overview.querySelector('.club-app-monogram')).toHaveTextContent('RC');
    expect(overview.querySelector('h3')).toHaveTextContent('RC Mountfield Říčany');
    const numbers = [...overview.querySelectorAll('.club-app-kpis b')].map((b) => b.textContent);
    // club terms: m1 12/12, a1 6/8, m2 10/12, f1 12/12, m3 8/12, x1 0/12 -> 48 of 68; held 2+2+4+12 (7 days rule), 6 terms
    expect(numbers).toEqual(['48', '0', '20', '6']);
    const rows = overview.querySelectorAll('.club-app-row');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveClass('is-focused');
    expect(rows[0]).toHaveTextContent('18. 11.');
    expect(rows[0]).toHaveTextContent('12 / 12');
    expect(rows[1]).not.toHaveClass('is-focused');
    expect(rows[1]).toHaveTextContent('Přednostně pro klub');
    fireEvent.click(rows[2]!);
    expect(m.store.getState().dialog).toEqual({ kind: 'agendaDetail', id: 'm2' });
  });

  it('goes back to the day and on to the club data', async () => {
    const m = await mount();
    act(() => m.store.dispatch(plannerActions.openDialog({ kind: 'clubOccupancy', focusDate: '2026-11-19' })));
    fireEvent.click(await screen.findByRole('button', { name: /Detail dne 19\. 11\./ }));
    expect(m.store.getState().dialog).toBeNull();
    expect(m.store.getState().drawer?.date).toBe('2026-11-19');
    act(() => m.store.dispatch(plannerActions.openDialog({ kind: 'clubOccupancy', focusDate: '2026-11-19' })));
    fireEvent.click(await screen.findByRole('button', { name: /Údaje klubu/ }));
    expect(m.store.getState().dialog).toEqual({ kind: 'clubDetails' });
  });
});
