import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage(state?: Record<string, unknown>) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/planovani', state }]}>
        <CalendarGridPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sidebarSection = (name: string) => screen.getByRole('region', { name });
/* The calendars to show and the worker live in the toolbar's "Kalendáře" menu. */
const openCalendarMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Kalendáře' }));
/* The menu is modal while it is open; the grid behind it is read once it has gone. */
const closeCalendarMenu = async () => {
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Kalendáře' }), { key: 'Escape' });
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kalendáře' })).not.toBeInTheDocument());
};

describe('the calendar screen', () => {
  it('draws every calendar side by side, with its bookings and blocks', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
    expect(screen.getByTestId('sub-column-c1-2026-09-23')).toBeInTheDocument();
    expect(screen.getByTestId('sub-column-c2-2026-09-23')).toBeInTheDocument();
    expect(await screen.findByText('Porada')).toBeInTheDocument();
  });

  it('titles the week the board’s way and switches views from the top bar', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(screen.getByRole('heading', { name: '21. — 27. září 2026' })).toBeInTheDocument();
    expect(screen.getByText('Krok mřížky 30 min · táhněte do stran pro posun v čase')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(screen.getByRole('heading', { name: 'Středa 23. září 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    /* Level 1: the mini calendar's own heading says the month too. */
    expect(screen.getByRole('heading', { level: 1, name: 'Září 2026' })).toBeInTheDocument();
    /* A wider range is fetched for the month, so the cells arrive with it. */
    expect(await screen.findByTestId('month-day-2026-09-23')).toBeInTheDocument();
  });

  it('the resolution toolbar steps the grid between hour, 30, 15 and 10 minutes', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    /* Etapa 12: "15 min" is a level of its own, so the picture and the label never disagree there. */
    fireEvent.click(screen.getByRole('button', { name: 'Jemnější mřížka' }));
    expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Krok mřížky 15 min · táhněte do stran pro posun v čase')).toBeInTheDocument();
    expect(window.localStorage.getItem('calendarZoom')).toBe('1.5');
    fireEvent.click(screen.getByRole('button', { name: 'Jemnější mřížka' }));
    expect(screen.getByRole('button', { name: '10 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Krok mřížky 10 min · táhněte do stran pro posun v čase')).toBeInTheDocument();
    expect(window.localStorage.getItem('calendarZoom')).toBe('2');
    expect(screen.getByRole('button', { name: 'Jemnější mřížka' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Hrubší mřížka' }));
    expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hodina' }));
    expect(screen.getByRole('button', { name: 'Hrubší mřížka' })).toBeDisabled();
    expect(window.localStorage.getItem('calendarZoom')).toBe('0.6');
  });

  it('unticking a calendar takes its column and bookings away', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    openCalendarMenu();
    fireEvent.click(within(sidebarSection('Kalendáře')).getByRole('checkbox', { name: 'Sportovní prohlídka' }));
    await closeCalendarMenu();
    expect(screen.queryByRole('button', { name: /Vstupní prohlídka/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sub-column-c2-2026-09-23')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
  });

  it('clicking a calendar name shows only that one', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    openCalendarMenu();
    fireEvent.click(within(sidebarSection('Kalendáře')).getByRole('button', { name: 'Sportovní prohlídka' }));
    await closeCalendarMenu();
    expect(screen.queryByRole('button', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
  });

  it('the employee filter leaves only that worker’s days', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    openCalendarMenu();
    fireEvent.click(within(sidebarSection('Pracovníci v zobrazeném období')).getByText('Anna Černá'));
    await closeCalendarMenu();
    expect(screen.getByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vstupní prohlídka/ })).not.toBeInTheDocument();
  });

  it('the service filter leaves only its calendars', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    fireEvent.click(within(sidebarSection('Služby')).getByRole('button', { name: /jen.*Lékařské prohlídky/ }));
    expect(screen.queryByRole('button', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sub-column-c1-2026-09-23')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
  });

  it('marks a day off, the online switch and the now-line in the set colour', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    /* "Zavřeno" is in the day header and again down the full-day closed block. */
    expect((await screen.findAllByText('Zavřeno')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('day-number-2026-09-25')).toHaveStyle({ color: 'rgb(211, 47, 47)' });
    expect(await screen.findByText('Online objednávky vypnuty')).toBeInTheDocument();
    const line = await screen.findByTestId('now-line');
    await vi.waitFor(() => expect(line).toHaveStyle({ borderTopColor: 'rgb(106, 27, 154)' }));
    expect(screen.getByTestId('now-edge-left')).toBeInTheDocument();
  });

  it('offers no new booking to somebody without bookings.create', async () => {
    window.localStorage.setItem('permissions', JSON.stringify([]));
    renderPage({ newAppointment: 1 });
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(screen.queryByRole('button', { name: 'Nová objednávka' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-appointment')).not.toBeInTheDocument();
    expect(readSettings).not.toHaveBeenCalled();
  });

  it('opens the booking on the next free half hour when the sidebar sends it here', async () => {
    renderPage({ newAppointment: 1 });
    /* 10:15 in Prague, 30-minute step, the first calendar's 09:00–10:00 is over: 10:30. */
    const dialog = await screen.findByTestId('new-appointment');
    expect(dialog).toHaveAttribute('data-calendar', 'c1');
    expect(dialog).toHaveAttribute('data-start', '2026-09-23T10:30');
    expect(dialog).toHaveAttribute('data-end', '2026-09-23T11:00');
  });

  it('the top bar’s "Nová objednávka" does the same, stepping over what is booked', async () => {
    vi.mocked(appointmentsApi.range).mockResolvedValue([
      { ...appointment('ap1', 'c1', 'Spiroergometrie'), startUtc: '2026-09-23T08:30:00Z', endUtc: '2026-09-23T09:30:00Z' },
    ]);
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(screen.queryByTestId('new-appointment')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    /* 10:30–11:30 is taken, so the next free half hour is 11:30. */
    const dialog = await screen.findByTestId('new-appointment');
    expect(dialog).toHaveAttribute('data-start', '2026-09-23T11:30');
    expect(dialog).toHaveAttribute('data-end', '2026-09-23T12:00');
  });
});

describe('"Nová objednávka" on a day the clinic is shut', () => {
  it('skips the weekend and opens Monday at opening time, moving the grid there', async () => {
    /* Saturday 26. 9. 2026, 10:15 in Prague. The clinic works Monday to Friday. */
    vi.setSystemTime(new Date('2026-09-26T08:15:00Z'));
    vi.mocked(workingHoursApi.preview).mockImplementation(async (calendarId, from, to) => {
      const rows: PreviewDay[] = [];
      for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
        const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
        const weekend = weekday === 0 || weekday === 6;
        rows.push({
          date: d,
          isOpen: !weekend,
          closedBecause: weekend ? 'notAWorkingDay' : null,
          startTime: weekend ? null : '08:00:00',
          endTime: weekend ? null : '16:00:00',
          breakStart: null,
          breakEnd: null,
          workerUserId: WORKER[calendarId][0],
          workerDisplayName: WORKER[calendarId][1],
          isChangedByOverride: false,
          offeredActivityIds: weekend ? [] : ['a'],
        });
      }
      return rows;
    });
    renderPage({ newAppointment: 1 });

    const dialog = await screen.findByTestId('new-appointment');
    expect(dialog).toHaveAttribute('data-calendar', 'c1');
    expect(dialog).toHaveAttribute('data-start', '2026-09-28T08:00');
    expect(dialog).toHaveAttribute('data-end', '2026-09-28T08:30');
    /* The month ahead was asked for, because the week on screen ends on Sunday. */
    expect(workingHoursApi.preview).toHaveBeenCalledWith('c1', '2026-09-26', '2026-10-27');
    /* And the grid followed: the week of Monday 28. 9. */
    expect(await screen.findByRole('heading', { name: '28. září — 4. října 2026' })).toBeInTheDocument();
  });
});

describe('a booking on a closed day', () => {
  it('is drawn on the week grid over the hatch and listed in the month', async () => {
    vi.mocked(appointmentsApi.range).mockResolvedValue([
      appointment('ap1', 'c1', 'Spiroergometrie'),
      /* Friday 25. 9. is "Firemní volno" - shut - and somebody was booked anyway. */
      { ...appointment('ap-off', 'c1', 'Sobotní prohlídka'), startUtc: '2026-09-25T07:00:00Z', endUtc: '2026-09-25T08:00:00Z' },
    ]);
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(screen.getByTestId('closed-block-2026-09-25')).toBeInTheDocument();
    const cell = screen.getByTestId('appointment-cell-ap-off');
    expect(within(cell).getByRole('button', { name: /Sobotní prohlídka/ })).toBeInTheDocument();
    expect(Number(getComputedStyle(cell).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(screen.getByTestId('closed-block-2026-09-25')).zIndex),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    const day = await screen.findByTestId('month-day-2026-09-25');
    expect(within(day).getByRole('button', { name: /Sobotní prohlídka/ })).toBeInTheDocument();
    expect(within(day).getByText(/Zavřeno · 1/)).toBeInTheDocument();
  });
});
