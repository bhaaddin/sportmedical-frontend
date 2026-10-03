import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import CalendarGridPage from '../../../pages/booking/CalendarGridPage';
import type { Calendar, DayAppointment, PreviewDay } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';

/*
 * The whole screen against a mocked API: the checkboxes, the service and the
 * employee filter have to change what is drawn, not just what is ticked.
 */

vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/holidays', () => ({ holidaysApi: { year: vi.fn() } }));
vi.mock('../../../api/clinicSettings', () => ({ readPublicClinic: vi.fn(), readSettings: vi.fn() }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range: vi.fn(), blocks: vi.fn() } }));
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
/* The service colours are read raw from the same endpoint as the services; nothing here needs them. */
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
/*
 * The booking dialog is a screen of its own with its own tests; here only
 * what the calendar hands it matters - which calendar, which time.
 */
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: { initialCalendarId?: string; initialStart?: string; initialEnd?: string }) => (
    <div
      role="dialog"
      data-testid="new-appointment"
      data-calendar={props.initialCalendarId}
      data-start={props.initialStart}
      data-end={props.initialEnd}
    />
  ),
}));
/*
 * The now-line and holiday colours are the owner's calendar-display settings,
 * read (by everyone) from /api/v1/settings/calendar-display, not the admin-only
 * /api/settings. Keep the real helpers; drive the hook so the chosen now-line
 * colour is what the grid must paint.
 */
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return {
    ...actual,
    useCalendarDisplay: vi.fn(() => ({
      settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, nowLineColor: '#6A1B9A' },
      loaded: true,
    })),
  };
});

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { holidaysApi } from '../../../api/holidays';
import { readPublicClinic, readSettings } from '../../../api/clinicSettings';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { activitiesApi } from '../../../api/activities';

const base = {
  location: '',
  displayStepMinutes: 30,
  isActive: true,
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
};
const diagnostika: Calendar = { ...base, id: 'c1', name: 'Sportovní diagnostika', color: '#1565C0', sortOrder: 0, clinicServiceId: 's1' };
const prohlidka: Calendar = { ...base, id: 'c2', name: 'Sportovní prohlídka', color: '#2E7D32', sortOrder: 1, clinicServiceId: 's2' };

const WORKER: Record<string, [string, string]> = {
  c1: ['u1', 'Anna Černá'],
  c2: ['u2', 'Tomáš Veselý'],
};

