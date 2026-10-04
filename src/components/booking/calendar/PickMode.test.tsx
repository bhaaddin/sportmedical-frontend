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

const { createStaff, update, confirmOrder, getAllClubs, listActivities, calculate } = vi.hoisted(() => ({
  createStaff: vi.fn(), update: vi.fn(), confirmOrder: vi.fn(), getAllClubs: vi.fn(), listActivities: vi.fn(), calculate: vi.fn(),
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
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, createStaff, update, confirm: confirmOrder } };
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
  update.mockReset();
  confirmOrder.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

/* Touch layouts (phone, tablet) draw the pick grid taller - a 30-minute slot is at least 44 px - and a phone opens on the day. */
let PX = 52 / 60;
let firstDay = '2026-09-24';
function renderPage(width: number) {
  setViewport(width);
  PX = width < 1024 ? 44 / 30 : 52 / 60;
  firstDay = width < 600 ? '2026-09-23' : '2026-09-24';
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
  await screen.findByTestId('sub-column-c1-' + firstDay);
  return user;
}

describe('desktop · 1440', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('the panel sits beside the grid and calculates the need before anything is picked', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'side');
    /* The one thing the desk watches: how many slots are still missing, per činnost and in total. */
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 10 slotů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 10 × Základní prohlídka (30 min)');
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 0\smin z 300\smin/);
    expect(within(panel).getByTestId('pick-activity')).toHaveTextContent(/Základní prohlídka \(30 min\) · 10 hráčů.*zbývá 10 slotů/);
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
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 90\smin z 300\smin/);
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 7 slotů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 7 × Základní prohlídka (30 min)');

    /* 11:00-16:30 would be 330 min; only 210 are missing, so the range is cut at 14:30. */
    paint(11 * 60, 16 * 60);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[1]).toMatch(/11:00–14:30 · 210 min/);
    expect(within(panel).getByTestId('pick-covered')).toHaveTextContent('Hotovo — všechny sloty pokryty');
    expect(within(panel).getByTestId('pick-progress')).toHaveAttribute('aria-valuenow', '100');
    expect(within(panel).queryByTestId('pick-slots')).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Potvrdit objednávku' })).toBeEnabled();

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
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-slots')).toHaveTextContent('Zbývá 10 slotů');
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
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-slots')).toHaveTextContent('Zbývá 5 slotů');

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

  it('is MANUAL only: no automatic suggestion, weekday chips or "Navrhnout" in the panel', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    paint(9 * 60 + 30, 9 * 60 + 30);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(panel).queryByText(/Navrhnout/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/automaticky/i)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Út' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Po' })).not.toBeInTheDocument();
  });
});

