/*
 * The doctor's workspace: today's grid over the calendars the account sees,
 * and "Dnes čeká" counted from the same rows the list is drawn from.
 *
 * What would have to break for these to fail: counting somebody who arrived
 * or cancelled as waiting, a row without its calendar being drawn, the
 * by-činnost chips disagreeing with the list, or the confirmations not being
 * on the row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Calendar, DayAppointment } from '../api/bookingContracts';
import DoctorHome from './DoctorHome';
import { calendarsApi } from '../api/calendars';
import { appointmentsApi } from '../api/appointments';
import { activitiesApi } from '../api/activities';
import { holidaysApi } from '../api/holidays';
import { workingHoursApi } from '../api/workingHours';
import { patientsApi } from '../api/patients';

vi.mock('../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), daySummary: vi.fn(), blocks: vi.fn(), setStatus: vi.fn() },
}));
vi.mock('../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../api/holidays', () => ({ holidaysApi: { year: vi.fn() } }));
vi.mock('../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../api/displaySettings', () => ({
  useCalendarDisplay: () => ({
    settings: { defaultView: 'day', slotMinutes: 15, dayStartHour: 7, dayEndHour: 19, nowLineColor: '#D32F2F' },
    loaded: true,
  }),
}));
vi.mock('../api/attendanceSettings', () => ({
  useAttendanceSettings: () => ({ settings: { noShowAfterMinutes: 30, patientChangeDeadlineHours: 24 }, loaded: true }),
}));
vi.mock('../services/cashierApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/cashierApi')>();
  return { ...original, cashierApi: { getByAppointment: vi.fn().mockResolvedValue([]), createTransaction: vi.fn() } };
});

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace MUDr. Nové', color: '#1565C0', location: '', displayStepMinutes: 15,
  isActive: true, sortOrder: 0, clinicServiceId: 's1', publicMinimumNoticeMinutes: null,
  publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};

function row(id: string, patientId: string, activityName: string, status: number, startUtc: string): DayAppointment {
  return {
    id, calendarId: 'c1', patientId, activityId: 'a-' + activityName, activityName, startUtc,
    endUtc: new Date(new Date(startUtc).getTime() + 30 * 60_000).toISOString(), status,
    isRunningLate: false, checkedInUtc: status === 2 ? startUtc : null, paperwork: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T07:05:00Z')); // čt 24. 9. 09:05 Prague
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.edit', 'bookings.create']));

  vi.mocked(calendarsApi.list).mockResolvedValue([calendar]);
  vi.mocked(appointmentsApi.range).mockResolvedValue([
    row('ap1', 'p1', 'Spiroergometrie', 0, '2026-09-24T07:00:00Z'),
    row('ap2', 'p2', 'Vstupní prohlídka', 1, '2026-09-24T08:00:00Z'),
    row('ap3', 'p3', 'Spiroergometrie', 2, '2026-09-24T06:00:00Z'),
    row('ap4', 'p4', 'Spiroergometrie', 4, '2026-09-24T09:00:00Z'),
  ]);
  vi.mocked(appointmentsApi.daySummary).mockResolvedValue({
    date: '2026-09-24', booked: 2, arrived: 1, runningLate: 0, didNotCome: 0, cancelled: 1,
    byActivity: [], byCalendar: [], workingMinutes: 480, bookedMinutes: 90, unusedMinutes: 390,
    freeMinutesLeft: 300, paperwork: null, nextUp: null, absent: [],
  } as never);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(holidaysApi.year).mockResolvedValue([]);
  vi.mocked(workingHoursApi.preview).mockResolvedValue([
    {
      date: '2026-09-24', isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00',
      breakStart: null, breakEnd: null, workerUserId: 'u1', workerDisplayName: 'Jana Nová',
      isChangedByOverride: false, offeredActivityIds: [],
    },
  ]);
  vi.mocked(patientsApi.getById).mockImplementation(async (id: string) =>
    ({ id, firstName: 'Pacient', lastName: id.toUpperCase(), fullName: `Pacient ${id.toUpperCase()}` }) as never,
  );
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  vi.clearAllMocks();
});

function renderHome() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DoctorHome />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the doctor workspace', () => {
  it('counts only those still expected, and lists them by činnost', async () => {
    renderHome();

    expect(await screen.findByText('Dnes čeká: 2')).toBeInTheDocument();
    expect(screen.getByText('Přišlo: 1')).toBeInTheDocument();

    const byActivity = screen.getByLabelText('Podle činnosti');
    expect(within(byActivity).getByText('Spiroergometrie: 1')).toBeInTheDocument();
    expect(within(byActivity).getByText('Vstupní prohlídka: 1')).toBeInTheDocument();

    expect(await screen.findByText('Pacient P1')).toBeInTheDocument();
    expect(screen.getByText('Pacient P2')).toBeInTheDocument();
    /* Arrived and cancelled are not waiting. */
    expect(screen.queryByTestId('waiting-ap3')).toBeNull();
    expect(screen.queryByTestId('waiting-ap4')).toBeNull();
  });

  it('puts Přišel on every waiting row, one click away', async () => {
    renderHome();

    const first = await screen.findByTestId('waiting-ap1');
    expect(within(first).getByRole('button', { name: 'Přišel' })).toBeInTheDocument();
    /* 09:05 is five minutes after 09:00 - well inside the clinic's 30. */
    expect(within(first).queryByTestId('probably-absent')).toBeNull();
  });

  it('says whose calendar it is and the date, and nothing administrative', async () => {
    renderHome();

    expect(await screen.findByText(/24\. 9\. 2026/)).toBeInTheDocument();
    expect(screen.queryByText('Nastavení')).toBeNull();
    expect(screen.queryByText(/Fakturace/)).toBeNull();
  });
});
