import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { DemoDataSource } from '../../data/DemoDataSource';
import { buildPlannerContext_forTest } from '../../data/testSupport';
import type { PlannerSession } from '../../model';
import { plannerActions } from '../../state/plannerState';
import { dayRecordsOf } from '../dialogs/reservation/dayRecords';
import { ReservationDrawer } from '../ReservationDrawer';
import { mountPanels } from './testHarness';

const clubBlockGet = vi.hoisted(() => vi.fn());
const clubBlockList = vi.hoisted(() => vi.fn());
vi.mock('../../../api/clubBlocks', () => ({ clubBlocksApi: { get: clubBlockGet, list: clubBlockList } }));
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
  clubBlockList.mockReset();
  clubBlockList.mockResolvedValue([]);
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
const flat = (el: Element | null) => (el?.textContent ?? '').replace(/\s/g, ' ');

const base = { capacity: 0, booked: 0, showInList: true } as const;
const realSessions: PlannerSession[] = [
  {
    ...base, id: 'appt:1', date: '2026-11-18', start: '09:00', end: '09:20', categoryId: 'medical', capacity: 3, booked: 3, origin: 'public', publicBooked: 3,
    appointments: [
      { id: 'a-1', calendarId: 'cal-1', patientName: 'Jana Nováková', status: 0, heads: 1, priceCzk: 1200 },
      { id: 'a-2', calendarId: 'cal-2', patientName: null, status: 0, heads: 2, priceCzk: null },
    ],
  },
  // one club window the calendar draws in two pieces around lunch
  { ...base, id: 'club:b-1:am', date: '2026-11-18', start: '08:00', end: '10:00', categoryId: 'medical', capacity: 6, booked: 3, origin: 'club', clubBooked: 3, foreign: true, clubBlockId: 'b-1', clubOrderId: null, clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#ff8800' },
  { ...base, id: 'club:b-1:pm', date: '2026-11-18', start: '12:30', end: '14:00', categoryId: 'medical', capacity: 4, booked: 1, origin: 'club', clubBooked: 1, foreign: true, clubBlockId: 'b-1', clubOrderId: null, clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#ff8800' },
  { ...base, id: 'club:b-2:am', date: '2026-11-18', start: '15:00', end: '16:00', categoryId: 'vo2', origin: 'club', foreign: true, clubBlockId: 'b-2', clubOrderId: 'order-9', clubId: 'club-2', clubName: 'SK Říčany' },
  // a term of the order being planned: not a record of the real calendar
  { ...base, id: 'own:1', date: '2026-11-18', start: '16:30', end: '17:30', categoryId: 'physio', capacity: 2, origin: 'club', orderId: 'order-draft' },
];

interface RealOptions { sessions?: PlannerSession[]; mode?: 'club' | 'standard'; canBook?: boolean; releaseNever?: boolean }
const realSource = (options: RealOptions = {}) => {
  const mode = options.mode ?? 'standard';
  const source = new DemoDataSource({ today: '2026-11-10', sessions: options.sessions ?? realSessions });
  const catalogue = source.getCatalogue.bind(source);
  source.getCatalogue = async () => ({
    ...(await catalogue()),
    ...(options.releaseNever ? { releaseNever: true, releaseDaysBefore: 0 } : {}),
    capabilities: { simulateBookings: false, logoUpload: false, realPublish: true, mode, ...(options.canBook === undefined ? {} : { canBook: options.canBook }) },
  });
  Object.assign(source, { getCalendars: async () => [{ id: 'cal-1', name: 'Ambulance', color: '#111111', clinicServiceId: null, stepMinutes: 15 }] });
  const order = source.getOrder.bind(source);
  if (mode === 'standard') source.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
  return source;
};

const athlete = (over: Record<string, unknown>) => ({
  id: 'x', name: 'Sportovec', activityName: 'Prohlídka', startUtc: '2026-11-18T08:10:00Z', endUtc: '2026-11-18T08:30:00Z', status: 'Booked', phone: null, ...over,
});

describe('dayRecordsOf (pure)', () => {
  it('reads bookings and club windows from the sessions of the day, a window in pieces being one row', async () => {
    const ctx = await buildPlannerContext_forTest(realSource(), '2026-11-10');
    const records = dayRecordsOf(ctx, '2026-11-18');
    expect(records.map((r) => r.key)).toEqual(['window:b-1', 'appointment:a-1', 'appointment:a-2', 'window:b-2']);
    const [window, first, second, byOrder] = records;
    expect(window).toMatchObject({ title: 'FK Slaný', start: '08:00', end: '14:00', subtitle: '4 / 10 zapsáno', tone: '#ff8800', window: true, origin: 'club' });
    expect(window!.ref).toEqual({ type: 'clubWindow', clubBlockId: 'b-1', clubOrderId: null, clubId: 'club-1' });
    expect(first).toMatchObject({ title: 'Sportovní prohlídky', subtitle: 'Jana Nováková', priceCzk: 1200, origin: 'public', window: false });
    expect(flat({ textContent: first!.priceText } as Element)).toBe('1 200 Kč');
    expect(first!.ref).toEqual({ type: 'appointment', appointmentId: 'a-1', calendarId: 'cal-1' });
    expect(second).toMatchObject({ subtitle: '2 osob', priceText: 'bez ceny', priceCzk: null });
    expect(byOrder!.ref).toEqual({ type: 'clubWindow', clubBlockId: 'b-2', clubOrderId: 'order-9', clubId: 'club-2' });
    expect(byOrder!.subtitle).toBe('0 zapsáno');
    // the term of the order being planned is not a record of the real calendar
    expect(records.some((r) => r.key.includes('own'))).toBe(false);
    expect(dayRecordsOf(ctx, '2026-11-25')).toEqual([]);
  });
});

describe('real records of the day', () => {
  it('lists bookings and club windows by source with their prices on the "Rezervace" tab', async () => {
    clubBlockList.mockResolvedValue([
      {
        id: 'b-1',
        athletes: [
          athlete({ id: 'p1', agreedPriceCzk: 500, listPriceCzk: 300 }),
          athlete({ id: 'p2', agreedPriceCzk: null, listPriceCzk: 300 }),
          athlete({ id: 'p3', status: 'Cancelled', listPriceCzk: 999 }),
          athlete({ id: 'p4', startUtc: '2026-11-19T08:10:00Z', listPriceCzk: 999 }),
        ],
      },
    ]);
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'bookings');
    const groups = await within(panel()).findByTestId('rd-records');
    const ids = [...groups.querySelectorAll('[data-record-group]')].map((g) => g.getAttribute('data-record-group'));
    expect(ids).toEqual(['clubWindows', 'individuals']);
    /* the two bookings of one činnost are ONE fold (reviewer 2.2); the windows are rows of their own */
    const rows = within(groups).getAllByTestId('rd-record');
    expect(rows).toHaveLength(2);
    const fold = within(groups).getByTestId('rd-fold');
    expect(fold).toHaveTextContent('Sportovní prohlídky ×3');
    expect(flat(fold)).toContain('1 200 Kč');
    expect(within(fold).queryByTestId('rd-fold-members')).toBeNull();
    fireEvent.click(within(fold).getByRole('button', { name: /Zobrazit jednotlivé rezervace/ }));
    const members = within(within(fold).getByTestId('rd-fold-members')).getAllByTestId('rd-record');
    expect(rows[0]).toHaveTextContent('FK Slaný');
    expect(rows[0]).toHaveTextContent('08:00–14:00');
    expect(rows[0]).toHaveTextContent('4 / 10 zapsáno');
    // the athletes of the day: 500 agreed + 300 list; a cancelled one and another day's are not counted
    await waitFor(() => expect(flat(rows[0]!)).toContain('800 Kč'));
    expect(rows[1]).toHaveTextContent('SK Říčany');
    expect(rows[1]).toHaveTextContent('bez ceny');
    expect(members[0]).toHaveTextContent('Jana Nováková');
    expect(flat(members[0]!)).toContain('1 200 Kč');
    expect(members[1]).toHaveTextContent('2 osob');
    expect(members[1]).toHaveTextContent('bez ceny');
    expect(members[1]).toHaveAccessibleName(expect.stringContaining('bez ceny'));
    const total = within(groups).getByTestId('rd-day-total');
    expect(total).toHaveTextContent('Celkem dnes:');
    expect(flat(total)).toContain('2 000 Kč');
    expect(clubBlockList).toHaveBeenCalledWith({ from: '2026-11-18', to: '2026-11-18' });
  });

  it('says "bez ceny" for a window whose money could not be read', async () => {
    clubBlockList.mockRejectedValue(new Error('Server neodpovídá.'));
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'bookings');
    const groups = await within(panel()).findByTestId('rd-records');
    await waitFor(() => expect(within(groups).getAllByTestId('rd-record')[0]).toHaveTextContent('bez ceny'));
  });

  it('opens a booking in the appointment detail with its calendar', async () => {
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'bookings');
    const fold = await within(panel()).findByTestId('rd-fold');
    fireEvent.click(within(fold).getByRole('button', { name: /Zobrazit jednotlivé rezervace/ }));
    const rows = await within(panel()).findAllByTestId('rd-record');
    fireEvent.click(rows.find((r) => r.getAttribute('data-record') === 'appointment:a-1')!);
    const detail = await screen.findByTestId('appointment-detail');
    expect(detail).toHaveAttribute('data-id', 'a-1');
    expect(detail).toHaveAttribute('data-calendar', 'cal-1');
    await waitFor(() => expect(detail).toHaveAttribute('data-calendar-name', 'Ambulance'));
    // a change inside the detail makes the planner re-read
    const reads = vi.spyOn(m.source, 'listSessions');
    fireEvent.click(within(detail).getByText('changed'));
    await waitFor(() => expect(reads).toHaveBeenCalled());
    fireEvent.click(within(detail).getByText('close-detail'));
    expect(screen.queryByTestId('appointment-detail')).toBeNull();
    expect(m.store.getState().drawer).not.toBeNull();
  });

  it('opens a club window that has an order straight in the order', async () => {
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'bookings');
    const window = (await within(panel()).findAllByTestId('rd-record')).find((r) => r.getAttribute('data-record') === 'window:b-2')!;
    fireEvent.click(window);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveAttribute('data-path', '/clubs/objednavky'));
    expect(JSON.parse(screen.getByTestId('location').getAttribute('data-state')!)).toEqual({ openOrderId: 'order-9' });
    expect(clubBlockGet).not.toHaveBeenCalled();
    expect(m.store.getState().drawer).toBeNull();
  });

  it('asks the block for its order, and falls back to the club block on /clubs for a window without one', async () => {
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'bookings');
    const window = (await within(panel()).findAllByTestId('rd-record')).find((r) => r.getAttribute('data-record') === 'window:b-1')!;
    clubBlockGet.mockResolvedValueOnce({ clubOrderId: 'order-77' });
    fireEvent.click(window);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveAttribute('data-path', '/clubs/objednavky'));
    expect(JSON.parse(screen.getByTestId('location').getAttribute('data-state')!)).toEqual({ openOrderId: 'order-77' });
    expect(clubBlockGet).toHaveBeenCalledWith('b-1');

    open(m, '2026-11-18', 'bookings');
    clubBlockGet.mockResolvedValueOnce({ clubOrderId: null });
    fireEvent.click((await within(panel()).findAllByTestId('rd-record')).find((r) => r.getAttribute('data-record') === 'window:b-1')!);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveAttribute('data-path', '/clubs'));
    expect(JSON.parse(screen.getByTestId('location').getAttribute('data-state')!)).toEqual({ clubBlockId: 'b-1', clubId: 'club-1' });
  });

  it('opens a new booking for the shown day', async () => {
    const m = await mount({ source: realSource() });
    open(m, '2026-11-25', 'bookings');
    expect(await within(panel()).findByText('V tento den zatím nejsou žádné rezervace ani klubová okna.')).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('button', { name: /Nová rezervace na tento den/ }));
    const dialog = await screen.findByTestId('new-booking');
    expect(dialog).toHaveAttribute('data-date', '2026-11-25');
    fireEvent.click(within(dialog).getByText('close-booking'));
    expect(screen.queryByTestId('new-booking')).toBeNull();
  });

  it('offers no new booking to a user who may not book', async () => {
    const m = await mount({ source: realSource({ canBook: false }) });
    open(m, '2026-11-25', 'bookings');
    expect(await within(panel()).findByText('V tento den zatím nejsou žádné rezervace ani klubová okna.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /Nová rezervace/ })).toBeNull();
  });

  it('names the club windows of the day on the "Klub" tab in standard booking', async () => {
    const m = await mount({ source: realSource() });
    open(m, '2026-11-18', 'club');
    const groups = await within(panel()).findByTestId('rd-records');
    expect(groups.querySelectorAll('[data-record-group]')).toHaveLength(1);
    expect(within(groups).getAllByTestId('rd-record')).toHaveLength(2);
    expect(panel().querySelector('.rd-profile')).toBeNull();
    open(m, '2026-11-25', 'club');
    expect(await within(panel()).findByText('V tento den nemá žádný klub rezervované okno.')).toBeInTheDocument();
  });

  it('shows the club profile while planning an order, with the footer button to the club interface', async () => {
    const m = await mount({ source: realSource({ mode: 'club' }) });
    open(m, '2026-11-18', 'club');
    expect(panel().querySelector('.rd-profile')).not.toBeNull();
    expect(within(panel()).getByRole('button', { name: /Rozhraní klubu/ })).toBeInTheDocument();
  });

  it('says the club places are not released automatically when the clinic never releases them', async () => {
    const m = await mount({ source: realSource({ releaseNever: true }) });
    open(m, '2026-11-18');
    expect(panel().querySelector('.rd-release small')).toHaveTextContent('se automaticky neuvolňují');
    expect(panel().querySelector('.rd-release small')).not.toHaveTextContent('dní před termínem');
  });

  it('has no record rows and no new-booking button on a source without records (the demo)', async () => {
    const m = await mount();
    open(m, '2026-11-18', 'bookings');
    expect(within(panel()).queryByTestId('rd-records')).toBeNull();
    expect(within(panel()).queryByRole('button', { name: /Nová rezervace/ })).toBeNull();
  });
});
