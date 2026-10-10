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
 * Etapa 12, pick mode at 390 / 834 / 1440: the činnost bubble after a pick (Vše / one / two, Rozdělit, the plan), the
 * counter that works individually per činnost, the shortfall confirm, the "Hotovo" guard and the money of places beyond
 * the players.
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

/* ── Etapa 12 · FK Slaný with Komplexní (60 min) and Spiroergometrie (90 min), picked at 390 / 834 / 1440 ── */

const touchEvt = { button: 0, pointerType: 'touch', pointerId: 7, clientX: 100 };
const isTouch = (width: number) => width < 1024;
const dayFor = (width: number) => (width < 600 ? '2026-09-23' : '2026-09-24');

/** One window in the grid: a drag on the desktop, tap-start + tap-end on touch. Same result: [from, to + 30 min). */
function pickWindow(width: number, from: number, to: number, day = dayFor(width)) {
  const col = screen.getByTestId('sub-column-c1-' + day);
  if (isTouch(width)) {
    for (const minute of [from, to]) {
      fireEvent.pointerDown(col, { ...touchEvt, clientY: yAt(minute) });
      fireEvent.pointerUp(col, { ...touchEvt, clientY: yAt(minute) });
    }
    return;
  }
  const init = { button: 0, clientX: 100, pointerId: 1 };
  fireEvent.pointerDown(col, { ...init, clientY: yAt(from) });
  fireEvent.pointerMove(col, { ...init, clientY: yAt(to) });
  fireEvent.pointerUp(col, { ...init, clientY: yAt(to) });
}

const KOMPLEXNI = { id: 'a1', name: 'Komplexní', durationMinutes: 60, clinicServiceId: 's1', colorHex: '#1565C0', parallelCapacity: 1 };
const SPIRO = { id: 'a2', name: 'Spiroergometrie', durationMinutes: 90, clinicServiceId: 's1', colorHex: '#8A3FFC', parallelCapacity: 1 };
const THIRD = { id: 'a3', name: 'Základní', durationMinutes: 30, clinicServiceId: 's1', colorHex: '#2E7D32', parallelCapacity: 1 };

/** "Klubová objednávka" -> "Vyplním sám" with the činnosti and players given, then picking. */
async function startWith(width: number, players: Record<string, string>) {
  listActivities.mockResolvedValue([KOMPLEXNI, SPIRO, THIRD]);
  renderPage(width);
  const user = userEvent.setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Klubová objednávka' }));
  await user.click(within(await screen.findByTestId('club-order-entry')).getByTestId('entry-phone'));
  const setup = await screen.findByTestId('pick-setup');
  await user.click(within(setup).getByLabelText('Klub'));
  await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
  await user.click(within(setup).getByLabelText('Služba'));
  await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
  for (const [name, count] of Object.entries(players)) {
    await user.click(await within(setup).findByRole('checkbox', { name: new RegExp(name) }));
    await user.type(within(setup).getByRole('textbox', { name: 'Počet hráčů, ' + name }), count);
  }
  await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
  await screen.findByTestId('pick-panel');
  await screen.findByTestId('sub-column-c1-' + firstDay);
  return user;
}

const bubble = () => screen.queryByTestId('pick-ask');

/** The picked windows in the panel; on a touch layout the list sits behind the bar's button (opened once). */
function rowEls(width: number): HTMLElement[] {
  const panel = screen.getByTestId('pick-panel');
  if (isTouch(width) && panel.getAttribute('data-open') !== 'true' && bubble() === null) {
    fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
  }
  return screen.queryAllByTestId('pick-row');
}
const tick = (id: string) => within(screen.getByTestId('pick-ask')).getAllByTestId('pick-ask-activity').find((c) => c.getAttribute('data-activity-id') === id) as HTMLElement;
const closeBubble = async () => {
  fireEvent.click(screen.getByTestId('pick-ask-confirm'));
  await waitFor(() => expect(bubble()).not.toBeInTheDocument());
};