describe('tablet · 834', () => {
  it('the panel is a bar at the bottom that opens to the details', async () => {
    renderPage(VIEWPORTS.tablet);
    await startPicking();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'bottom-bar');
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Zbývá 10 slotů');
    expect(within(panel).queryByTestId('pick-list')).not.toBeInTheDocument();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Zbývá 7 slotů'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 90\smin z 300\smin/);
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
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Zbývá 10 slotů');
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

/* ── Etapa 7 · X4: picking wherever the person wants - month, tap, first bookable day ── */

const touch = { button: 0, pointerType: 'touch', pointerId: 7, clientX: 100 };
const tap = (minute: number, day = firstDay) => {
  const col = column(day);
  fireEvent.pointerDown(col, { ...touch, clientY: yAt(minute) });
  fireEvent.pointerUp(col, { ...touch, clientY: yAt(minute) });
};
const summary = () => within(screen.getByTestId('pick-panel')).getByTestId('pick-summary');
const progress = () => within(screen.getByTestId('pick-panel')).getByTestId('pick-progress');
const monthDay = (day: string) => screen.getByTestId('pick-month-day-' + day);
const goMonth = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Měsíc' }));
  return screen.findByTestId('pick-month');
};

describe.each([
  ['phone · 390', VIEWPORTS.phone],
  ['tablet · 834', VIEWPORTS.tablet],
  ['desktop · 1440', VIEWPORTS.desktop],
])('month pick · %s', (_name, width) => {
  it('the Měsíc toggle is enabled while picking and each day shows its free time', async () => {
    renderPage(width);
    await startPicking();
    const toggle = screen.getByRole('button', { name: 'Měsíc' });
    expect(toggle).toBeEnabled();
    await goMonth(userEvent.setup());
    expect(monthDay('2026-09-25')).toHaveAttribute('data-free', '480');
    expect(monthDay('2026-09-25')).toHaveTextContent('8 h');
    /* A past day is greyed; today has only what is left of it (10:30-16:00). */
    expect(monthDay('2026-09-20')).toHaveAttribute('data-shut', 'true');
    expect(monthDay('2026-09-23')).toHaveAttribute('data-free', '330');
  });

  it('"Celý den" picks the free working time of the day, cut at the need; tapping the day again removes it', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-whole'));
    /* 10 players x 30 min = 300 min, the day has 480. */
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('5:00 h'));
    expect(progress()).toHaveAttribute('aria-valuenow', '100');
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-remove'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).queryByTestId('pick-month-chip')).not.toBeInTheDocument());
    expect(progress()).toHaveAttribute('aria-valuenow', '0');
  });

  it('"Vybrat čas…" opens the day, and the pick of the month survives the trip', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-24'));
    await user.click(await screen.findByTestId('pick-month-whole'));
    await waitFor(() => expect(within(monthDay('2026-09-24')).getByTestId('pick-month-chip')).toBeInTheDocument());
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-time'));
    await screen.findByTestId('sub-column-c1-2026-09-25');
    expect(screen.queryByTestId('pick-month')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Měsíc' }));
    expect(within(await screen.findByTestId('pick-month-day-2026-09-24')).getByTestId('pick-month-chip')).toBeInTheDocument();
  });

  it('the past message appears only when a past day is tried, and goes on navigation', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    expect(screen.queryByText('Termín v minulosti nelze objednat.')).not.toBeInTheDocument();
    await user.click(monthDay('2026-09-21'));
    expect((await screen.findAllByText('Termín v minulosti nelze objednat.')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Další' }));
    await waitFor(() => expect(screen.queryByText('Termín v minulosti nelze objednat.')).not.toBeInTheDocument());
  });
});

describe('month pick · several days in a row', () => {
  it('"Klepnutí = celý den" picks a day per tap until everybody is covered', async () => {
    renderPage(VIEWPORTS.phone);
    const user = await startPicking('28'); // 28 x 30 = 840 min
    await goMonth(user);
    await user.click(screen.getByRole('switch', { name: 'Klepnutí = celý den' }));
    await user.click(monthDay('2026-09-24'));
    await user.click(monthDay('2026-09-25'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('6:00 h'));
    expect(within(monthDay('2026-09-24')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h');
    expect(summary()).toHaveTextContent(/Hotovo/);
  });
});

describe('tap to pick on touch', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet]])('%s: tap the start, then the end', async (_n, width) => {
    renderPage(width);
    await startPicking();
    expect(screen.getByTestId('pick-hint')).toHaveTextContent('Klepněte na začátek, potom na konec');
    tap(11 * 60);
    await screen.findByTestId('tap-anchor');
    expect(screen.getByTestId('tap-anchor')).toHaveTextContent('Začátek 11:00');
    tap(12 * 60);
    await waitFor(() => expect(screen.getAllByTestId('picked-range')).toHaveLength(1));
    expect(screen.queryByTestId('tap-anchor')).not.toBeInTheDocument();
    expect(screen.getByTestId('picked-range')).toHaveTextContent('11:00 – 12:30');
    expect(summary()).toHaveTextContent('Zbývá 7 slotů');
  });

  it('a slot that is already gone today is refused with the past note, not picked', async () => {
    renderPage(VIEWPORTS.phone);
    await startPicking();
    tap(9 * 60); // now is 10:15
    expect(screen.queryByTestId('tap-anchor')).not.toBeInTheDocument();
    expect(summary().textContent).toMatch(/Zbývá 10 slotů/);
    expect((await screen.findAllByText('Termín v minulosti nelze objednat.')).length).toBeGreaterThan(0);
  });

  it('the mouse keeps drag-to-paint and its own hint', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    expect(screen.getByTestId('pick-hint')).toHaveTextContent('tažením myší');
    expect(screen.getByTestId('pick-hint')).not.toHaveTextContent('Klepněte');
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
  });
});

