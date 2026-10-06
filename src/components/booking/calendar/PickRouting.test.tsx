import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import CalendarGridPage from '../../../pages/booking/CalendarGridPage';
import type { Calendar, PreviewDay } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';

/*
 * Etapa 10: per-window činnosti (activity routing) in pick mode, at 390 / 834 / 1440: toggle chips per picked window,
 * the calculator, the warning, the payload, the 409 reason, and enlarging an order (only the additional need).
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


/* ── Etapa 10: which činnosti a picked window allows ── */

const ACTS = [
  { activityId: 'a1', name: 'Základní prohlídka', seats: 12, minutesPerSeat: 30, parallelCapacity: 1 },
  { activityId: 'a2', name: 'Spiroergometrie', seats: 10, minutesPerSeat: 60, parallelCapacity: 1 },
];

const sessionOf = (range: Record<string, unknown> = {}, activities = ACTS) => ({
  clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', activities,
  paymentMethod: 'ClubInvoice', note: '',
  editOrder: {
    mode: 'edit', orderId: 'o-9', dirty: false, requested: [], firstDate: DAY,
    blocks: [{ id: 'b-1', calendarId: 'c1', range: { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00', ...range } }],
  },
});

function renderWith(width: number, session: unknown, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  setViewport(width);
  PX = width < 1024 ? 44 / 30 : 52 / 60;
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/planovani', state: { pickOrder: { start: session } } }]}>
        <Routes>
          <Route path="/planovani" element={<CalendarGridPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Touch layouts keep the list of picks behind a button; the desktop panel shows it at once. */
async function details(width: number) {
  const panel = await screen.findByTestId('pick-panel');
  if (width < 1024) fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
  await waitFor(() => expect(within(panel).getAllByTestId('pick-row').length).toBeGreaterThan(0));
  return panel;
}

const chipOf = (panel: HTMLElement, name: RegExp) => within(panel).getAllByTestId('pick-chip').find((c) => name.test(c.textContent ?? '')) as HTMLElement;

const OK = toOrder({ id: 'o-9', clubName: 'FK Slaný', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' });

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('činnost chips of a picked window · %s', (_n, width) => {
  it('every window starts with all činnosti on; one press takes a činnost out, the last one cannot go, "Vše" puts everything back', async () => {
    renderWith(width, sessionOf());
    const panel = await details(width);
    const chips = within(panel).getAllByTestId('pick-chip');
    expect(chips.map((c) => c.textContent)).toEqual(['Základní', 'Spiroergometrie']);
    expect(chips.every((c) => c.getAttribute('data-on') === 'true')).toBe(true);
    expect(within(panel).getByTestId('pick-chip-all')).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByTestId('pick-chips')).toHaveAttribute('data-restricted', 'false');

    fireEvent.click(chipOf(panel, /Základní/));
    expect(chipOf(panel, /Základní/)).toHaveAttribute('data-on', 'false');
    expect(chipOf(panel, /Spiro/)).toHaveAttribute('data-on', 'true');
    expect(within(panel).getByTestId('pick-chips')).toHaveAttribute('data-restricted', 'true');
    expect(within(panel).getByTestId('pick-chip-all')).toHaveAttribute('aria-pressed', 'false');

    /* the only činnost left cannot be switched off */
    fireEvent.click(chipOf(panel, /Spiro/));
    expect(chipOf(panel, /Spiro/)).toHaveAttribute('data-on', 'true');

    fireEvent.click(within(panel).getByTestId('pick-chip-all'));
    expect(within(panel).getAllByTestId('pick-chip').every((c) => c.getAttribute('data-on') === 'true')).toBe(true);
  });

  it('a činnost with players that no window allows gets a clear warning (confirming stays possible)', async () => {
    renderWith(width, sessionOf());
    const panel = await details(width);
    expect(within(panel).queryByTestId('pick-no-window')).not.toBeInTheDocument();
    fireEvent.click(chipOf(panel, /Základní/));
    expect(await within(panel).findByTestId('pick-no-window')).toHaveTextContent('Pro Základní prohlídka zatím není žádný termín');
    expect(within(panel).getByRole('button', { name: 'Uložit změny' })).toBeEnabled();
    fireEvent.click(within(panel).getByTestId('pick-chip-all'));
    await waitFor(() => expect(within(panel).queryByTestId('pick-no-window')).not.toBeInTheDocument());
  });

  it('editing prefills each window with its činnosti', async () => {
    renderWith(width, sessionOf({ activityIds: ['a2'] }));
    const panel = await details(width);
    expect(chipOf(panel, /Základní/)).toHaveAttribute('data-on', 'false');
    expect(chipOf(panel, /Spiro/)).toHaveAttribute('data-on', 'true');
    expect(within(panel).getByTestId('pick-row')).toHaveAttribute('data-activities', 'a2');
  });
});

describe('činnosti per window · desktop', () => {
  it('the calculator feeds a spiro-only window only to spiro: 480 min = 8 of 10 spiro slots, basic untouched', async () => {
    renderWith(VIEWPORTS.desktop, sessionOf({ dailyFrom: '08:00', dailyTo: '16:00', activityIds: ['a2'] }));
    const panel = await details(VIEWPORTS.desktop);
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 12 × Základní prohlídka (30 min) · 2 × Spiroergometrie (60 min)');
    expect(within(panel).getByTestId('pick-no-window')).toHaveTextContent('Pro Základní prohlídka zatím není žádný termín');
  });

  it('a restricted bar names its činnosti on the grid', async () => {
    renderWith(VIEWPORTS.desktop, sessionOf({ activityIds: ['a2'] }));
    await details(VIEWPORTS.desktop);
    await screen.findByTestId('sub-column-c1-' + DAY);
    expect(await screen.findByTestId('picked-range-tag')).toHaveTextContent('Spiroergometrie');
  });

  it('saves ONE update: the window restricted to a činnost carries activityIds, an unrestricted one does not', async () => {
    update.mockResolvedValue(OK);
    renderWith(VIEWPORTS.desktop, sessionOf({ activityIds: ['a2'] }));
    const panel = await details(VIEWPORTS.desktop);
    await screen.findByTestId('sub-column-c1-' + DAY);
    paint(13 * 60, 14 * 60);
    await waitFor(() => expect(within(panel).getAllByTestId('pick-row')).toHaveLength(2));
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const ranges = update.mock.calls[0][1].ranges as Record<string, unknown>[];
    expect(ranges).toEqual([
      { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '12:00', activityIds: ['a2'] },
      { fromDate: DAY, toDate: DAY, dailyFrom: '13:00', dailyTo: '14:30' },
    ]);
    expect(ranges[1]).not.toHaveProperty('activityIds');
  });

  it('confirming in pick mode refreshes the whole club world: orders, club page, windows and the calendar', async () => {
    update.mockResolvedValue(OK);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    renderWith(VIEWPORTS.desktop, sessionOf(), client);
    const panel = await details(VIEWPORTS.desktop);
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => (c[0]?.queryKey as string[])[0]);
      for (const key of ['club-order', 'club-orders', 'club-summary', 'club-blocks', 'clubs', 'blocks', 'day-range', 'grid-preview']) expect(keys).toContain(key);
    });
  });

  it('an order whose windows allow everything is saved exactly as before: no activityIds anywhere', async () => {
    update.mockResolvedValue(OK);
    renderWith(VIEWPORTS.desktop, sessionOf());
    const panel = await details(VIEWPORTS.desktop);
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    for (const r of update.mock.calls[0][1].ranges as Record<string, unknown>[]) expect(r).not.toHaveProperty('activityIds');
  });

  it('takes a činnost out of a window where athletes are registered: the 409 reason is explained and the confirm cancels them', async () => {
    update
      .mockRejectedValueOnce(new ClubOrderError('Změna by zrušila rezervace sportovců.', 409, 'club_order.athletes_affected', [{ name: 'Jan Novák', activityName: 'Spiroergometrie', reason: 'activity_removed_from_window' }]))
      .mockResolvedValue(OK);
    renderWith(VIEWPORTS.desktop, sessionOf());
    const panel = await details(VIEWPORTS.desktop);
    fireEvent.click(chipOf(panel, /Spiro/));
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    const reason = await within(panel).findByTestId('pick-removed-from-window');
    expect(reason).toHaveTextContent('Činnost už v termínu nebude povolena');
    expect(reason).toHaveTextContent('Jan Novák (Spiroergometrie)');
    fireEvent.click(within(panel).getByRole('button', { name: /Potvrdit a zrušit rezervace sportovců \(1\)/ }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][2]).toBe(true);
    expect((update.mock.calls[1][1].ranges as Record<string, unknown>[])[0]).toMatchObject({ activityIds: ['a1'] });
  });
});

describe('enlarging an order · desktop', () => {
  const enlarge = (extra: Record<string, unknown> = {}) => ({
    ...sessionOf({ dailyFrom: '08:00', dailyTo: '16:00' }, [
      { activityId: 'a1', name: 'Základní prohlídka', seats: 10, minutesPerSeat: 10, parallelCapacity: 1 },
    ]),
    editOrder: {
      mode: 'edit', orderId: 'o-9', dirty: false, requested: [], firstDate: DAY,
      baseline: [{ activityId: 'a1', name: 'Základní prohlídka', seats: 3, minutesPerSeat: 10, parallelCapacity: 1 }],
      blocks: [{ id: 'b-1', calendarId: 'c1', range: { fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '09:30' } }],
      ...extra,
    },
  });

  it('shows only the ADDITIONAL need: 7 more players of a 10-minute činnost = "Zbývá 7 slotů" (7 × 10 min)', async () => {
    renderWith(VIEWPORTS.desktop, enlarge());
    const panel = await details(VIEWPORTS.desktop);
    expect(within(panel).getByTestId('pick-additional')).toHaveTextContent('Navíc k původní objednávce');
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Zbývá 7 slotů');
    expect(within(panel).getByTestId('pick-remaining')).toHaveTextContent('Zbývá: 7 × Základní prohlídka (10 min)');
    expect(within(panel).getByTestId('pick-minutes')).toHaveTextContent('Navíc vybráno 0 min z 70 min');
  });

  it('painting the extra time and confirming sends seats AND windows in ONE update', async () => {
    update.mockResolvedValue(OK);
    renderWith(VIEWPORTS.desktop, enlarge());
    const panel = await details(VIEWPORTS.desktop);
    await screen.findByTestId('sub-column-c1-' + DAY);
    paint(13 * 60, 14 * 60);
    await waitFor(() => expect(within(panel).getByTestId('pick-covered')).toBeInTheDocument());
    fireEvent.click(within(panel).getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toMatchObject({
      activitySeats: [{ activityId: 'a1', seats: 10 }],
      ranges: [{ fromDate: DAY, toDate: DAY, dailyFrom: '09:00', dailyTo: '09:30' }, { fromDate: DAY, toDate: DAY, dailyFrom: '13:00', dailyTo: '14:30' }],
    });
    expect(confirmOrder).not.toHaveBeenCalled();
  });
});