describe.each([['phone · 390', VIEWPORTS.phone], ['tablet · 834', VIEWPORTS.tablet], ['desktop · 1440', VIEWPORTS.desktop]] as const)('the činnost bubble · %s', (_n, width) => {
  it('opens AT ONCE on a pick (before anything is computed): the time, "Vše" preselected, a skeleton for the numbers', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60);
    /* no await: the bubble is there the moment the pick is */
    const ask = screen.getByTestId('pick-ask');
    expect(within(ask).getByTestId('pick-ask-time')).toHaveTextContent('11:00–12:30');
    expect(within(ask).getByTestId('pick-ask-computing')).toBeInTheDocument();
    expect(within(ask).getByTestId('pick-ask-all')).toBeChecked();
    expect(within(ask).getAllByTestId('pick-ask-activity').map((c) => c.getAttribute('data-on'))).toEqual(['true', 'true']);
    expect(ask.textContent).toContain('Komplexní');
    expect(ask.textContent).toContain('4 hráči');
    expect(ask.textContent).toContain('Spiroergometrie');
    /* the plan fills in a moment later: one činnost after another */
    await waitFor(() => expect(within(ask).queryByTestId('pick-ask-computing')).not.toBeInTheDocument());
    const rowsOfPlan = within(ask).getAllByTestId('pick-ask-plan-row').map((r) => r.textContent);
    expect(rowsOfPlan[0]).toMatch(/^Komplexní 11:00–1\d:\d\d · /);
    expect(ask.getAttribute('data-layout') ?? ask.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe(width < 600 ? 'sheet' : 'bubble');
  });

  it('"Vše" stored as null: confirming leaves the window for every činnost', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60);
    await closeBubble();
    expect(rowEls(width)).toHaveLength(1);
    expect(rowEls(width)[0]).toHaveAttribute('data-activities', '*');
  });

  it('one činnost: the window is stored for it only (activityIds = [id]) and the chip shows it', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60);
    await screen.findAllByTestId('pick-ask-plan-row');
    /* "Vše" is the master: unticking Komplexní leaves Spiro only */
    fireEvent.click(tick('a1'));
    expect(tick('a1')).toHaveAttribute('data-on', 'false');
    expect(tick('a2')).toHaveAttribute('data-on', 'true');
    await closeBubble();
    expect(rowEls(width)[0]).toHaveAttribute('data-activities', 'a2');
    expect(screen.getByTestId('picked-range-tag')).toHaveTextContent('Spiroergometrie');
  });

  it('two of three: both ticked činnosti are stored', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2', Základní: '3' });
    pickWindow(width, 11 * 60, 12 * 60);
    await screen.findAllByTestId('pick-ask-plan-row');
    fireEvent.click(tick('a3')); // Vše -> Komplexní + Spiro
    expect(tick('a3')).toHaveAttribute('data-on', 'false');
    await closeBubble();
    expect(rowEls(width)[0]).toHaveAttribute('data-activities', 'a1,a2');
  });

  it('"Zrušit" takes the just-picked window out again; so does Esc', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('pick-ask-cancel'));
    await waitFor(() => expect(bubble()).not.toBeInTheDocument());
    expect(rowEls(width)).toHaveLength(0);

    pickWindow(width, 11 * 60, 12 * 60);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(1);
    fireEvent.keyDown(screen.getByTestId('pick-ask-list'), { key: 'Escape' });
    await waitFor(() => expect(bubble()).not.toBeInTheDocument());
    expect(rowEls(width)).toHaveLength(0);
  });

  it('Enter confirms', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60);
    fireEvent.click(tick('a1'));
    fireEvent.keyDown(screen.getByTestId('pick-ask-list'), { key: 'Enter' });
    await waitFor(() => expect(bubble()).not.toBeInTheDocument());
    expect(rowEls(width)[0]).toHaveAttribute('data-activities', 'a2');
  });

  it('a single-činnost order never asks', async () => {
    await startWith(width, { Komplexní: '4' });
    pickWindow(width, 11 * 60, 12 * 60);
    await waitFor(() => expect(rowEls(width).length).toBe(1));
    expect(bubble()).not.toBeInTheDocument();
  });

  it('the one-tap shortcut (a free block / a day) asks too', async () => {
    const user = await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    if (width < 600) {
      await user.click(screen.getAllByTestId('free-block')[0]);
    } else {
      await user.click(screen.getByRole('button', { name: 'Měsíc' }));
      await user.click(await screen.findByTestId('pick-month-day-2026-09-25'));
      await user.click(await screen.findByTestId('pick-month-whole'));
    }
    const ask = await screen.findByTestId('pick-ask');
    expect(within(ask).getByTestId('pick-ask-all')).toBeChecked();
    fireEvent.click(tick('a2'));
    await closeBubble();
    expect(screen.getByTestId('pick-panel')).toBeInTheDocument();
    await waitFor(() => {
      if (width >= 600) expect(screen.getByTestId('pick-month-day-2026-09-25')).toBeInTheDocument();
    });
  });

  it('"Rozdělit okno" cuts the window in two parts, each with its own činnost: two contiguous windows are stored', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 13 * 60 + 30); // 11:00-14:00
    fireEvent.click(await screen.findByTestId('pick-ask-split'));
    const parts = screen.getAllByTestId('pick-ask-part');
    expect(parts.map((p) => p.getAttribute('data-range'))).toEqual(['660-750', '750-840']); // midpoint 12:30
    /* part 2 -> Spiro only, part 1 -> Komplexní only */
    fireEvent.click(within(parts[0]).getAllByTestId('pick-ask-activity')[1]);
    fireEvent.click(within(parts[1]).getAllByTestId('pick-ask-activity')[0]);
    /* the cut can be moved: 12:00 */
    fireEvent.change(screen.getByTestId('pick-ask-cut-time'), { target: { value: '12:00' } });
    expect(screen.getAllByTestId('pick-ask-part').map((p) => p.getAttribute('data-range'))).toEqual(['660-720', '720-840']);
    await closeBubble();
    await waitFor(() => expect(rowEls(width)).toHaveLength(2));
    const list = rowEls(width);
    expect(list.map((r) => r.getAttribute('data-activities'))).toEqual(['a1', 'a2']);
    expect(list[0].textContent).toMatch(/11:00–12:00 · 60 min/);
    expect(list[1].textContent).toMatch(/12:00–14:00 · 120 min/);
  });

  it('"+ další část" cuts again; a part never gets shorter than one grid step', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 12 * 60 + 30); // 11:00-13:30 = 150 min = 5 steps
    fireEvent.click(await screen.findByTestId('pick-ask-split'));
    fireEvent.click(screen.getByTestId('pick-ask-split'));
    const ranges = screen.getAllByTestId('pick-ask-part').map((p) => p.getAttribute('data-range'));
    expect(ranges).toHaveLength(3);
    for (const r of ranges) {
      const [a, b] = (r as string).split('-').map(Number);
      expect(b - a).toBeGreaterThanOrEqual(30);
    }
    /* moving the cut to the very start only goes one step in */
    fireEvent.change(screen.getAllByTestId('pick-ask-cut-time')[0], { target: { value: '11:00' } });
    const first = screen.getAllByTestId('pick-ask-part')[0].getAttribute('data-range') as string;
    expect(Number(first.split('-')[1]) - Number(first.split('-')[0])).toBe(30);
  });

  it('under "Vše" the plan runs one činnost after another and "Rozdělit podle plánu" makes it real', async () => {
    await startWith(width, { Komplexní: '2', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 14 * 60 + 30); // 11:00-15:00, 240 min
    const plan = await screen.findAllByTestId('pick-ask-plan-row');
    /* 2 × 60 = 120 min komplexní, then 2 × 90 = 180 spiro does not fit whole: 120 min left = 1 slot (90) */
    expect(plan[0]).toHaveTextContent('Komplexní 11:00–13:00 · 2 hráči');
    expect(plan[1]).toHaveTextContent('Spiroergometrie 13:00–14:30 · 1 hráč');
    expect(screen.getByTestId('pick-ask-overflow')).toHaveTextContent('Nevejde se: Spiroergometrie 1 hráč');
    fireEvent.click(screen.getByTestId('pick-ask-plan-split'));
    const ranges = screen.getAllByTestId('pick-ask-part').map((p) => p.getAttribute('data-range'));
    expect(ranges).toEqual(['660-780', '780-870', '870-900']);
    await closeBubble();
    await waitFor(() => expect(rowEls(width)).toHaveLength(3));
    expect(rowEls(width).map((r) => r.getAttribute('data-activities'))).toEqual(['a1', 'a2', '*']);
  });

  it('the panel keeps the chips and offers "Rozdělit" on a picked window (opens the same bubble, "Zpět" keeps it)', async () => {
    await startWith(width, { Komplexní: '4', Spiroergometrie: '2' });
    pickWindow(width, 11 * 60, 13 * 60);
    await closeBubble();
    const panel = screen.getByTestId('pick-panel');
    if (isTouch(width)) fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    expect(within(panel).getAllByTestId('pick-chip')).toHaveLength(2);
    fireEvent.click(await within(panel).findByTestId('pick-split'));
    expect(await screen.findByTestId('pick-ask')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pick-ask-cancel'));
    await waitFor(() => expect(bubble()).not.toBeInTheDocument());
    expect(rowEls(width)).toHaveLength(1);
  });
});

