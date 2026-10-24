/* "Hodiny" on a calendar card (Kalendáře) opens the working hours of THAT calendar: the id comes in the router state. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listPeriods = vi.fn();
const cal = (id: string, name: string, sortOrder: number) => ({
  id, name, color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null, publicHorizonDays: null,
});
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([cal('c1', 'Ordinace 1', 0), cal('c2', 'Diagnostika', 1)]),
    getAccess: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../api/workingHours', () => ({
  workingHoursApi: {
    listPeriods, createPeriod: vi.fn(), listWorkingHours: vi.fn().mockResolvedValue([]), createWorkingHour: vi.fn(),
    updateWorkingHour: vi.fn(), deleteWorkingHour: vi.fn(), cycleDates: vi.fn().mockResolvedValue([]),
    updatePeriod: vi.fn(), deletePeriod: vi.fn(), listDayActivities: vi.fn().mockResolvedValue([]), saveDayActivities: vi.fn(),
  },
}));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { range: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } }));

const { default: WorkingHoursPage } = await import('./WorkingHoursPage');

const open = (state?: unknown) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/working-hours', state }]}>
        <WorkingHoursPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => listPeriods.mockReset().mockResolvedValue([]));

describe('working hours opened from a calendar card', () => {
  it('opens the calendar named in the router state', async () => {
    open({ calendarId: 'c2' });
    await waitFor(() => expect(listPeriods).toHaveBeenCalledWith('c2'));
    expect(listPeriods).not.toHaveBeenCalledWith('c1');
  });

  it('an id that is not a calendar here, or no state at all, opens the first calendar as before', async () => {
    open({ calendarId: 'gone' });
    await waitFor(() => expect(listPeriods).toHaveBeenCalledWith('c1'));
    listPeriods.mockClear();
    open();
    await waitFor(() => expect(listPeriods).toHaveBeenCalledWith('c1'));
  });
});