describe('phone · day view of free blocks', () => {
  it('opens on the day (not a week of two columns) with the free block as one big button', async () => {
    renderPage(VIEWPORTS.phone);
    const user = await startPicking();
    expect(screen.getByRole('button', { name: 'Den' })).toHaveAttribute('aria-pressed', 'true');
    const blocks = screen.getAllByTestId('free-block');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveTextContent('10:30–16:00');
    expect(blocks[0]).toHaveTextContent('volno 5 h 30 min');
    await user.click(blocks[0]);
    /* The whole block is more than the 300 minutes needed: cut at the need, 10:30-15:30. */
    await waitFor(() => expect(screen.getAllByTestId('picked-range')).toHaveLength(1));
    expect(screen.getByTestId('picked-range')).toHaveTextContent('10:30 – 15:30');
    expect(summary()).toHaveTextContent(/Hotovo/);
  });

  it('a day with nothing left says so and offers the next day', async () => {
    renderPage(VIEWPORTS.phone);
    const user = await startPicking('28'); // more than the day holds
    await user.click(screen.getAllByTestId('free-block')[0]);
    await waitFor(() => expect(screen.queryByTestId('free-block')).not.toBeInTheDocument());
    expect(screen.getByTestId('free-blocks')).toHaveTextContent('V tento den už není volný čas.');
    await user.click(screen.getByTestId('free-blocks-next'));
    await screen.findByTestId('sub-column-c1-2026-09-24');
  });
});

describe('the first bookable day', () => {
  it.each([['phone', VIEWPORTS.phone], ['desktop', VIEWPORTS.desktop]])('%s: a weekend start jumps to Monday', async (_n, width) => {
    vi.setSystemTime(new Date('2026-09-26T08:15:00Z')); // Saturday
    vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
      const out: PreviewDay[] = [];
      for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
        const weekend = d === '2026-09-26' || d === '2026-09-27';
        out.push({
          date: d, isOpen: !weekend, closedBecause: weekend ? 'weekend' : null, startTime: weekend ? null : '08:00:00', endTime: weekend ? null : '16:00:00',
          breakStart: null, breakEnd: null, workerUserId: 'u1', workerDisplayName: 'Anna Černá', isChangedByOverride: false, offeredActivityIds: ['a1'],
        } as PreviewDay);
      }
      return out;
    });
    renderPage(width);
    firstDay = '2026-09-28';
    await startPicking();
    await waitFor(() => expect(screen.getByTestId('sub-column-c1-2026-09-28')).toBeInTheDocument());
    expect(screen.queryByTestId('sub-column-c1-2026-09-26')).not.toBeInTheDocument();
    expect(screen.queryByText('Termín v minulosti nelze objednat.')).not.toBeInTheDocument();
  });
});

describe('two activities: the slots fall in the order the činnosti are listed', () => {
  it('12 + 10 players: "Zbývá 22 slotů", then fewer as time is painted, then "Hotovo"', async () => {
    listActivities.mockResolvedValue([
      { id: 'a1', name: 'Základní', durationMinutes: 30, clinicServiceId: 's1', colorHex: '#1565C0', parallelCapacity: 1 },
      { id: 'a2', name: 'Komplexní', durationMinutes: 60, clinicServiceId: 's1', colorHex: '#8A3FFC', parallelCapacity: 1 },
    ]);
    renderPage(VIEWPORTS.desktop);
    const user = userEvent.setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Klubová objednávka' }));
    await user.click(within(await screen.findByTestId('club-order-entry')).getByTestId('entry-phone'));
    const setup = await screen.findByTestId('pick-setup');
    await user.click(within(setup).getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
    await user.click(within(setup).getByLabelText('Služba'));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Základní/ }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Komplexní/ }));
    await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, Základní' }), '12');
    await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, Komplexní' }), '10');
    await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
    const panel = await screen.findByTestId('pick-panel');
    await screen.findByTestId('sub-column-c1-' + DAY);
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 22 slotů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 12 × Základní (30 min) · 10 × Komplexní (60 min)');
    /* 08:00-10:30 = 150 min ... */
    paint(8 * 60, 10 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 17 slotů'));
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 7 × Základní (30 min) · 10 × Komplexní (60 min)');
    /* 960 min are needed; the rest is painted over two more days. */
    paint(8 * 60, 15 * 60 + 30, '2026-09-25');
    paint(8 * 60, 15 * 60 + 30, '2026-09-26');
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toHaveTextContent('Hotovo — všechny sloty pokryty'));
    expect(within(panel).getByRole('button', { name: 'Potvrdit objednávku' })).toBeEnabled();
  });
});

