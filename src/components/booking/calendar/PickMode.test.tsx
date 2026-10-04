import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import CalendarGridPage from '../../../pages/booking/CalendarGridPage';
import type { Calendar, PreviewDay } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';

/*
 * "Výběr termínů": a phone order picked straight in the calendar, at 390 / 834 / 1440 - the two-way chooser, the small
 * setup form, painting that stops the moment everybody is covered, the live calculator, the 409 that names a range
 * and "Potvrdit objednávku".
 */

const { createStaff, proposal, getAllClubs, listActivities, calculate } = vi.hoisted(() => ({
  createStaff: vi.fn(), proposal: vi.fn(), getAllClubs: vi.fn(), listActivities: vi.fn(), calculate: vi.fn(),
}));

vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/holidays', () => ({ holidaysApi: { year: vi.fn() } }));
vi.mock('../../../api/clinicSettings', () => ({ readPublicClinic: vi.fn(), readSettings: vi.fn() }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range: vi.fn(), blocks: vi.fn() } }));
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: listActivities, clubBlocksApi: { ...actual.clubBlocksApi, calculate } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, createStaff, proposal } };
});
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({ NewAppointmentDialog: () => null }));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, defaultView: 'week' }, loaded: true })) };
});

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { holidaysApi } from '../../../api/holidays';
import { readPublicClinic, readSettings } from '../../../api/clinicSettings';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { activitiesApi } from '../../../api/activities';
import { ClubOrderError, toOrder } from '../../../api/clubOrders';

