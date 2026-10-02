/*
 * Working hours without periods, clicked through.
 *
 * The part that only shows up by using the screen: that a calendar with no
 * period at all can still be given a timetable - the period is created behind
 * the scenes, open-ended, and never named - and that nothing on screen talks
 * about "období" any more.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const listPeriods = vi.fn();
const createPeriod = vi.fn();
const listWorkingHours = vi.fn();
const createWorkingHour = vi.fn();
const updateWorkingHour = vi.fn();
const deleteWorkingHour = vi.fn();
const cycleDates = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'c1', name: 'Sportovní diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15,
        isActive: true, sortOrder: 0, clinicServiceId: 's1',
        publicMinimumNoticeMinutes: null, publicHorizonDays: null,
      },
    ]),
    getAccess: vi.fn().mockResolvedValue([
      { userId: 'u1', displayName: 'MUDr. Novák', role: 'Staff', hasAccess: true, lockedBy: null },
    ]),
  },
}));

vi.mock('../../api/workingHours', () => ({
  workingHoursApi: {
    listPeriods, createPeriod, listWorkingHours, createWorkingHour,
    updateWorkingHour, deleteWorkingHour, cycleDates,
    updatePeriod: vi.fn(), deletePeriod: vi.fn(),
    listDayActivities: vi.fn().mockResolvedValue([]),
    saveDayActivities: vi.fn(),
  },
}));

vi.mock('../../api/activities', () => ({
  activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) },
}));

const { default: WorkingHoursPage } = await import('./WorkingHoursPage');

const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));

  listPeriods.mockReset().mockResolvedValue([]);
  createPeriod.mockReset().mockResolvedValue({ id: 'p-new', name: 'Pracovní doba', validFrom: '2026-09-21', validTo: null });
  listWorkingHours.mockReset().mockResolvedValue([]);
  createWorkingHour.mockReset().mockResolvedValue({});
  updateWorkingHour.mockReset().mockResolvedValue({});
  deleteWorkingHour.mockReset().mockResolvedValue(undefined);
  cycleDates.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('working hours without periods', () => {
  it('never talks about periods', async () => {
    render(withQueries(<WorkingHoursPage />));

    expect(await screen.findByText('Pondělí')).toBeInTheDocument();
    expect(screen.queryByText(/období/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Zimní/i)).not.toBeInTheDocument();
  });

  it('creates the hidden period on the first save, from this Monday and without an end', async () => {
    const user = userEvent.setup();
    render(withQueries(<WorkingHoursPage />));

    await user.click(await screen.findByRole('switch', { name: 'Pondělí: pracuje' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(createWorkingHour).toHaveBeenCalled());
    expect(createPeriod).toHaveBeenCalledWith('c1', {
      name: 'Pracovní doba',
      validFrom: '2026-09-21',
      validTo: null,
    });
    expect(createWorkingHour).toHaveBeenCalledWith(
      'c1',
      'p-new',
      expect.objectContaining({ dayOfWeek: 1, repeatEveryNWeeks: 1, weekOffset: 0 }),
    );
  });

  it('saves weeks A and B as the backend week cycle', async () => {
    const user = userEvent.setup();
    listPeriods.mockResolvedValue([{ id: 'p1', name: 'Pracovní doba', validFrom: '2026-01-05', validTo: null }]);
    listWorkingHours.mockResolvedValue([
      {
        id: 'mon', schedulePeriodId: 'p1', dayOfWeek: 1, startTime: '08:00:00', endTime: '16:00:00',
        breakStart: null, breakEnd: null, repeatEveryNWeeks: 1, weekOffset: 0,
        workerUserId: null, workerDisplayName: null,
      },
    ]);
    cycleDates.mockImplementation((...args: unknown[]) =>
      Promise.resolve(args[4] === 0 ? ['2026-09-21', '2026-10-05'] : ['2026-09-28', '2026-10-12']));

    render(withQueries(<WorkingHoursPage />));

    await user.click(await screen.findByRole('switch', { name: /lichém a sudém týdnu/ }));
    expect(await screen.findByText(/21\. 9\., 5\. 10\./)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Pondělí, týden B: pracuje' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    // Monday now works week A only: the every-week row goes, one A row comes.
    await waitFor(() => expect(createWorkingHour).toHaveBeenCalled());
    expect(deleteWorkingHour).toHaveBeenCalledWith('c1', 'mon');
    expect(createWorkingHour).toHaveBeenCalledWith(
      'c1',
      'p1',
      expect.objectContaining({ dayOfWeek: 1, repeatEveryNWeeks: 2, weekOffset: 0 }),
    );
    expect(createPeriod).not.toHaveBeenCalled();
  });

  it('will not save a break outside the day', async () => {
    const user = userEvent.setup();
    render(withQueries(<WorkingHoursPage />));

    const monday = (await screen.findByText('Pondělí')).closest('tr') as HTMLElement;
    await user.click(within(monday).getByRole('switch'));
    const [, , breakFrom, breakTo] = within(monday).getAllByLabelText(/^(Od|Do)$/);
    await user.type(breakFrom, '06:00');
    await user.type(breakTo, '06:30');

    expect(await screen.findByText('Pauza musí ležet uvnitř pracovní doby.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });
});
