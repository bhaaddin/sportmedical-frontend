/*
 * Settings audit (20. 10. 2026) - Otevírací doba (/working-hours), the screen.
 *
 * Followed from the rows GET /api/calendars/{id}/periods/{pid}/working-hours
 * returns (HH:mm:ss, no isActive) to the rows the save builds. Fixed here:
 * the worker list offered every account of the access list, including the ones
 * NOT ticked for the calendar (`hasAccess: false`) - the comment above it said
 * "the people who can see this calendar" and the code did not filter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listPeriods = vi.fn();
const createPeriod = vi.fn();
const updatePeriod = vi.fn();
const deletePeriod = vi.fn();
const listWorkingHours = vi.fn();
const createWorkingHour = vi.fn();
const updateWorkingHour = vi.fn();
const deleteWorkingHour = vi.fn();
const cycleDates = vi.fn();
const getAccess = vi.fn();
const listCalendars = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars, getAccess } }));
vi.mock('../../api/workingHours', () => ({
  workingHoursApi: {
    listPeriods, createPeriod, updatePeriod, deletePeriod, listWorkingHours, createWorkingHour, updateWorkingHour, deleteWorkingHour, cycleDates,
    listDayActivities: vi.fn().mockResolvedValue({ rows: [], warnings: [] }), saveDayActivities: vi.fn(),
  },
}));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { range: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } }));

const { default: WorkingHoursPage } = await import('./WorkingHoursPage');

const calendar = (id: string, name: string) => ({
  id, name, color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const period = (over: Record<string, unknown> = {}) => ({ id: 'p1', name: 'Pracovní doba', validFrom: '2026-01-05', validTo: null, ...over });
const hour = (over: Record<string, unknown> = {}) => ({
  id: 'mon', schedulePeriodId: 'p1', dayOfWeek: 1, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00',
  repeatEveryNWeeks: 1, weekOffset: 0, workerUserId: null, workerDisplayName: null, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  listCalendars.mockReset().mockResolvedValue([calendar('c1', 'Diagnostika'), calendar('c2', 'InBody')]);
  getAccess.mockReset().mockResolvedValue([
    { userId: 'u1', displayName: 'MUDr. Novák', role: 'Owner', hasAccess: true, lockedBy: 'role' },
    { userId: 'u2', displayName: 'Bez přístupu', role: 'Staff', hasAccess: false, lockedBy: null },
  ]);
  listPeriods.mockReset().mockResolvedValue([period()]);
  listWorkingHours.mockReset().mockResolvedValue([hour()]);
  createPeriod.mockReset().mockResolvedValue(period({ id: 'p-new', validFrom: '2026-10-19' }));
  updatePeriod.mockReset().mockResolvedValue(period());
  deletePeriod.mockReset().mockResolvedValue(undefined);
  createWorkingHour.mockReset().mockResolvedValue({});
  updateWorkingHour.mockReset().mockResolvedValue({});
  deleteWorkingHour.mockReset().mockResolvedValue(undefined);
  cycleDates.mockReset().mockResolvedValue([]);
});

const monday = async () => (await screen.findByText('Pondělí')).closest('tr') as HTMLElement;
const timeFields = (row: HTMLElement) => within(row).getAllByLabelText(/^(Od|Do)$/) as HTMLInputElement[];

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('reading the stored week · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the times without seconds, the lunch break and the worker', async () => {
    listWorkingHours.mockResolvedValue([hour({ workerUserId: 'u1', workerDisplayName: 'MUDr. Novák' })]);
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const row = await monday();
    expect(timeFields(row).map((f) => f.value)).toEqual(['08:00', '16:00', '12:00', '12:30']);
    expect(within(row).getByRole('switch')).toBeChecked();
    expect(within(row).getByRole('combobox', { name: 'Pracovník' })).toHaveTextContent('MUDr. Novák');
  });

  it('shows the days without a row as off, with the times disabled', async () => {
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const tuesday = (await screen.findByText('Úterý')).closest('tr') as HTMLElement;
    expect(within(tuesday).getByRole('switch')).not.toBeChecked();
    expect(timeFields(tuesday).every((f) => f.disabled)).toBe(true);
  });
});

describe('the worker list', () => {
  it('offers only the accounts ticked for this calendar', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const row = await monday();
    await waitFor(() => expect(getAccess).toHaveBeenCalledWith('c1'));
    await user.click(within(row).getByRole('combobox', { name: 'Pracovník' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Nikdo', 'MUDr. Novák']);
  });

  it('still shows a worker who is on a day but no longer has access, as a name that did not load, instead of dropping the choice', async () => {
    listWorkingHours.mockResolvedValue([hour({ workerUserId: 'u2' })]);
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const row = await monday();
    expect(within(row).getByRole('combobox', { name: 'Pracovník' })).toHaveTextContent('jméno se nenačetlo');
  });

  it('reads the access list again for the calendar that was picked', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    await monday();
    await user.click(screen.getByRole('combobox', { name: 'Kalendář' }));
    await user.click(screen.getByRole('option', { name: 'InBody' }));
    await waitFor(() => expect(getAccess).toHaveBeenCalledWith('c2'));
    expect(listPeriods).toHaveBeenCalledWith('c2');
  });
});

describe('saving', () => {
  const edit = async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const row = await monday();
    return { user, row };
  };

  it('keeps Uložit off until something changes', async () => {
    await edit();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Vrátit změny' })).not.toBeInTheDocument();
  });

  it('sends the changed end as HH:mm to the row it belongs to', async () => {
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '17:15');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateWorkingHour).toHaveBeenCalled());
    expect(updateWorkingHour).toHaveBeenCalledWith('c1', 'mon', expect.objectContaining({
      dayOfWeek: 1, startTime: '08:00', endTime: '17:15', breakStart: '12:00', breakEnd: '12:30', repeatEveryNWeeks: 1, weekOffset: 0, isActive: true,
    }));
    expect(createWorkingHour).not.toHaveBeenCalled();
    expect(deleteWorkingHour).not.toHaveBeenCalled();
  });

  it('clearing the lunch break sends it as removed (null)', async () => {
    const { user, row } = await edit();
    const fields = timeFields(row);
    await user.clear(fields[2]);
    await user.clear(fields[3]);
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateWorkingHour).toHaveBeenCalled());
    expect(updateWorkingHour.mock.calls[0][2]).toMatchObject({ breakStart: null, breakEnd: null });
  });

  it('turning Monday off deletes its row and nothing else', async () => {
    const { user, row } = await edit();
    await user.click(within(row).getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(deleteWorkingHour).toHaveBeenCalledWith('c1', 'mon'));
    expect(updateWorkingHour).not.toHaveBeenCalled();
    expect(createWorkingHour).not.toHaveBeenCalled();
  });

  it('turning Wednesday on creates it in the existing period with 08:00-16:00 and no lunch break', async () => {
    const { user } = await edit();
    const wednesday = (await screen.findByText('Středa')).closest('tr') as HTMLElement;
    await user.click(within(wednesday).getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createWorkingHour).toHaveBeenCalled());
    expect(createWorkingHour).toHaveBeenCalledWith('c1', 'p1', {
      dayOfWeek: 3, startTime: '08:00', endTime: '16:00', breakStart: null, breakEnd: null, workerUserId: null, isActive: true, repeatEveryNWeeks: 1, weekOffset: 0,
    });
    expect(createPeriod).not.toHaveBeenCalled();
  });

  it('does not send a day whose end is before its start, and says why at the day', async () => {
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '07:00');
    expect(within(row).getByText('Konec musí být později než začátek.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('puts the stored week back with "Vrátit změny", without a request', async () => {
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '17:00');
    await user.click(screen.getByRole('button', { name: 'Vrátit změny' }));
    expect(timeFields(await monday())[1]).toHaveValue('16:00');
    expect(updateWorkingHour).not.toHaveBeenCalled();
  });

  it('after a failed request says what is really stored and keeps showing that', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    updateWorkingHour.mockRejectedValue(new BookingApiError('domainRule', 422, 'Pauza musí ležet uvnitř pracovní doby.'));
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '17:00');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Pauza musí ležet uvnitř pracovní doby\. Zobrazeno je to, co je teď opravdu uložené\./)).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    updateWorkingHour.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '17:00');
    await user.dblClick(screen.getByRole('button', { name: 'Uložit' }));
    expect(updateWorkingHour).toHaveBeenCalledTimes(1);
    finish({});
  });

  it('shows "Uloženo." after the save and the reread rows match what was sent', async () => {
    listWorkingHours.mockResolvedValueOnce([hour()]).mockResolvedValue([hour({ endTime: '17:00:00' })]);
    const { user, row } = await edit();
    const [, to] = timeFields(row);
    await user.clear(to);
    await user.type(to, '17:00');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
    expect(timeFields(await monday())[1]).toHaveValue('17:00');
  });
});

describe('a calendar with no timetable yet', () => {
  it('creates the period on the first save, from this Monday (Prague), without an end', async () => {
    listPeriods.mockResolvedValue([]);
    listWorkingHours.mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    const row = await monday();
    await user.click(within(row).getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createPeriod).toHaveBeenCalledWith('c1', { name: 'Pracovní doba', validFrom: '2026-10-19', validTo: null }));
    await waitFor(() => expect(createWorkingHour).toHaveBeenCalledWith('c1', 'p-new', expect.objectContaining({ dayOfWeek: 1 })));
  });
});

describe('the period behind the scenes', () => {
  it('says a timetable that starts later cannot be booked yet', async () => {
    listPeriods.mockResolvedValue([period({ validFrom: '2026-12-01' })]);
    renderScreen(<WorkingHoursPage />, '/working-hours');
    expect(await screen.findByText(/začne platit/)).toBeInTheDocument();
  });

  it('offers "Platit bez konce" for a timetable that ends, and sends the same period with no end', async () => {
    listPeriods.mockResolvedValue([period({ validTo: '2026-12-31' })]);
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    await user.click(await screen.findByRole('button', { name: 'Platit bez konce' }));
    await waitFor(() => expect(updatePeriod).toHaveBeenCalledWith('c1', 'p1', { name: 'Pracovní doba', validFrom: '2026-01-05', validTo: null }));
  });

  it('lists left-over plans that are still in force and deletes one only after asking', async () => {
    listPeriods.mockResolvedValue([period(), period({ id: 'p2', name: 'Plán říjen', validFrom: '2026-11-01', validTo: '2026-11-30' })]);
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    expect(await screen.findByText(/Plán říjen/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(deletePeriod).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Smazat' }));
    await waitFor(() => expect(deletePeriod).toHaveBeenCalledWith('c1', 'p2'));
  });

  it('does not list a left-over plan that ended before today', async () => {
    listPeriods.mockResolvedValue([period(), period({ id: 'p0', name: 'Starý plán', validFrom: '2025-01-01', validTo: '2025-12-31' })]);
    renderScreen(<WorkingHoursPage />, '/working-hours');
    await monday();
    expect(screen.queryByText(/Starý plán/)).not.toBeInTheDocument();
  });
});

describe('weeks A and B', () => {
  it('turning alternation on shows both weeks per day, and week B starts as a copy of week A', async () => {
    cycleDates.mockImplementation((...args: unknown[]) => Promise.resolve(args[4] === 0 ? ['2026-10-19', '2026-11-02'] : ['2026-10-26', '2026-11-09']));
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    await monday();
    await user.click(screen.getByRole('switch', { name: /lichém a sudém týdnu/ }));
    expect(screen.getByRole('switch', { name: 'Pondělí, týden A: pracuje' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Pondělí, týden B: pracuje' })).toBeChecked();
    expect(await screen.findByText(/19\. 10\., 2\. 11\./)).toBeInTheDocument();
  });

  it('lets week B end earlier than week A and stores the two as 2/0 and 2/1', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderScreen(<WorkingHoursPage />, '/working-hours');
    await monday();
    await user.click(screen.getByRole('switch', { name: /lichém a sudém týdnu/ }));
    const weekB = (screen.getAllByText('B').map((cell) => cell.closest('tr') as HTMLElement))[0];
    const [, to] = timeFields(weekB);
    await user.clear(to);
    await user.type(to, '14:00');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createWorkingHour).toHaveBeenCalledTimes(2));
    expect(deleteWorkingHour).toHaveBeenCalledWith('c1', 'mon');
    const cycles = createWorkingHour.mock.calls.map((call) => [call[2].repeatEveryNWeeks, call[2].weekOffset, call[2].endTime]);
    expect(cycles).toEqual([[2, 0, '16:00'], [2, 1, '14:00']]);
  });
});