function appointment(id: string, calendarId: string, activityName: string): DayAppointment {
  return {
    id,
    calendarId,
    patientId: 'p-' + id,
    activityId: 'a-' + id,
    activityName,
    startUtc: '2026-09-23T07:00:00Z',
    endUtc: '2026-09-23T08:00:00Z',
    status: 0,
    isRunningLate: false,
    checkedInUtc: null,
    paperwork: null,
    partnerName: null,
    clubDiscountPercent: null,
    paymentState: 'none',
    invoiceId: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T08:15:00Z')); // Wednesday 10:15 in Prague
  window.localStorage.setItem(
    'permissions',
    JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']),
  );

  vi.mocked(calendarsApi.list).mockResolvedValue([diagnostika, prohlidka]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null },
    { id: 's2', name: 'Lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: null },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(holidaysApi.year).mockResolvedValue([
    { date: '2026-09-25', name: 'Firemní volno', isHoliday: true, isStatutory: false, isAmended: true },
  ]);
  vi.mocked(readPublicClinic).mockResolvedValue({
    name: '', email: '', phone: '', address: '', bookingEnabled: false,
  });
  vi.mocked(readSettings).mockResolvedValue({ 'calendar.nowLineColor': '#6A1B9A' });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (calendarId, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({
        date: d,
        isOpen: true,
        closedBecause: null,
        startTime: '08:00:00',
        endTime: '16:00:00',
        breakStart: null,
        breakEnd: null,
        workerUserId: WORKER[calendarId][0],
        workerDisplayName: WORKER[calendarId][1],
        isChangedByOverride: false,
        offeredActivityIds: ['a'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockResolvedValue([
    appointment('ap1', 'c1', 'Spiroergometrie'),
    appointment('ap2', 'c2', 'Vstupní prohlídka'),
  ]);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async (calendarId) =>
    calendarId === 'c1'
      ? [{ id: 'b1', startUtc: '2026-09-24T10:00:00Z', endUtc: '2026-09-24T11:00:00Z', reason: 'Porada' }]
      : [],
  );
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});


function ClubsProbe() {
  const location = useLocation();
  return <pre data-testid="clubs-state">{JSON.stringify(location.state)}</pre>;
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/planovani']}>
        <Routes>
          <Route path="/planovani" element={<CalendarGridPage />} />
          <Route path="/clubs" element={<ClubsProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* The week 21.-27. 9. 2026 at zoom 1: working hours 08-16 draw 07:00-17:00, 52 px an hour. */
const PX = 52 / 60;
const TOP = 7 * 60;
const yAt = (minute: number) => (minute - TOP) * PX + 1;
const column = (day: string) => screen.getByTestId('sub-column-c1-' + day);

function mark(day: string, from: number, to: number, opts: { ctrl?: boolean } = {}) {
  const col = column(day);
  const init = { button: 0, clientX: 100, pointerId: 1, ctrlKey: opts.ctrl ?? false };
  fireEvent.pointerDown(col, { ...init, clientY: yAt(from) });
  fireEvent.pointerMove(col, { ...init, clientY: yAt(to) });
  fireEvent.pointerUp(col, { ...init, clientY: yAt(to) });
}

const chips = () => screen.queryAllByTestId('tray-chip').map((c) => c.textContent);
const clubState = () => JSON.parse(screen.getByTestId('clubs-state').textContent ?? 'null');

async function ready() {
  renderPage();
  await screen.findByRole('button', { name: /Spiroergometrie/ });
}

describe('several places at once on the desktop', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('a plain drag opens the popover; Ctrl drags add to the tray instead', async () => {
    await ready();
    mark('2026-09-23', 8 * 60, 8 * 60 + 30);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    mark('2026-09-23', 8 * 60, 8 * 60 + 30, { ctrl: true });
    mark('2026-09-24', 14 * 60, 14 * 60 + 30, { ctrl: true });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('selection-tray')).toHaveAttribute('data-variant', 'card');
    expect(screen.getByText('2 termíny')).toBeInTheDocument();
    expect(chips()).toEqual(['St 23. 9. · 08:00–09:00', 'Čt 24. 9. · 14:00–15:00']);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(2);
  });

  it('removes one chip, and Escape clears them all', async () => {
    await ready();
    mark('2026-09-23', 8 * 60, 8 * 60, { ctrl: true });
    mark('2026-09-24', 10 * 60, 10 * 60, { ctrl: true });
    expect(screen.getAllByTestId('tray-chip')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Odebrat termín St 23\. 9\./ }));
    expect(screen.getAllByTestId('tray-chip')).toHaveLength(1);
    expect(screen.getAllByTestId('picked-range')).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
    mark('2026-09-23', 8 * 60, 8 * 60, { ctrl: true });
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit výběr' }));
    expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
  });

  it('a plain drag after several places starts a new selection', async () => {
    await ready();
    mark('2026-09-23', 8 * 60, 8 * 60, { ctrl: true });
    mark('2026-09-24', 10 * 60, 10 * 60, { ctrl: true });
    mark('2026-09-23', 12 * 60, 12 * 60);
    expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('hands 3 places to the clubs screen sorted, with the old single fields', async () => {
    await ready();
    mark('2026-09-24', 10 * 60, 10 * 60 + 30, { ctrl: true });
    mark('2026-09-23', 14 * 60, 14 * 60 + 30, { ctrl: true });
    mark('2026-09-23', 8 * 60, 8 * 60 + 30, { ctrl: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat pro klub' }));
    const { newBlock } = clubState();
    expect(newBlock.calendarIds).toEqual(['c1', 'c2']);
    expect(newBlock.ranges).toEqual([
      { fromDate: '2026-09-23', toDate: '2026-09-23', dailyFrom: '08:00', dailyTo: '09:00' },
      { fromDate: '2026-09-23', toDate: '2026-09-23', dailyFrom: '14:00', dailyTo: '15:00' },
      { fromDate: '2026-09-24', toDate: '2026-09-24', dailyFrom: '10:00', dailyTo: '11:00' },
    ]);
    expect(newBlock).toMatchObject({ fromDate: '2026-09-23', toDate: '2026-09-23', dailyFrom: '08:00', dailyTo: '09:00' });
  });

  it('merges places that touch on the same daily window', async () => {
    await ready();
    mark('2026-09-23', 8 * 60, 8 * 60 + 30, { ctrl: true });
    mark('2026-09-23', 9 * 60, 9 * 60 + 30, { ctrl: true });
    mark('2026-09-24', 8 * 60, 8 * 60 + 30, { ctrl: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat pro klub' }));
    /* 08:00-09:00 and 09:00-10:00 join on Wednesday; Thursday repeats the 08:00-09:00 window and stays apart. */
    expect(clubState().newBlock.ranges).toEqual([
      { fromDate: '2026-09-23', toDate: '2026-09-23', dailyFrom: '08:00', dailyTo: '10:00' },
      { fromDate: '2026-09-24', toDate: '2026-09-24', dailyFrom: '08:00', dailyTo: '09:00' },
    ]);
  });

  it('one place keeps the old fields and a one-item ranges list', async () => {
    await ready();
    mark('2026-09-24', 10 * 60, 10 * 60 + 30, { ctrl: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat pro klub' }));
    expect(clubState().newBlock).toEqual({
      calendarIds: ['c1', 'c2'],
      fromDate: '2026-09-24',
      toDate: '2026-09-24',
      dailyFrom: '10:00',
      dailyTo: '11:00',
      ranges: [{ fromDate: '2026-09-24', toDate: '2026-09-24', dailyFrom: '10:00', dailyTo: '11:00' }],
    });
  });

  it('a place in the past is muted, struck through and left out of the club hand-off', async () => {
    await ready();
    mark('2026-09-21', 8 * 60, 8 * 60 + 30, { ctrl: true });
    expect(screen.getByRole('button', { name: 'Rezervovat pro klub' })).toBeDisabled();
    expect(screen.getByText('v minulosti')).toBeInTheDocument();
    expect(screen.getByTestId('picked-range')).toHaveAttribute('data-past', 'true');
    /* The block action still works for it. */
    expect(screen.getByRole('button', { name: 'Zablokovat čas' })).toBeEnabled();

    mark('2026-09-24', 10 * 60, 10 * 60 + 30, { ctrl: true });
    expect(screen.getByRole('button', { name: 'Rezervovat pro klub' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat pro klub' }));
    expect(clubState().newBlock.ranges).toEqual([
      { fromDate: '2026-09-24', toDate: '2026-09-24', dailyFrom: '10:00', dailyTo: '11:00' },
    ]);
  });

  it('offers Objednat pacienta only for exactly one time range', async () => {
    await ready();
    mark('2026-09-24', 10 * 60, 10 * 60, { ctrl: true });
    expect(screen.getByRole('button', { name: 'Objednat pacienta' })).toBeInTheDocument();
    mark('2026-09-24', 12 * 60, 12 * 60, { ctrl: true });
    expect(screen.queryByRole('button', { name: 'Objednat pacienta' })).not.toBeInTheDocument();
  });

  it('blocks every marked place with one reason', async () => {
    const createBlock = vi.fn().mockResolvedValue(undefined);
    (appointmentsApi as unknown as { createBlock: unknown }).createBlock = createBlock;
    await ready();
    mark('2026-09-23', 8 * 60, 8 * 60, { ctrl: true });
    mark('2026-09-24', 10 * 60, 10 * 60, { ctrl: true });
    fireEvent.click(screen.getByRole('button', { name: 'Zablokovat čas' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Školení' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Zablokovat/ }));
    await vi.waitFor(() => expect(createBlock).toHaveBeenCalledTimes(2));
    expect(createBlock.mock.calls.map((c) => c[0])).toEqual(['c1', 'c1']);
    await vi.waitFor(() => expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument());
  });
});

describe('several runs of days in the month', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('Ctrl drags add whole-day runs; the club hand-off carries them without a daily window', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    await screen.findByTestId('month-day-2026-09-23');
    const run = (from: string, to: string) => {
      fireEvent.pointerDown(screen.getByTestId('month-day-' + from), { button: 0, ctrlKey: true, pointerId: 1 });
      fireEvent.pointerEnter(screen.getByTestId('month-day-' + to), { pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 5, clientY: 5, pointerId: 1 });
    };
    run('2026-09-28', '2026-09-30');
    run('2026-09-23', '2026-09-24');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(chips()).toEqual(['28. 9. – 30. 9.', '23. 9. – 24. 9.']);
    expect(screen.getByTestId('month-day-2026-09-29')).toHaveAttribute('data-picked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat pro klub' }));
    expect(clubState().newBlock.ranges).toEqual([
      { fromDate: '2026-09-23', toDate: '2026-09-24' },
      { fromDate: '2026-09-28', toDate: '2026-09-30' },
    ]);
    expect(clubState().newBlock).toMatchObject({ fromDate: '2026-09-23', toDate: '2026-09-24' });
  });
});

describe('the touch toggle at tablet width', () => {
  beforeEach(() => setViewport(VIEWPORTS.tablet));

  it('turns plain taps into additive selection until switched off', async () => {
    await ready();
    const toggle = screen.getByRole('button', { name: 'Vybrat víc termínů' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    mark('2026-09-23', 8 * 60, 8 * 60);
    mark('2026-09-24', 10 * 60, 10 * 60);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('tray-chip')).toHaveLength(2);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    /* Off again: a plain drag starts over with the popover. */
    mark('2026-09-23', 12 * 60, 12 * 60);
    expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
