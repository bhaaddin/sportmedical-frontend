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

const { createStaff, update, confirmOrder, listOrders, getAllClubs, listActivities, calculate } = vi.hoisted(() => ({
  createStaff: vi.fn(), update: vi.fn(), confirmOrder: vi.fn(), listOrders: vi.fn(), getAllClubs: vi.fn(), listActivities: vi.fn(), calculate: vi.fn(),
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
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, createStaff, update, confirm: confirmOrder, list: listOrders } };
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
  listOrders.mockReset().mockResolvedValue([]);
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

/** Etapa 12: with two činnosti a picked window asks which it is for; "Potvrdit" keeps the preselected "Vše". */
async function answerAsk() {
  fireEvent.click(await screen.findByTestId('pick-ask-confirm'));
  await waitFor(() => expect(screen.queryByTestId('pick-ask')).not.toBeInTheDocument());
}

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
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 0 z 10 hráčů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: Základní prohlídka 10 hráčů');
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 0\smin z 300\smin/);
    expect(within(panel).getByTestId('pick-activity')).toHaveTextContent(/Základní prohlídka \(30 min\) · 10 hráčů.*zbývá 10/);
    expect(within(panel).getByTestId('pick-progress')).toHaveAttribute('aria-valuenow', '0');
    /* Only the služba's calendar is in the grid. */
    expect(screen.queryByTestId('sub-column-c2-' + DAY)).not.toBeInTheDocument();
  });

  it('every painted range adds its minutes at once, and painting is never stopped or cut by the need', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    const panel = screen.getByTestId('pick-panel');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toMatch(/09:00–10:30 · 90 min/);
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 90\smin z 300\smin/);
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 3 z 10 hráčů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: Základní prohlídka 7 hráčů');

    /* 11:00-16:00 is 300 min, only 210 are missing - and it is booked whole, exactly as marked. */
    paint(11 * 60, 16 * 60);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[1]).toMatch(/11:00–16:00 · 300 min/);
    expect(within(panel).getByTestId('pick-covered')).toHaveTextContent('Hotovo ✓ — všichni hráči mají termín');
    expect(within(panel).getByTestId('pick-progress')).toHaveAttribute('aria-valuenow', '100');
    expect(within(panel).queryByTestId('pick-slots')).not.toBeInTheDocument();
    /* Etapa 12: the 3 places beyond the players say so on the button itself. */
    expect(within(panel).getByRole('button', { name: 'Potvrdit · 3 místa navíc' })).toBeEnabled();

    /* The surplus is information only: 390 picked of 300 = 90 more (3 slots), and no note, no switch. */
    expect(within(panel).getByTestId('pick-covered')).toHaveTextContent(/Navíc 90 min \/ 3 sloty/);
    expect(within(panel).queryByRole('switch', { name: 'Přidat rezervu' })).not.toBeInTheDocument();
    expect(panel.textContent ?? '').not.toMatch(/zastaven|rezerv/i);
  });

  it('a range removed with its cross gives its minutes back', async () => {
    renderPage(VIEWPORTS.desktop);
    await startPicking();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(screen.getByTestId('pick-panel')).getByRole('button', { name: /Odebrat termín/ }));
    expect(rows()).toHaveLength(0);
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-slots')).toHaveTextContent('Vybráno 0 z 10 hráčů');
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
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-slots')).toHaveTextContent('Vybráno 5 z 10 hráčů');

    fireEvent.pointerDown(bar, { ...init, clientY: 300 });
    fireEvent.pointerMove(bar, { ...init, clientY: 300 + 26 }); // half an hour down
    fireEvent.pointerUp(bar, { ...init, clientY: 300 + 26 });
    await waitFor(() => expect(rows()[0]).toMatch(/09:30–12:00 · 150 min/));

    /* Stretching is not limited by the need either: it goes as far as the grid allows. */
    const edge2 = within(screen.getByTestId('picked-range')).getByTestId('pick-handle-end');
    fireEvent.pointerDown(edge2, { ...init, clientY: 400 });
    fireEvent.pointerMove(edge2, { ...init, clientY: 400 + 52 * 5 });
    fireEvent.pointerUp(edge2, { ...init, clientY: 400 + 52 * 5 });
    await waitFor(() => expect(rows()[0]).toMatch(/09:30–16:00 · 390 min/));
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
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit/ }));
    /* 3 places beyond the players: the desk is asked first (Etapa 12) and confirms as it is. */
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff).toHaveBeenCalledWith({
      clubId: 'club-1',
      serviceId: 's1',
      activitySeats: [{ activityId: 'a1', seats: 10 }],
      paymentMethod: 'ClubInvoice',
      ranges: [
        { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '10:30' },
        { fromDate: DAY, toDate: DAY, dailyFrom: '11:00', dailyTo: '16:00' },
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
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit/ }));
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
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
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Vybráno 0 z 10 hráčů');
    expect(within(panel).queryByTestId('pick-list')).not.toBeInTheDocument();
    paint(9 * 60, 10 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Vybráno 3 z 10 hráčů'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent(/Vybráno 90\smin z 300\smin/);
    expect(within(panel).getByRole('button', { name: 'Potvrdit objednávku · chybí 7 hráčů' })).toBeEnabled();
  });
});