/* ── The counter: individually per činnost (the Dukla case) ── */

describe.each([['phone · 390', VIEWPORTS.phone], ['tablet · 834', VIEWPORTS.tablet], ['desktop · 1440', VIEWPORTS.desktop]] as const)('per-činnost counter · %s', (_n, width) => {
  const DUKLA = [
    { activityId: 'a1', name: 'Komplexní sportovní prohlídka', seats: 20, minutesPerSeat: 60, parallelCapacity: 1 },
    { activityId: 'a2', name: 'Spiroergometrické vyšetření', seats: 50, minutesPerSeat: 90, parallelCapacity: 1 },
  ];
  const session = {
    clubId: 'club-1', clubName: 'Dukla Jižní Město', serviceId: 's1', serviceName: 'Diagnostika', activities: DUKLA, paymentMethod: 'ClubInvoice', note: '',
    editOrder: {
      mode: 'edit', orderId: 'o-9', dirty: false, requested: [], firstDate: DAY,
      blocks: [
        { id: 'b-1', calendarId: 'c1', range: { fromDate: DAY, toDate: DAY, dailyFrom: '08:00', dailyTo: '14:00', activityIds: ['a2'] } },
        { id: 'b-2', calendarId: 'c1', range: { fromDate: DAY, toDate: DAY, dailyFrom: '14:30', dailyTo: '16:00', activityIds: ['a1'] } },
      ],
    },
  };
  const open = async () => {
    setViewport(width);
    PX = width < 1024 ? 44 / 30 : 52 / 60;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: '/planovani', state: { pickOrder: { start: session } } }]}>
          <Routes>
            <Route path="/planovani" element={<CalendarGridPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const panel = await screen.findByTestId('pick-panel');
    if (isTouch(width)) fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    await waitFor(() => expect(within(panel).getAllByTestId('pick-row').length).toBeGreaterThan(1));
    return panel;
  };
  const rowOf = (panel: HTMLElement, id: string) => within(panel).getAllByTestId('pick-activity').find((r) => r.getAttribute('data-activity-row') === id) as HTMLElement;

  it('Komplexní 1 slot / 19 left, Spiro 4 slots / 46 left, 30 min unused, header "Vybráno X z Y hráčů" - not one pool of minutes', async () => {
    const panel = await open();
    expect(within(panel).getByTestId('pick-slots')).toHaveTextContent('Vybráno 5 z 70 hráčů');
    expect(within(panel).getByTestId('pick-shortfall')).toHaveTextContent('Chybí termíny pro 65 hráčů');
    const k = rowOf(panel, 'a1');
    const s = rowOf(panel, 'a2');
    expect(k).toHaveTextContent('20 hráčů');
    expect(k).toHaveTextContent('1 slot vybrán · zbývá 19');
    expect(s).toHaveTextContent('50 hráčů');
    expect(s).toHaveTextContent('4 sloty vybrány · zbývá 46');
    expect(within(k).getByTestId('pick-activity-bar')).toHaveAttribute('aria-valuenow', '5');
    expect(within(s).getByTestId('pick-activity-bar')).toHaveAttribute('aria-valuenow', '8');
    await waitFor(() => expect(within(s).getByTestId('pick-activity-more')).toHaveTextContent('ještě 46 hráčů ≈ 69 h ≈ 9 celých dní při 1 kalendáři'));
    expect(within(panel).getByTestId('pick-row-unused')).toHaveTextContent('30 min nevyužito');
    expect(within(panel).getByTestId('pick-confirm')).toHaveTextContent('Uložit změny · chybí 65 hráčů');
  });

  it('"Přidat další den" puts the next free day into the pick as a window for that činnost only', async () => {
    const panel = await open();
    fireEvent.click(within(rowOf(panel, 'a2')).getByTestId('pick-add-day'));
    await waitFor(() => expect(within(panel).getAllByTestId('pick-row')).toHaveLength(3));
    const added = within(panel).getAllByTestId('pick-row')[2];
    expect(added).toHaveAttribute('data-activities', 'a2');
    expect(added.textContent).toMatch(/Pá 25\. 9\. · 08:00–15:30 · 450 min/);
    await waitFor(() => expect(within(rowOf(panel, 'a2')).getByText(/9 slotů vybráno|9 slotů|slotů vybráno/)).toBeInTheDocument());
    expect(rowOf(panel, 'a2')).toHaveTextContent('zbývá 41');
  });

  it('"Potvrdit" with a shortfall opens the confirm and creates nothing; "Doplnit termíny" returns to the panel; "Uložit i tak" saves once', async () => {
    update.mockResolvedValue(OK_ORDER);
    const panel = await open();
    fireEvent.click(within(panel).getByTestId('pick-confirm'));
    const dialog = await screen.findByTestId('pick-shortfall-dialog');
    expect(within(dialog).getByTestId('pick-shortfall-text')).toHaveTextContent('Chybí termíny pro 65 hráčů: Komplexní 19, Spiroergometrické 46');
    expect(within(dialog).getByTestId('pick-shortfall-text')).toHaveTextContent(/potřeba ještě ≈ /);
    expect(update).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('pick-shortfall-fill')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId('pick-shortfall-fill'));
    await waitFor(() => expect(screen.queryByTestId('pick-shortfall-dialog')).not.toBeInTheDocument());
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByTestId('pick-panel')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('pick-panel')).getByTestId('pick-confirm'));
    fireEvent.click(await screen.findByTestId('pick-shortfall-create'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  });
});