const base = {
  location: '', displayStepMinutes: 30, isActive: true, publicMinimumNoticeMinutes: null, publicHorizonDays: null,
  publicHoldMinutes: null, publicCancellationHours: null,
};
const diagnostika: Calendar = { ...base, id: 'c1', name: 'Sportovní diagnostika', color: '#1565C0', sortOrder: 0, clinicServiceId: 's1' };
const prohlidka: Calendar = { ...base, id: 'c2', name: 'Sportovní prohlídka', color: '#2E7D32', sortOrder: 1, clinicServiceId: 's2' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T08:15:00Z')); // Wednesday 10:15 in Prague
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));

  vi.mocked(calendarsApi.list).mockResolvedValue([diagnostika, prohlidka]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null },
    { id: 's2', name: 'Lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: null },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(holidaysApi.year).mockResolvedValue([]);
  vi.mocked(readPublicClinic).mockResolvedValue({ name: '', email: '', phone: '', address: '', bookingEnabled: true });
  vi.mocked(readSettings).mockResolvedValue({});
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_calendarId, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({
        date: d, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: null, breakEnd: null,
        workerUserId: 'u1', workerDisplayName: 'Anna Černá', isChangedByOverride: false, offeredActivityIds: ['a1'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockResolvedValue([]);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);

  getAllClubs.mockReset().mockResolvedValue([{ id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' }]);
  listActivities.mockReset().mockResolvedValue([
    { id: 'a1', name: 'Základní prohlídka', durationMinutes: 30, clinicServiceId: 's1', colorHex: '#1565C0', parallelCapacity: 1 },
  ]);
  calculate.mockReset().mockResolvedValue({ minutesPerPlayer: 30, parallelCapacity: 1, neededMinutes: 300, dailyOpenMinutes: 480, suggestedDays: 1, suggestedFrom: null, suggestedTo: null, perDay: [], analysis: null });
  createStaff.mockReset();
  proposal.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

function renderPage(width: number) {
  setViewport(width);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/planovani']}>
        <Routes>
          <Route path="/planovani" element={<CalendarGridPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* The week 21.-27. 9. 2026 at zoom 1: working hours 08-16 draw 07:00-17:00, 52 px an hour. */
const PX = 52 / 60;
const TOP = 7 * 60;
const yAt = (minute: number) => (minute - TOP) * PX + 1;
const DAY = '2026-09-24';
const column = (day = DAY) => screen.getByTestId('sub-column-c1-' + day);

function paint(from: number, to: number, day = DAY) {
  const col = column(day);
  const init = { button: 0, clientX: 100, pointerId: 1 };
  fireEvent.pointerDown(col, { ...init, clientY: yAt(from) });
  fireEvent.pointerMove(col, { ...init, clientY: yAt(to) });
  fireEvent.pointerUp(col, { ...init, clientY: yAt(to) });
}

const rows = () => screen.queryAllByTestId('pick-row').map((r) => r.textContent ?? '');

/** "Klubová objednávka" -> "Vyplním sám" -> the small form (10 players of one činnost = 300 min) -> picking. */
async function startPicking(players = '10') {
  const user = userEvent.setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Klubová objednávka' }));
  const entry = await screen.findByTestId('club-order-entry');
  expect(within(entry).getAllByRole('button')).toHaveLength(2);
  await user.click(within(entry).getByTestId('entry-phone'));
  const setup = await screen.findByTestId('pick-setup');
  await user.click(within(setup).getByLabelText('Klub'));
  await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
  await user.click(within(setup).getByLabelText('Služba'));
  await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
  await user.click(await within(setup).findByRole('checkbox', { name: /Základní prohlídka/ }));
  await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, Základní prohlídka' }), players);
  await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
  await screen.findByTestId('pick-panel');
  await screen.findByTestId('sub-column-c1-' + DAY);
  return user;
}

describe('desktop · 1440', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('the panel sits beside the grid and calculates the need before anything is picked', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'side');
    expect(within(panel).getByText('Potřeba: 10 hráčů')).toBeInTheDocument();
    expect(within(panel).getByTestId('pick-activity')).toHaveTextContent('Základní prohlídka: 10 × 30 min = 300 min');
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent(/Potřeba celkem300\smin/);
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent(/Zbývá vybrat300\smin/);
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent('Nepokryto10 hráčů');
    expect(within(panel).getByTestId('pick-progress')).toHaveAttribute('aria-valuenow', '0');
    /* Only the služba's calendar is in the grid. */
    expect(screen.queryByTestId('sub-column-c2-' + DAY)).not.toBeInTheDocument();
  });

  it('every painted range adds its minutes at once, and painting stops when all players are covered', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    const panel = screen.getByTestId('pick-panel');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/09:00–10:30 · 90 min/);
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent(/Vybráno90\smin/);
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent(/Zbývá vybrat210\smin/);
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent('Nepokryto7 hráčů');

    /* 11:00-16:30 would be 330 min; only 210 are missing, so the range is cut at 14:30. */
    paint(11 * 60, 16 * 60);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[1]).toMatch(/11:00–14:30 · 210 min/);
    expect(within(panel).getByTestId('pick-covered')).toHaveTextContent('Pokryto');
    expect(within(panel).getByTestId('pick-progress')).toHaveAttribute('aria-valuenow', '100');
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent('Nepokryto0 hráčů');

    /* Nothing more is allowed ... */
    paint(15 * 60, 15 * 60);
    expect(rows()).toHaveLength(2);
    expect(within(panel).getByTestId('pick-note')).toHaveTextContent(/pokryti/);

    /* ... until the reserve is switched on. */
    fireEvent.click(within(panel).getByRole('switch', { name: 'Přidat rezervu' }));
    paint(15 * 60, 15 * 60);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(within(panel).getByTestId('pick-covered')).toHaveTextContent(/Rezerva 30\smin/);
  });

  it('a range removed with its cross gives its minutes back', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(screen.getByTestId('pick-panel')).getByRole('button', { name: /Odebrat termín/ }));
    expect(rows()).toHaveLength(0);
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-metrics')).toHaveTextContent(/Zbývá vybrat300\smin/);
  });

  it('a picked range is stretched by its edge, moved by its body, and the calculator follows', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60); // 09:00-10:30
    await waitFor(() => expect(rows()).toHaveLength(1));
    const bar = screen.getByTestId('picked-range');
    const edge = within(bar).getByTestId('pick-handle-end');
    const init = { button: 0, pointerId: 2, clientX: 100 };
    fireEvent.pointerDown(edge, { ...init, clientY: 200 });
    fireEvent.pointerMove(edge, { ...init, clientY: 200 + 52 }); // one hour down
    fireEvent.pointerUp(edge, { ...init, clientY: 200 + 52 });
    await waitFor(() => expect(rows()[0]).toMatch(/09:00–11:30 · 150 min/));
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-metrics')).toHaveTextContent(/Zbývá vybrat150\smin/);

    fireEvent.pointerDown(bar, { ...init, clientY: 300 });
    fireEvent.pointerMove(bar, { ...init, clientY: 300 + 26 }); // half an hour down
    fireEvent.pointerUp(bar, { ...init, clientY: 300 + 26 });
    await waitFor(() => expect(rows()[0]).toMatch(/09:30–12:00 · 150 min/));

    /* Stretching never goes past what is still needed: 150 min are missing, 300 is the most the range can be. */
    const edge2 = within(screen.getByTestId('picked-range')).getByTestId('pick-handle-end');
    fireEvent.pointerDown(edge2, { ...init, clientY: 400 });
    fireEvent.pointerMove(edge2, { ...init, clientY: 400 + 52 * 5 });
    fireEvent.pointerUp(edge2, { ...init, clientY: 400 + 52 * 5 });
    await waitFor(() => expect(rows()[0]).toMatch(/09:30–14:30 · 300 min/));
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-covered')).toBeInTheDocument();
  });

  it('keeps the picks when the week changes', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.keyDown(screen.getByTestId('pick-panel'), { key: 'PageDown' });
    fireEvent.click(screen.getAllByRole('button', { name: /Další/ })[0]);
    expect(rows()).toHaveLength(1);
  });

  it('"Potvrdit objednávku" creates the Confirmed order with the picked ranges and calendars', async () => {
    createStaff.mockResolvedValue(toOrder({
      id: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', status: 'Confirmed', paymentMethod: 'ClubInvoice',
      activitySeats: [{ activityId: 'a1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: null }],
      totalSeats: 10, registrationToken: 'rt', registrationUrl: 'https://app.test/klub/rt',
    }));
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    paint(11 * 60, 16 * 60);
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff).toHaveBeenCalledWith({
      clubId: 'club-1',
      serviceId: 's1',
      activitySeats: [{ activityId: 'a1', seats: 10 }],
      paymentMethod: 'ClubInvoice',
      ranges: [
        { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '10:30' },
        { fromDate: DAY, toDate: DAY, dailyFrom: '11:00', dailyTo: '14:30' },
      ],
      calendarIds: ['c1'],
      status: 'Confirmed',
    });
    expect(await screen.findByTestId('order-success')).toBeInTheDocument();
    expect(screen.queryByTestId('pick-panel')).not.toBeInTheDocument();
  });

  it('a 409 names the colliding range, keeps every pick and lets the user remove it', async () => {
    createStaff.mockRejectedValue(new ClubOrderError('Termín 24. 9. 2026 je obsazený jiným klubem.', 409));
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    paint(11 * 60, 16 * 60);
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednávku' }));
    const failure = await screen.findByTestId('pick-failure');
    expect(failure).toHaveTextContent('Termín 24. 9. 2026 je obsazený jiným klubem.');
    expect(failure).toHaveTextContent(/Kolize: 24\. 9\. 2026, 09:00–10:30/);
    expect(rows()).toHaveLength(2);
    expect(screen.getByTestId('pick-panel')).toBeInTheDocument();
  });

  it('"Navrhnout automaticky od…" starts exactly at the first picked time and lays the picks out', async () => {
    proposal.mockResolvedValue({ ranges: [{ fromDate: DAY, toDate: '2026-09-25', dailyFrom: '09:30', dailyTo: '12:00' }], analysis: null });
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    expect(within(panel).getByRole('button', { name: 'Navrhnout automaticky od…' })).toBeDisabled();
    paint(9 * 60 + 30, 9 * 60 + 30);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(panel).getByRole('button', { name: 'Út' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'St' }));
    fireEvent.click(within(panel).getByRole('button', { name: /Navrhnout automaticky od/ }));
    await waitFor(() => expect(proposal).toHaveBeenCalledTimes(1));
    expect(proposal).toHaveBeenCalledWith({
      serviceId: 's1',
      activitySeats: [{ activityId: 'a1', seats: 10 }],
      calendarIds: ['c1'],
      startDate: DAY,
      startTime: '09:30',
      daysOfWeek: [2, 3],
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[0]).toMatch(/09:30–12:00 · 150 min/);
    /* The proposal can be taken back. */
    fireEvent.click(within(panel).getByRole('button', { name: /Vrátit můj výběr/ }));
    expect(rows()).toHaveLength(1);
  });
});