describe('marked places and editing an existing order', () => {
  it('places marked before the order was set up become its first picks', async () => {
    renderPage(VIEWPORTS.desktop);
    const user = userEvent.setup();
    const col = await screen.findByTestId('sub-column-c1-' + DAY);
    const init = { button: 0, clientX: 100, pointerId: 1, ctrlKey: true };
    fireEvent.pointerDown(col, { ...init, clientY: yAt(11 * 60) });
    fireEvent.pointerMove(col, { ...init, clientY: yAt(11 * 60 + 30) });
    fireEvent.pointerUp(col, { ...init, clientY: yAt(11 * 60 + 30) });
    fireEvent.click(await screen.findByRole('button', { name: 'Rezervovat pro klub' }));
    const setup = await screen.findByTestId('pick-setup');
    await user.click(within(setup).getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
    await user.click(within(setup).getByLabelText('Služba'));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, Základní prohlídka' }), '10');
    await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
    await screen.findByTestId('pick-panel');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/11:00–12:00 · 60 min/);
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-slots')).toHaveTextContent('Zbývá 8 slotů');
  });

  const editSession = {
    clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika',
    activities: [{ activityId: 'a1', name: 'Základní prohlídka', seats: 10, minutesPerSeat: 30, parallelCapacity: 1 }],
    paymentMethod: 'ClubInvoice', note: 'Pozn.',
    editOrder: {
      mode: 'edit', orderId: 'o-9', dirty: false, requested: [], firstDate: DAY,
      blocks: [{ id: 'b-1', calendarId: 'c1', range: { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00' } }],
    },
  };
  const renderWith = (session: unknown) => {
    setViewport(VIEWPORTS.desktop);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: '/planovani', state: { pickOrder: { start: session } } }]}>
          <Routes>
            <Route path="/planovani" element={<CalendarGridPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('editing: the order windows are the first picks and "Uložit změny" updates the order', async () => {
    update.mockResolvedValue(toOrder({ id: 'o-9', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    renderWith(editSession);
    const panel = await screen.findByTestId('pick-panel');
    await screen.findByTestId('sub-column-c1-' + DAY);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/09:00–12:00 · 180 min/);
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 4 sloty');
    expect(screen.queryByRole('button', { name: 'Potvrdit objednávku' })).not.toBeInTheDocument();
    paint(13 * 60, 14 * 60 + 30);
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toBeInTheDocument());
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe('o-9');
    expect(update.mock.calls[0][1]).toMatchObject({
      activitySeats: [{ activityId: 'a1', seats: 10 }], paymentMethod: 'ClubInvoice', calendarIds: ['c1'], note: 'Pozn.',
      ranges: [{ fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00' }, { fromDate: DAY, toDate: DAY, dailyFrom: '13:00', dailyTo: '15:00' }],
    });
    expect(update.mock.calls[0][2]).toBe(false);
    expect(await screen.findByText('Termíny uloženy')).toBeInTheDocument();
  });

  it('processing a request: the ranges the club asked for are only a hint, and confirm goes through confirm()', async () => {
    confirmOrder.mockResolvedValue(toOrder({ id: 'o-9', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    renderWith({ ...editSession, editOrder: { mode: 'process', orderId: 'o-9', dirty: true, requested: ['24. 9. 2026, 09:00–12:00'], blocks: [], firstDate: DAY } });
    const panel = await screen.findByTestId('pick-panel');
    await screen.findByTestId('sub-column-c1-' + DAY);
    expect(rows()).toHaveLength(0);
    expect(within(panel).getByTestId('pick-requested')).toHaveTextContent('24. 9. 2026, 09:00–12:00');
    paint(9 * 60, 14 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toBeInTheDocument());
    fireEvent.click(within(panel).getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(confirmOrder).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('o-9', { activitySeats: [{ activityId: 'a1', seats: 10 }], paymentMethod: 'ClubInvoice', note: 'Pozn.' });
    expect(confirmOrder).toHaveBeenCalledWith('o-9', { calendarIds: ['c1'], ranges: [{ fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '14:00' }] });
  });
});
