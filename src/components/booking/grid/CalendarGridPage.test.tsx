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

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { holidaysApi } from '../../../api/holidays';
import { readPublicClinic, readSettings } from '../../../api/clinicSettings';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';

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
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1 },
    { id: 's2', name: 'Lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1 },
  ]);
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

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <CalendarGridPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sidebarSection = (name: string) => screen.getByRole('region', { name });

describe('the calendar screen', () => {
  it('draws every calendar side by side, with its bookings and blocks', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
    expect(screen.getByTestId('sub-column-c1-2026-09-23')).toBeInTheDocument();
    expect(screen.getByTestId('sub-column-c2-2026-09-23')).toBeInTheDocument();
    expect(await screen.findByText('· Porada', { exact: false })).toBeInTheDocument();
  });

  it('unticking a calendar takes its column and bookings away', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    fireEvent.click(within(sidebarSection('Kalendáře')).getByRole('checkbox', { name: 'Sportovní prohlídka' }));
    expect(screen.queryByRole('button', { name: /Vstupní prohlídka/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sub-column-c2-2026-09-23')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
  });

  it('clicking a calendar name shows only that one', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    fireEvent.click(within(sidebarSection('Kalendáře')).getByRole('button', { name: 'Sportovní prohlídka' }));
    expect(screen.queryByRole('button', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
  });

  it('the employee filter leaves only that worker’s days', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    fireEvent.click(within(sidebarSection('Pracovníci v zobrazeném období')).getByText('Anna Černá'));
    expect(screen.getByRole('button', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vstupní prohlídka/ })).not.toBeInTheDocument();
  });

  it('the service filter leaves only its calendars', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Vstupní prohlídka/ });
    fireEvent.click(within(sidebarSection('Služby')).getByText('Lékařské prohlídky'));
    expect(screen.queryByRole('button', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sub-column-c1-2026-09-23')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vstupní prohlídka/ })).toBeInTheDocument();
  });

  it('marks a day off, the online switch and the now-line in the set colour', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(await screen.findByText('Zavřeno')).toBeInTheDocument();
    expect(screen.getByTestId('day-number-2026-09-25')).toHaveStyle({ color: 'rgb(211, 47, 47)' });
    expect(await screen.findByText('Online objednávky vypnuty')).toBeInTheDocument();
    const line = await screen.findByTestId('now-line');
    await vi.waitFor(() => expect(line).toHaveStyle({ borderTopColor: 'rgb(106, 27, 154)' }));
    expect(screen.getByTestId('now-edge-left')).toBeInTheDocument();
  });

  it('offers no new booking to somebody without bookings.create', async () => {
    window.localStorage.setItem('permissions', JSON.stringify([]));
    renderPage();
    await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(screen.queryByRole('button', { name: 'Nové objednání' })).not.toBeInTheDocument();
    expect(readSettings).not.toHaveBeenCalled();
  });
});