describe('tablet · 834', () => {
  it('the panel is a bar at the bottom that opens to the details', async () => {
    renderPage(VIEWPORTS.tablet);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'bottom-bar');
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent(/Zbývá 300\smin · 10 hráčů/);
    expect(within(panel).queryByTestId('pick-metrics')).not.toBeInTheDocument();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-summary')).toHaveTextContent(/Zbývá 210\smin · 7 hráčů/));
    fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    expect(within(panel).getByTestId('pick-metrics')).toHaveTextContent(/Vybráno90\smin/);
    expect(within(panel).getByRole('button', { name: 'Potvrdit objednávku' })).toBeEnabled();
  });
});

describe('phone · 390', () => {
  it('shows the grid (not the list) while picking, with the calculator as a bottom bar', async () => {
    renderPage(VIEWPORTS.phone);
    await startPicking();
    expect(screen.queryByTestId('phone-calendar')).not.toBeInTheDocument();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'bottom-bar');
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent(/Zbývá 300\smin · 10 hráčů/);
    expect(within(panel).getByTestId('pick-progress')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Zrušit' }));
    expect(screen.queryByTestId('pick-panel')).not.toBeInTheDocument();
    expect(await screen.findByTestId('phone-calendar')).toBeInTheDocument();
  });
});