describe('phone · 390', () => {
  it('shows the grid (not the list) while picking, with the calculator as a bottom bar', async () => {
    renderPage(VIEWPORTS.phone);
    await startPicking();
    expect(screen.queryByTestId('phone-calendar')).not.toBeInTheDocument();
    const panel = screen.getByTestId('pick-panel');
    expect(panel).toHaveAttribute('data-layout', 'bottom-bar');
    expect(within(panel).getByTestId('pick-summary')).toHaveTextContent('Vybráno 0 z 10 hráčů');
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
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit/ }));
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
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

  it('the day shortcut takes only the time the order still needs; tapping the day again removes it', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-25'));
    /* The menu says what the tap takes: 300 of the 480 minutes. */
    expect(await screen.findByTestId('pick-month-whole')).toHaveTextContent('Potřebný čas (5 h)');
    await user.click(screen.getByTestId('pick-month-whole'));
    /* 10 players x 30 min = 300 min, the day has 480: 300 are taken, 180 stay free. */
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('5:00 h'));
    expect(progress()).toHaveAttribute('aria-valuenow', '100');
    expect(summary()).toHaveTextContent(/Hotovo/);
    expect(summary()).not.toHaveTextContent(/Navíc/);
    expect(monthDay('2026-09-25')).toHaveAttribute('data-free', '180');
    expect(within(monthDay('2026-09-25')).getByTestId('pick-month-rest')).toHaveAttribute('title', 'zbývá 3 h pro běžné objednávky');
    expect(monthDay('2026-09-25')).toHaveAccessibleName(/zbývá 3 h pro běžné objednávky/);
    expect(within(monthDay('2026-09-25')).getByTestId('pick-month-rest')).toHaveTextContent(width < 600 ? /^zbývá 3 h$/ : 'zbývá 3 h pro běžné objednávky');
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-remove'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).queryByTestId('pick-month-chip')).not.toBeInTheDocument());
    expect(progress()).toHaveAttribute('aria-valuenow', '0');
  });

  it('a 60-minute need and the day shortcut: exactly 60 minutes are taken, no surplus', async () => {
    renderPage(width);
    const user = await startPicking('2');
    await goMonth(user);
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-whole'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('1:00 h'));
    expect(summary()).toHaveTextContent(/Hotovo/);
    expect(summary()).not.toHaveTextContent(/Navíc/);
  });

  it('after a trimmed tap one note says so; "Vzít celý den" replaces the pick by the whole day, exactly', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-whole'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('5:00 h'));
    expect((await screen.findAllByText(/Vzali jsme jen potřebný čas/))[0]).toHaveTextContent(
      'Vzali jsme jen potřebný čas (5 h); zbytek dne zůstává volný pro běžné objednávky.',
    );
    await user.click(screen.getByTestId('pick-note-action'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h'));
    /* Exactly as marked: the surplus is shown, nothing is trimmed, the note is gone. */
    expect(summary()).toHaveTextContent(/Navíc 180 min \/ 6 slotů/);
    expect(screen.queryByText(/Vzali jsme jen potřebný čas/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('pick-note-action')).not.toBeInTheDocument();
    expect(monthDay('2026-09-25')).toHaveAttribute('data-free', '0');
  });

  it('the explicit whole day is one more button in the day menu, booked exactly', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-whole-exact'));
    await waitFor(() => expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h'));
    expect(summary()).toHaveTextContent(/Navíc 180 min/);
  });

  it('a need that is already covered: the tap adds nothing and says so', async () => {
    renderPage(width);
    const user = await startPicking();
    await goMonth(user);
    await user.click(monthDay('2026-09-24'));
    await user.click(await screen.findByTestId('pick-month-whole')); // 300 min: covered
    await waitFor(() => expect(within(monthDay('2026-09-24')).getByTestId('pick-month-chip')).toBeInTheDocument());
    await user.click(monthDay('2026-09-25'));
    await user.click(await screen.findByTestId('pick-month-whole'));
    expect((await screen.findAllByText('Objednávka je už pokryta. Další čas označte ručně.')).length).toBeGreaterThan(0);
    expect(within(monthDay('2026-09-25')).queryByTestId('pick-month-chip')).not.toBeInTheDocument();
    expect(summary()).not.toHaveTextContent(/Navíc/);
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
  it.each([
    ['phone · 390', VIEWPORTS.phone],
    ['tablet · 834', VIEWPORTS.tablet],
    ['desktop · 1440', VIEWPORTS.desktop],
  ])('%s: "Klepnutí = potřebný čas z dne" - 480 + 480 + 60 over three days, the last one trimmed, no surplus', async (_n, width) => {
    renderPage(width);
    const user = await startPicking('34'); // 34 x 30 = 1 020 min
    await goMonth(user);
    await user.click(screen.getByRole('switch', { name: 'Klepnutí = potřebný čas z dne' }));
    await user.click(monthDay('2026-09-24'));
    await user.click(monthDay('2026-09-25'));
    await user.click(monthDay('2026-09-26'));
    await waitFor(() => expect(within(monthDay('2026-09-26')).getByTestId('pick-month-chip')).toHaveTextContent('1:00 h'));
    expect(within(monthDay('2026-09-25')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h');
    expect(within(monthDay('2026-09-24')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h');
    expect(summary()).toHaveTextContent(/Hotovo/);
    expect(summary()).not.toHaveTextContent(/Navíc/);
    expect(monthDay('2026-09-26')).toHaveAttribute('data-free', '420'); // the rest of the last day stays free
    expect(within(monthDay('2026-09-26')).getByTestId('pick-month-rest')).toHaveTextContent(/zbývá 7 h/);
    /* One more tap: everybody is covered, so nothing is added. */
    await user.click(monthDay('2026-09-27'));
    expect((await screen.findAllByText('Objednávka je už pokryta. Další čas označte ručně.')).length).toBeGreaterThan(0);
    expect(within(monthDay('2026-09-27')).queryByTestId('pick-month-chip')).not.toBeInTheDocument();
  });

  it('a whole day is still booked whole when the need is at least the day (the 30 Oct case)', async () => {
    renderPage(VIEWPORTS.phone);
    const user = await startPicking('28'); // 28 x 30 = 840 min
    await goMonth(user);
    await user.click(screen.getByRole('switch', { name: 'Klepnutí = potřebný čas z dne' }));
    await user.click(monthDay('2026-09-24'));
    await waitFor(() => expect(within(monthDay('2026-09-24')).getByTestId('pick-month-chip')).toHaveTextContent('8:00 h'));
    expect(summary()).toHaveTextContent('Vybráno 16 z 28 hráčů');
    expect(screen.queryByTestId('pick-note-action')).not.toBeInTheDocument();
    expect(within(monthDay('2026-09-24')).queryByTestId('pick-month-rest')).not.toBeInTheDocument();
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
    expect(summary()).toHaveTextContent('Vybráno 3 z 10 hráčů');
  });

  it('a slot that is already gone today is refused with the past note, not picked', async () => {
    renderPage(VIEWPORTS.phone);
    await startPicking();
    tap(9 * 60); // now is 10:15
    expect(screen.queryByTestId('tap-anchor')).not.toBeInTheDocument();
    expect(summary().textContent).toMatch(/Vybráno 0 z 10 hráčů/);
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
    /* The block says what a tap takes: 300 of its 330 minutes. */
    expect(within(blocks[0]).getByTestId('free-block-take')).toHaveTextContent('vezmete 5 h');
    expect(screen.getByTestId('free-blocks')).toHaveTextContent('klepnutím vezmete potřebný čas z bloku');
    await user.click(blocks[0]);
    /* Only the 300 minutes the order needs are taken, from the start of the block: 10:30-15:30. */
    await waitFor(() => expect(screen.getAllByTestId('picked-range')).toHaveLength(1));
    expect(screen.getByTestId('picked-range')).toHaveTextContent('10:30 – 15:30 · 300 min');
    expect(summary()).toHaveTextContent(/Hotovo/);
    expect(summary()).not.toHaveTextContent(/Navíc/);
    /* The rest of the block stays free, and the note offers the whole block. */
    expect(screen.getByTestId('free-blocks')).toHaveTextContent('15:30–16:00');
    expect((await screen.findAllByText(/zbytek bloku zůstává volný/)).length).toBeGreaterThan(0);
    await user.click(screen.getByTestId('pick-note-action'));
    await waitFor(() => expect(screen.getByTestId('picked-range')).toHaveTextContent('10:30 – 16:00 · 330 min'));
    expect(summary()).toHaveTextContent(/Navíc 30 min/);
  });

  it('a tap-start / tap-end by hand is booked exactly as marked, beyond the need, and the panel shows the surplus', async () => {
    renderPage(VIEWPORTS.phone);
    await startPicking('2'); // 60 min
    tap(11 * 60);
    tap(15 * 60 + 30);
    await waitFor(() => expect(screen.getAllByTestId('picked-range')).toHaveLength(1));
    expect(screen.getByTestId('picked-range')).toHaveTextContent('11:00 – 16:00 · 300 min');
    expect(summary()).toHaveTextContent(/Hotovo/);
    expect(summary()).toHaveTextContent(/Navíc 240 min/);
    expect(screen.queryByTestId('pick-note-action')).not.toBeInTheDocument();
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
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 0 z 22 hráčů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: Základní 12 hráčů · Komplexní 10 hráčů');
    /* 08:00-10:30 = 150 min, a "Vše" window: the first činnost takes it (5 of 12 Základní) ... */
    paint(8 * 60, 10 * 60);
    await answerAsk();
    await waitFor(() => expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 5 z 22 hráčů'));
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: Základní 7 hráčů · Komplexní 10 hráčů');
    /* ... and the rest is painted over two more days. */
    paint(8 * 60, 15 * 60 + 30, '2026-09-25');
    await answerAsk();
    paint(8 * 60, 15 * 60 + 30, '2026-09-26');
    await answerAsk();
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toHaveTextContent('Hotovo ✓ — všichni hráči mají termín'));
    expect(within(panel).getByRole('button', { name: /^Potvrdit/ })).toBeEnabled();
  });
});

describe('marked places and editing an existing order', () => {
  it('places marked in the grid offer no club entry (they only book a patient or block time)', async () => {
    renderPage(VIEWPORTS.desktop);
    const col = await screen.findByTestId('sub-column-c1-' + DAY);
    const init = { button: 0, clientX: 100, pointerId: 1, ctrlKey: true };
    fireEvent.pointerDown(col, { ...init, clientY: yAt(11 * 60) });
    fireEvent.pointerMove(col, { ...init, clientY: yAt(11 * 60 + 30) });
    fireEvent.pointerUp(col, { ...init, clientY: yAt(11 * 60 + 30) });
    await screen.findByTestId('selection-tray');
    expect(screen.queryByRole('button', { name: 'Rezervovat pro klub' })).not.toBeInTheDocument();
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
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 6 z 10 hráčů');
    expect(screen.queryByRole('button', { name: /^Potvrdit objednávku/ })).not.toBeInTheDocument();
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
    paint(9 * 60, 13 * 60 + 30);
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toBeInTheDocument());
    fireEvent.click(within(panel).getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(confirmOrder).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('o-9', { activitySeats: [{ activityId: 'a1', seats: 10 }], paymentMethod: 'ClubInvoice', note: 'Pozn.' });
    expect(confirmOrder).toHaveBeenCalledWith('o-9', { calendarIds: ['c1'], ranges: [{ fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '14:00' }] });
  });
});

/* ── Etapa 10: never silently a second order of the same služba ── */

describe('a club that already has a live order of this služba', () => {
  const EXISTING = 'o-7777-aaaa-bbbb-cccc-000000000007';
  const existing = (over: Record<string, unknown> = {}) => toOrder({
    id: EXISTING, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: null }],
    totalSeats: 10, note: 'Stará pozn.', createdAtUtc: '2026-09-01T10:00:00Z',
    blocks: [
      { id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', calendarIds: ['c1'], activityIds: [], fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00', status: 'Active', athletes: [], clubOrderId: EXISTING },
      { id: 'b-2', clubId: 'club-1', clubName: 'FK Slaný', calendarIds: ['c1'], activityIds: [], fromDate: '2026-09-25', toDate: '2026-09-25', dailyFrom: '09:00', dailyTo: '12:00', status: 'Active', athletes: [], clubOrderId: EXISTING },
    ],
    ...over,
  });

  beforeEach(() => setViewport(VIEWPORTS.desktop));

  const pickAndConfirm = async () => {
    renderPage(VIEWPORTS.desktop);
    const user = await startPicking();
    paint(13 * 60, 15 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit objednávku/ }));
    /* 150 of the 300 minutes: the shortfall is the desk's call first (Etapa 12), then the club's other orders. */
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    return user;
  };

  it('asks first - nothing is created until the desk chooses', async () => {
    listOrders.mockResolvedValue([existing()]);
    await pickAndConfirm();
    const dialog = await screen.findByTestId('pick-duplicate');
    expect(within(dialog).getByTestId('pick-duplicate-line')).toHaveTextContent('Klub už má objednávku KO-00000007 na tuto službu (2 termíny, 10 hráčů).');
    expect(within(dialog).getByRole('button', { name: 'Přidat do té objednávky' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Vytvořit samostatnou objednávku' })).toBeInTheDocument();
    expect(createStaff).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(listOrders).toHaveBeenCalledWith({ clubId: 'club-1' });
  });

  it('"Vytvořit samostatnou objednávku" goes on as before', async () => {
    listOrders.mockResolvedValue([existing()]);
    createStaff.mockResolvedValue(toOrder({ id: 'o-new', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Vytvořit samostatnou objednávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff.mock.calls[0][0]).toMatchObject({ clubId: 'club-1', serviceId: 's1', activitySeats: [{ activityId: 'a1', seats: 10 }], status: 'Confirmed' });
    expect(update).not.toHaveBeenCalled();
  });

  it('"Přidat do té objednávky" turns the pick into an edit of that order: its windows stay, the new ones and the new players are added', async () => {
    listOrders.mockResolvedValue([existing()]);
    update.mockResolvedValue(existing());
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Přidat do té objednávky' }));

    /* Edit mode of the existing order: its two windows plus the new pick, "Uložit změny", no "Potvrdit objednávku". */
    const panel = await screen.findByTestId('pick-panel');
    await within(panel).findByRole('button', { name: /^Uložit změny/ });
    expect(screen.queryByRole('button', { name: /^Potvrdit objednávku/ })).not.toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().join(' ')).toMatch(/09:00–12:00 · 180 min/);
    expect(rows().join(' ')).toMatch(/13:00–15:30 · 150 min/);
    expect(within(panel).getByTestId('pick-note')).toHaveTextContent('Přidáno do objednávky KO-00000007');
    expect(createStaff).not.toHaveBeenCalled();

    /* The new player counts are ADDED to the old (10 + 10); the panel shows only the ADDITIONAL need: 10 players. */
    expect(within(panel).getByTestId('pick-additional')).toHaveTextContent('Navíc k původní objednávce');
    expect(within(panel).getByTestId('pick-needs')).toHaveTextContent('10 hráčů');
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 7 z 10 hráčů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: Základní prohlídka 3 hráči');
  });

  it('saving after "Přidat" sends ONE update: summed players, every window, the order own payment and note', async () => {
    listOrders.mockResolvedValue([existing()]);
    update.mockResolvedValue(existing());
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Přidat do té objednávky' }));
    const panel = await screen.findByTestId('pick-panel');
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(within(panel).getByRole('button', { name: /^Uložit změny/ }));
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe(EXISTING);
    expect(update.mock.calls[0][1]).toMatchObject({
      activitySeats: [{ activityId: 'a1', seats: 20 }], paymentMethod: 'ClubInvoice', note: 'Stará pozn.', calendarIds: ['c1'],
      ranges: [
        /* The same daily window on two consecutive days is one range, as pick mode always sends it. */
        { fromDate: DAY, toDate: '2026-09-25', dailyFrom: '09:00', dailyTo: '12:00' },
        { fromDate: DAY, toDate: DAY, dailyFrom: '13:00', dailyTo: '15:30' },
      ],
    });
    expect(createStaff).not.toHaveBeenCalled();
  });

  it('"Zpět" keeps the picks and creates nothing', async () => {
    listOrders.mockResolvedValue([existing()]);
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Zpět' }));
    await waitFor(() => expect(screen.queryByTestId('pick-duplicate')).toBeNull());
    expect(rows()).toHaveLength(1);
    expect(createStaff).not.toHaveBeenCalled();
  });

  it.each([
    ['a cancelled order', { status: 'Cancelled' }],
    ['a completed order', { status: 'Completed' }],
  ])('%s is no reason to ask', async (_label, over) => {
    listOrders.mockResolvedValue([existing(over)]);
    createStaff.mockResolvedValue(toOrder({ id: 'o-new', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    await pickAndConfirm();
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('pick-duplicate')).toBeNull();
  });

  it('a list that cannot be read never blocks the order', async () => {
    listOrders.mockRejectedValue(new Error('offline'));
    createStaff.mockResolvedValue(toOrder({ id: 'o-new', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    await pickAndConfirm();
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
  });
});

/* ── Etapa 12: the desk is also asked about a live order of a DIFFERENT služba, offered as an addendum ── */

describe('a club that already has a live order of a DIFFERENT služba', () => {
  const OTHER = 'o-8888-aaaa-bbbb-cccc-000000000008';
  const otherService = (over: Record<string, unknown> = {}) => toOrder({
    id: OTHER, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's2', serviceName: 'Lékařské prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a9', activityName: 'Vstupní prohlídka', durationMinutes: 30, seats: 5, registered: 0, unitPriceCzk: null }],
    totalSeats: 5, createdAtUtc: '2026-09-02T10:00:00Z',
    blocks: [{ id: 'ob-1', clubId: 'club-1', clubName: 'FK Slaný', calendarIds: ['c2'], activityIds: [], fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '10:00', status: 'Active', athletes: [], clubOrderId: OTHER }],
    ...over,
  });

  beforeEach(() => setViewport(VIEWPORTS.desktop));

  const pickAndConfirm = async () => {
    renderPage(VIEWPORTS.desktop);
    const user = await startPicking(); // picks 's1' Diagnostika - a DIFFERENT služba than OTHER's 's2'
    paint(13 * 60, 15 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit objednávku/ }));
    /* 150 of the 300 minutes: the shortfall is the desk's call first (Etapa 12), then the club's other orders. */
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    return user;
  };

  it('asks first and offers the addendum, never a silent "Přidat do té objednávky" merge', async () => {
    listOrders.mockResolvedValue([otherService()]);
    await pickAndConfirm();
    const dialog = await screen.findByTestId('pick-duplicate');
    expect(within(dialog).getByTestId('pick-duplicate-line')).toHaveTextContent('Klub už má objednávku KO-00000008 na jinou službu (Lékařské prohlídky, 1 termín, 5 hráčů).');
    expect(within(dialog).getByRole('button', { name: 'Přidat jako dodatek k objednávce KO-00000008' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Vytvořit samostatnou objednávku' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Přidat do té objednávky' })).toBeNull();
    expect(createStaff).not.toHaveBeenCalled();
  });

  it('"Přidat jako dodatek k objednávce ..." ends this pick and opens the setup locked to that order (its own addendum flow)', async () => {
    listOrders.mockResolvedValue([otherService()]);
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Přidat jako dodatek k objednávce KO-00000008' }));
    await waitFor(() => expect(screen.queryByTestId('pick-panel')).not.toBeInTheDocument());
    const setup = await screen.findByTestId('pick-setup');
    expect(within(setup).getByTestId('pick-setup-parent')).toHaveTextContent('Dodatek k objednávce KO-00000008');
    expect(within(setup).getByLabelText('Klub')).toBeDisabled();
    expect(createStaff).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('"Vytvořit samostatnou objednávku" still creates a new, separate order', async () => {
    listOrders.mockResolvedValue([otherService()]);
    createStaff.mockResolvedValue(toOrder({ id: 'o-new', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Vytvořit samostatnou objednávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(update).not.toHaveBeenCalled();
  });
});

describe('a club with BOTH a same-služba and a different-služba live order (the three-way case)', () => {
  const SAME = 'o-7777-aaaa-bbbb-cccc-000000000007';
  const OTHER = 'o-8888-aaaa-bbbb-cccc-000000000008';
  const sameService = (over: Record<string, unknown> = {}) => toOrder({
    id: SAME, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: null }],
    totalSeats: 10, createdAtUtc: '2026-09-01T10:00:00Z',
    blocks: [{ id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', calendarIds: ['c1'], activityIds: [], fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00', status: 'Active', athletes: [], clubOrderId: SAME }],
    ...over,
  });
  const otherService = (over: Record<string, unknown> = {}) => toOrder({
    id: OTHER, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's2', serviceName: 'Lékařské prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a9', activityName: 'Vstupní prohlídka', durationMinutes: 30, seats: 5, registered: 0, unitPriceCzk: null }],
    totalSeats: 5, createdAtUtc: '2026-09-02T10:00:00Z',
    blocks: [{ id: 'ob-1', clubId: 'club-1', clubName: 'FK Slaný', calendarIds: ['c2'], activityIds: [], fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '10:00', status: 'Active', athletes: [], clubOrderId: OTHER }],
    ...over,
  });

  beforeEach(() => setViewport(VIEWPORTS.desktop));

  const pickAndConfirm = async () => {
    renderPage(VIEWPORTS.desktop);
    const user = await startPicking();
    paint(13 * 60, 15 * 60);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Potvrdit objednávku/ }));
    /* 150 of the 300 minutes: the shortfall is the desk's call first (Etapa 12), then the club's other orders. */
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    return user;
  };

  it('lists both live orders, each with its matching action, and "Vytvořit samostatnou objednávku" once', async () => {
    listOrders.mockResolvedValue([sameService(), otherService()]);
    await pickAndConfirm();
    const dialog = await screen.findByTestId('pick-duplicate');
    const dialogRows = within(dialog).getAllByTestId('pick-duplicate-row');
    expect(dialogRows).toHaveLength(2);
    expect(dialogRows[0]).toHaveTextContent('KO-00000007');
    expect(dialogRows[0]).toHaveTextContent('Diagnostika');
    expect(within(dialogRows[0]).getByRole('button', { name: 'Přidat do této objednávky' })).toBeInTheDocument();
    expect(dialogRows[1]).toHaveTextContent('KO-00000008');
    expect(dialogRows[1]).toHaveTextContent('Lékařské prohlídky');
    expect(within(dialogRows[1]).getByRole('button', { name: 'Přidat jako dodatek k této' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Vytvořit samostatnou objednávku' })).toHaveLength(1);
    expect(createStaff).not.toHaveBeenCalled();
  });

  it('merging into the same-služba row behaves exactly as the plain merge case', async () => {
    listOrders.mockResolvedValue([sameService(), otherService()]);
    update.mockResolvedValue(sameService());
    const user = await pickAndConfirm();
    const dialog = await screen.findByTestId('pick-duplicate');
    await user.click(within(within(dialog).getAllByTestId('pick-duplicate-row')[0]).getByRole('button', { name: 'Přidat do této objednávky' }));
    const panel = await screen.findByTestId('pick-panel');
    await within(panel).findByRole('button', { name: /^Uložit změny/ });
    expect(within(panel).getByTestId('pick-note')).toHaveTextContent('Přidáno do objednávky KO-00000007');
    expect(createStaff).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: /^Uložit změny/ }));
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe(SAME);
  });

  it('picking the addendum row ends this pick and opens the setup locked to that different order', async () => {
    listOrders.mockResolvedValue([sameService(), otherService()]);
    const user = await pickAndConfirm();
    const dialog = await screen.findByTestId('pick-duplicate');
    await user.click(within(within(dialog).getAllByTestId('pick-duplicate-row')[1]).getByRole('button', { name: 'Přidat jako dodatek k této' }));
    await waitFor(() => expect(screen.queryByTestId('pick-panel')).not.toBeInTheDocument());
    const setup = await screen.findByTestId('pick-setup');
    expect(within(setup).getByTestId('pick-setup-parent')).toHaveTextContent('Dodatek k objednávce KO-00000008');
    expect(createStaff).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('"Vytvořit samostatnou objednávku" still works from the three-way dialog', async () => {
    listOrders.mockResolvedValue([sameService(), otherService()]);
    createStaff.mockResolvedValue(toOrder({ id: 'o-new', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' }));
    const user = await pickAndConfirm();
    await user.click(await screen.findByRole('button', { name: 'Vytvořit samostatnou objednávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(update).not.toHaveBeenCalled();
  });
});
