/*
 * Rychlý plán, clicked through: the month plan laid over a year-round period
 * must say which period it cuts and wait for a yes; a single day is an
 * exception; bookings that fall outside the plan are counted before saving.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SchedulePeriod } from '../../../api/bookingContracts';

const createPeriod = vi.fn();
const updatePeriod = vi.fn();
const deletePeriod = vi.fn();
const createWorkingHour = vi.fn();
const deleteWorkingHour = vi.fn();
const saveDayActivities = vi.fn();
const periodImpact = vi.fn();
const listWorkingHours = vi.fn();
const listDayActivities = vi.fn();
const listExceptions = vi.fn();
const createException = vi.fn();
const deleteException = vi.fn();
const range = vi.fn();

vi.mock('../../../api/workingHours', () => ({
  workingHoursApi: {
    createPeriod, updatePeriod, deletePeriod, createWorkingHour, deleteWorkingHour, saveDayActivities,
    periodImpact, listWorkingHours, listDayActivities, listExceptions, createException, deleteException,
  },
}));

vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range } }));

const activity = (id: string, name: string, sortOrder: number, extra: object = {}) => ({
  id, name, slug: id, durationMinutes: 30, color: '#22C55E', publicNote: '', isPubliclyBookable: true,
  sortOrder, isActive: true, clinicServiceId: 's1', ...extra,
});

vi.mock('../../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [
        activity('a1', 'Základní prohlídka', 1),
        activity('a2', 'Komplexní prohlídka', 2),
        activity('a3', 'Cizí služba', 3, { clinicServiceId: 'other' }),
      ],
      warnings: [],
    }),
  },
}));

const { QuickPlanDialog } = await import('./QuickPlanDialog');

const yearRound: SchedulePeriod = { id: 'p1', name: 'Celoroční provoz', validFrom: '2026-01-01', validTo: null };

const renderDialog = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const dialog = (onSaved = vi.fn(), onClose = vi.fn(), periods = [yearRound]) => (
  <QuickPlanDialog
    open
    onClose={onClose}
    calendarId="c1"
    calendarName="Ordinace 1"
    clinicServiceId="s1"
    periods={periods}
    onSaved={onSaved}
  />
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T10:00:00Z'));

  for (const fn of [
    createPeriod, updatePeriod, deletePeriod, createWorkingHour, deleteWorkingHour, saveDayActivities,
    periodImpact, listWorkingHours, listDayActivities, listExceptions, createException, deleteException, range,
  ]) {
    fn.mockReset();
  }
  createPeriod.mockImplementation(async (_c: string, input: { name: string }) => ({
    id: input.name.startsWith('Plán') ? 'plan-1' : 'tail-1',
  }));
  updatePeriod.mockResolvedValue({});
  createWorkingHour.mockResolvedValue({});
  saveDayActivities.mockResolvedValue({ rows: [], warnings: [] });
  periodImpact.mockResolvedValue({ periodId: 'p1', validFrom: '', validTo: null, appointments: [], token: null });
  listWorkingHours.mockResolvedValue([
    {
      id: 'r1', schedulePeriodId: 'p1', dayOfWeek: 1, startTime: '08:00:00', endTime: '18:00:00',
      breakStart: '12:00:00', breakEnd: '12:30:00', repeatEveryNWeeks: 1, weekOffset: 0,
      workerUserId: null, workerDisplayName: null, isActive: true,
    },
  ]);
  listDayActivities.mockResolvedValue({ rows: [{ dayOfWeek: 1, activityIds: ['a1', 'a2'] }], warnings: [] });
  listExceptions.mockResolvedValue([]);
  createException.mockResolvedValue({});
  deleteException.mockResolvedValue(undefined);
  range.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Rychlý plán', () => {
  it('offers only the činnosti the calendar can offer, all on, and a live preview', async () => {
    renderDialog(dialog());

    expect(await screen.findByLabelText(/Základní prohlídka/)).toBeChecked();
    expect(screen.getByLabelText(/Komplexní prohlídka/)).toBeChecked();
    expect(screen.queryByLabelText(/Cizí služba/)).not.toBeInTheDocument();

    expect(screen.getByTestId('plan-preview')).toHaveTextContent(
      'Po–Pá 08:00–18:00, 2 činnosti, 1. 10. – 31. 10. 2026',
    );
  });

  it('keeps the preview in step with the chosen days, hours, break and činnosti', async () => {
    const user = userEvent.setup();
    renderDialog(dialog());

    await user.click(await screen.findByRole('checkbox', { name: 'Pátek' }));
    await user.type(screen.getByLabelText('Přestávka od'), '12:00');
    await user.type(screen.getByLabelText('Přestávka do'), '12:30');
    await user.click(screen.getByLabelText(/Komplexní prohlídka/));

    expect(screen.getByTestId('plan-preview')).toHaveTextContent(
      'Po–Čt 08:00–18:00, přestávka 12:00–12:30, 1 činnost, 1. 10. – 31. 10. 2026',
    );
  });

  it('will not save a month over a period until the person has agreed to the cut', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    periodImpact.mockResolvedValue({
      periodId: 'p1', validFrom: '2026-01-01', validTo: '2026-09-30', appointments: [], token: 'tok-1',
    });
    renderDialog(dialog(onSaved, onClose));

    const warning = await screen.findByTestId('plan-conflicts');
    expect(warning).toHaveTextContent('„Celoroční provoz“');
    expect(warning).toHaveTextContent('rozdělí');
    expect(warning).toHaveTextContent('do 30. 9. 2026');
    expect(warning).toHaveTextContent('od 1. 11. 2026');

    const save = screen.getByRole('button', { name: 'Uložit plán' });
    await waitFor(() => expect(screen.getByText(/zatím nejsou žádné rezervace/)).toBeInTheDocument());
    expect(save).toBeDisabled();

    await user.click(within(warning).getByRole('checkbox'));
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updatePeriod).toHaveBeenCalledWith(
      'c1', 'p1',
      { name: 'Celoroční provoz', validFrom: '2026-01-01', validTo: '2026-09-30' },
      'tok-1',
    );
    expect(createPeriod).toHaveBeenNthCalledWith(1, 'c1', {
      name: 'Plán 1.–31. 10. 2026', validFrom: '2026-10-01', validTo: '2026-10-31',
    });
    expect(createWorkingHour).toHaveBeenCalledWith(
      'c1', 'plan-1',
      expect.objectContaining({ dayOfWeek: 5, startTime: '08:00', endTime: '18:00', repeatEveryNWeeks: 1 }),
    );
    expect(saveDayActivities).toHaveBeenCalledWith(
      'c1', 'plan-1',
      expect.arrayContaining([
        { dayOfWeek: 1, activityIds: ['a1', 'a2'] },
        { dayOfWeek: 6, activityIds: [] },
      ]),
    );
    // the rest of the year comes back as a copy of what was there
    expect(createPeriod).toHaveBeenNthCalledWith(2, 'c1', {
      name: 'Celoroční provoz', validFrom: '2026-11-01', validTo: null,
    });
    expect(createWorkingHour).toHaveBeenCalledWith('c1', 'tail-1', expect.objectContaining({ dayOfWeek: 1 }));
    expect(onSaved).toHaveBeenCalledWith('Plán „Plán 1.–31. 10. 2026“ je uložen.');
    // the cut is always made before the plan goes in: periods may never overlap
    expect(updatePeriod.mock.invocationCallOrder[0]).toBeLessThan(createPeriod.mock.invocationCallOrder[0]);
  });

  it('counts the bookings that fall outside the new plan and asks for a yes', async () => {
    const user = userEvent.setup();
    range.mockResolvedValue([
      // Saturday 3. 10., 09:00 Prague - the plan is Po-Pá
      { id: 'sat', startUtc: '2026-10-03T07:00:00Z', endUtc: '2026-10-03T07:30:00Z', status: 1, activityId: 'a1' },
      // Monday 5. 10., 09:00 - fits
      { id: 'mon', startUtc: '2026-10-05T07:00:00Z', endUtc: '2026-10-05T07:30:00Z', status: 1, activityId: 'a1' },
    ]);
    renderDialog(dialog());

    const impact = await screen.findByTestId('plan-impact');
    expect(impact).toHaveTextContent('1 rezervace by byla mimo nový plán.');
    expect(range).toHaveBeenCalledWith('2026-10-01', '2026-10-31', ['c1']);

    await user.click(within(screen.getByTestId('plan-conflicts')).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Uložit plán' })).toBeDisabled();
    await user.click(within(impact).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Uložit plán' })).toBeEnabled();
  });

  it('does not save at all when the bookings could not be checked', async () => {
    range.mockRejectedValue(new Error('boom'));
    renderDialog(dialog());

    expect(await screen.findByText(/Nepodařilo se ověřit rezervace/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit plán' })).toBeDisabled();
  });

  it('adds a plan beside the periods when nothing overlaps - no confirmation needed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(dialog(vi.fn(), onClose, [{ id: 'old', name: 'Loni', validFrom: '2025-01-01', validTo: '2025-12-31' }]));

    expect(screen.queryByTestId('plan-conflicts')).not.toBeInTheDocument();
    const save = await screen.findByRole('button', { name: 'Uložit plán' });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updatePeriod).not.toHaveBeenCalled();
    expect(createPeriod).toHaveBeenCalledTimes(1);
  });

  it('saves one day as the existing exception and says činnosti stay the weekday\'s', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderDialog(dialog(onSaved));

    await user.click(await screen.findByRole('button', { name: 'Den' }));
    const date = screen.getByLabelText('Datum');
    await user.clear(date);
    await user.type(date, '2026-10-09');

    expect(screen.getByText(/Činnosti a přestávka se pro jediný den nastavit nedají/)).toBeInTheDocument();
    expect(screen.getByText(/platí ty z pátku/)).toBeInTheDocument();

    await user.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByTestId('plan-preview')).toHaveTextContent('Pátek 9. 10. 2026: zavřeno'));
    const save = screen.getByRole('button', { name: 'Uložit plán' });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ date: '2026-10-09', isClosed: true, startTime: null, endTime: null }),
    );
    expect(createPeriod).not.toHaveBeenCalled();
    expect(deleteException).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('Výjimka pro 9. 10. 2026 je uložena.');
  });

  it('replaces an existing exception on that day only after a yes', async () => {
    const user = userEvent.setup();
    listExceptions.mockResolvedValue([
      { id: 'ex1', date: '2026-10-03', isClosed: true, startTime: null, endTime: null, workerUserId: null, reason: 'Dovolená', isClosedToPublic: true },
    ]);
    renderDialog(dialog());

    await user.click(await screen.findByRole('button', { name: 'Den' }));
    const warning = await screen.findByText(/už výjimka existuje/);
    const save = screen.getByRole('button', { name: 'Uložit plán' });
    expect(save).toBeDisabled();

    await user.click(within(warning.closest('[role="alert"]') as HTMLElement).getByRole('checkbox'));
    await user.click(save);

    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(deleteException).toHaveBeenCalledWith('c1', 'ex1');
    expect(deleteException.mock.invocationCallOrder[0]).toBeLessThan(createException.mock.invocationCallOrder[0]);
  });
});