describe('addendum to an existing order (Etapa 5)', () => {
  it('opens the setup locked to the parent and confirms through createStaff with parentOrderId', async () => {
    createStaff.mockResolvedValue(toOrder({
      id: 'o-2', parentOrderId: 'root-1', groupId: 'root-1', clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika',
      status: 'Confirmed', paymentMethod: 'ClubInvoice', activitySeats: [], totalSeats: 10, registrationUrl: 'https://app.test/klub/rt',
    }));
    setViewport(VIEWPORTS.desktop);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter
          initialEntries={[{
            pathname: '/planovani',
            state: { pickOrder: { clubId: 'club-1', parent: { orderId: 'root-1', clubId: 'club-1', clubName: 'FK Slaný', paymentMethod: 'ClubInvoice' } } },
          }]}
        >
          <Routes>
            <Route path="/planovani" element={<CalendarGridPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const setup = await screen.findByTestId('pick-setup');
    expect(within(setup).getByTestId('pick-setup-parent')).toHaveTextContent('Dodatek k objednávce KO-ROOT1');
    expect(within(setup).getByLabelText('Klub')).toBeDisabled();
    await user.click(within(setup).getByLabelText('Služba'));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, Základní prohlídka' }), '10');
    await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
    await screen.findByTestId('pick-panel');
    await screen.findByTestId('sub-column-c1-' + DAY);
    paint(9 * 60, 16 * 60);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff.mock.calls[0][0]).toMatchObject({ clubId: 'club-1', serviceId: 's1', paymentMethod: 'ClubInvoice', parentOrderId: 'root-1', status: 'Confirmed' });
  });
});