const OK_ORDER = toOrder({ id: 'o-9', clubName: 'Dukla Jižní Město', serviceId: 's1', status: 'Confirmed', paymentMethod: 'ClubInvoice', registrationUrl: 'https://app.test/klub/rt' });

/* ── "Hotovo": the grid stops taking picks ── */

describe.each([['phone · 390', VIEWPORTS.phone], ['tablet · 834', VIEWPORTS.tablet], ['desktop · 1440', VIEWPORTS.desktop]] as const)('Hotovo guard · %s', (_n, width) => {
  it('full coverage refuses a new pick; "Přidat termín navíc" allows exactly one; removing a window reopens picking', async () => {
    await startWith(width, { Komplexní: '2' }); // 120 min
    pickWindow(width, 11 * 60, 11 * 60 + 30); // 11:00-12:00 = 1 player
    pickWindow(width, 12 * 60, 12 * 60 + 30); // 12:00-13:00 = the 2nd player
    await waitFor(() => expect(screen.getByTestId('pick-covered')).toBeInTheDocument());
    expect(screen.getByTestId('pick-panel')).toHaveAttribute('data-full', 'true');
    const before = screen.getAllByTestId('picked-range').length;

    pickWindow(width, 14 * 60, 14 * 60);
    expect((await screen.findAllByText(/Hotovo – všichni hráči mají termín/)).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(before);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('pick-extra'));
    pickWindow(width, 14 * 60, 14 * 60);
    await waitFor(() => expect(screen.getAllByTestId('picked-range')).toHaveLength(before + 1));
    /* the guard re-arms */
    pickWindow(width, 15 * 60, 15 * 60);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(before + 1);

    /* a window taken out: the counter drops below full and picking is open again */
    const panel = screen.getByTestId('pick-panel');
    if (isTouch(width)) fireEvent.click(within(panel).getByRole('button', { name: 'Zobrazit podrobnosti výběru' }));
    const remove = within(panel).getAllByRole('button', { name: /Odebrat termín/ });
    for (const b of remove.slice(0, 2)) fireEvent.click(b);
    await waitFor(() => expect(panel).toHaveAttribute('data-full', 'false'));
    pickWindow(width, 15 * 60, 15 * 60);
    await waitFor(() => expect(screen.getAllByTestId('picked-range').length).toBeGreaterThan(0));
  });
});

/* ── Over-coverage: the money, and "Zkrátit na potřebu" ── */

describe.each([['phone · 390', VIEWPORTS.phone], ['tablet · 834', VIEWPORTS.tablet], ['desktop · 1440', VIEWPORTS.desktop]] as const)('places beyond the players · %s', (_n, width) => {
  it('says it with the money, the button reads "· N místa navíc", and "Zkrátit na potřebu" trims only on that click', async () => {
    vi.mocked(activitiesApi.list).mockResolvedValue({
      activities: [{ id: 'a1', priceCzk: 2200 }], warnings: [],
    } as unknown as Awaited<ReturnType<typeof activitiesApi.list>>);
    createStaff.mockResolvedValue(OK_ORDER);
    await startWith(width, { Komplexní: '2' }); // 2 × 60 = 120 min
    pickWindow(width, 11 * 60, 14 * 60); // 11:00-14:30 = 210 min: 3 slots, 1 spare place
    await waitFor(() => expect(rowEls(width)).toHaveLength(1));
    const panel = screen.getByTestId('pick-panel');
    await waitFor(() => expect(within(panel).getByTestId('pick-spare-warning')).toHaveTextContent(/Navíc 1 h \(1 místo Komplexní\) – nevyužitý čas ≈ 2.200\sKč ušlých tržeb/));
    expect(within(panel).getByTestId('pick-confirm')).toHaveTextContent('Potvrdit · 1 místo navíc');

    fireEvent.click(within(panel).getByTestId('pick-confirm'));
    const dialog = await screen.findByTestId('pick-shortfall-dialog');
    expect(within(dialog).getByTestId('pick-shortfall-spare')).toHaveTextContent(/1 místo Komplexní/);
    expect(createStaff).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByTestId('pick-shortfall-trim'));
    await waitFor(() => expect(screen.queryByTestId('pick-shortfall-dialog')).not.toBeInTheDocument());
    expect(createStaff).not.toHaveBeenCalled();
    /* trimmed to the players: 11:00-13:00 */
    await waitFor(() => expect(screen.getByTestId('picked-range')).toHaveTextContent('11:00 – 13:00 · 120 min'));
    expect(within(screen.getByTestId('pick-panel')).getByTestId('pick-confirm')).toHaveTextContent(/^Potvrdit objednávku$/);

    /* exact now: one click creates */
    fireEvent.click(within(screen.getByTestId('pick-panel')).getByTestId('pick-confirm'));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff.mock.calls[0][0].ranges).toEqual([{ fromDate: dayFor(width), toDate: dayFor(width), dailyFrom: '11:00', dailyTo: '13:00' }]);
  });
});
