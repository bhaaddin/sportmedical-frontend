/*
 * Settings audit (20. 10. 2026) - Výjimky (/exceptions).
 *
 * Measured on the dev API (POST /api/calendars/{id}/exceptions):
 *   different hours without both times      -> 422 scheduling.exception.hours_required
 *   end not after start                     -> 422 scheduling.exception.end_before_start
 *   a second exception on the same date     -> 409 "Na tento den už výjimka existuje."
 *   a closed day is stored with isClosedToPublic: true
 *   reason longer than 300                  -> 422 scheduling.text.too_long
 *   the list without ?from&to               -> 400 (so the screen always names its window)
 * The "jiný čas" form used to be saveable empty; it now says what is missing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { EXCEPTION_PROBLEM_TEXT, exceptionProblem } from './exceptionForm';
import type { ScheduleExceptionInput } from '../../api/bookingContracts';

const listExceptions = vi.fn();
const createException = vi.fn();
const deleteException = vi.fn();
const getAccess = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null },
      { id: 'c2', name: 'InBody', color: '#2563EB', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null },
    ]),
    getAccess,
  },
}));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { listExceptions, createException, deleteException } }));

const { default: ExceptionsPage } = await import('./ExceptionsPage');

const exception = (over: Record<string, unknown> = {}) => ({
  id: 'e1', date: '2026-10-26', isClosed: true, startTime: null, endTime: null, workerUserId: null, reason: 'Zavřeno', isClosedToPublic: true, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listExceptions.mockReset().mockResolvedValue([]);
  createException.mockReset().mockResolvedValue(exception());
  deleteException.mockReset().mockResolvedValue(undefined);
  getAccess.mockReset().mockResolvedValue([
    { userId: 'u1', displayName: 'MUDr. Novák', role: 'Owner', hasAccess: true, lockedBy: 'role' },
    { userId: 'u2', displayName: 'Bez přístupu', role: 'Staff', hasAccess: false, lockedBy: null },
  ]);
});

const draft = (over: Partial<ScheduleExceptionInput> = {}): ScheduleExceptionInput => ({
  date: '2026-10-26', isClosed: false, startTime: null, endTime: null, workerUserId: null, reason: '', isClosedToPublic: false, ...over,
});

describe('exceptionProblem', () => {
  it.each([
    ['closed', draft({ isClosed: true }), null],
    ['onlineOff', draft({ isClosedToPublic: true }), null],
    ['differentHours', draft({ startTime: '08:00', endTime: '12:00' }), null],
    ['differentHours', draft({ startTime: '08:00:00', endTime: '12:00:00' }), null],
    ['differentHours', draft(), 'hoursMissing'],
    ['differentHours', draft({ startTime: '08:00' }), 'hoursMissing'],
    ['differentHours', draft({ endTime: '08:00' }), 'hoursMissing'],
    ['differentHours', draft({ startTime: '12:00', endTime: '08:00' }), 'hoursOrder'],
    ['differentHours', draft({ startTime: '10:00', endTime: '10:00' }), 'hoursOrder'],
    ['differentWorker', draft({ workerUserId: 'u1' }), null],
    ['differentWorker', draft(), 'worker'],
    ['closed', draft({ date: '' }), 'date'],
    ['closed', draft({ date: '26.10.2026' }), 'date'],
  ] as const)('%s %#', (kind, input, expected) => {
    expect(exceptionProblem(kind, input)).toBe(expected);
  });

  it('has a Czech sentence for every problem', () => {
    expect(Object.keys(EXCEPTION_PROBLEM_TEXT).sort()).toEqual(['date', 'hoursMissing', 'hoursOrder', 'worker']);
  });
});

const open = async () => {
  const user = userEvent.setup();
  renderScreen(<ExceptionsPage />, '/exceptions');
  await user.click(await screen.findByRole('button', { name: 'Nová výjimka' }));
  const dialog = await screen.findByRole('dialog');
  return { user, dialog };
};

const pickKind = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) => {
  await user.click(within(dialog).getByRole('combobox', { name: 'Typ' }));
  await user.click(await screen.findByRole('option', { name }));
};

describe('the list', () => {
  it('asks for a bounded window (-90 to +365 days) and names it, because the server refuses an open range', async () => {
    renderScreen(<ExceptionsPage />, '/exceptions');
    await waitFor(() => expect(listExceptions).toHaveBeenCalled());
    const [calendarId, from, to] = listExceptions.mock.calls[0];
    expect(calendarId).toBe('c1');
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    expect(days).toBe(455);
  });

  it('shows closed, different hours and a stand-in with their own kind and detail', async () => {
    listExceptions.mockResolvedValue([
      exception({ id: 'a', date: '2026-10-26' }),
      exception({ id: 'b', date: '2026-10-27', isClosed: false, startTime: '10:00:00', endTime: '14:30:00', reason: 'Servis', isClosedToPublic: false }),
      exception({ id: 'c', date: '2026-10-28', isClosed: false, workerUserId: 'u1', reason: '', isClosedToPublic: false }),
    ]);
    renderScreen(<ExceptionsPage />, '/exceptions');
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(within(rows[0]).getByText('Zavřeno', { selector: '.MuiChip-label' })).toBeInTheDocument();
    expect(within(rows[1]).getByText('Jiný čas')).toBeInTheDocument();
    expect(within(rows[1]).getByText('10:00–14:30')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Servis')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Jiný pracovník')).toBeInTheDocument();
    expect(within(rows[2]).getByText('MUDr. Novák')).toBeInTheDocument();
  });

  it('marks "different hours" that are also off the web with a second chip', async () => {
    listExceptions.mockResolvedValue([exception({ isClosed: false, startTime: '10:00:00', endTime: '12:00:00', isClosedToPublic: true })]);
    renderScreen(<ExceptionsPage />, '/exceptions');
    const row = (await screen.findAllByRole('row'))[1];
    expect(within(row).getByText('Jiný čas')).toBeInTheDocument();
    expect(within(row).getByText('Online objednávky vypnuty')).toBeInTheDocument();
  });

  it('switches calendars and reads that calendar’s exceptions', async () => {
    const user = userEvent.setup();
    renderScreen(<ExceptionsPage />, '/exceptions');
    await user.click(await screen.findByRole('combobox', { name: 'Kalendář' }));
    await user.click(screen.getByRole('option', { name: 'InBody' }));
    await waitFor(() => expect(listExceptions.mock.calls.some((call) => call[0] === 'c2')).toBe(true));
  });

  it('deletes with one click and reads the list again', async () => {
    listExceptions.mockResolvedValue([exception()]);
    const user = userEvent.setup();
    renderScreen(<ExceptionsPage />, '/exceptions');
    await user.click(await screen.findByRole('button', { name: 'Smazat' }));
    await waitFor(() => expect(deleteException).toHaveBeenCalledWith('c1', 'e1'));
    await waitFor(() => expect(listExceptions.mock.calls.length).toBeGreaterThan(1));
  });
});

describe('a new exception', () => {
  it('"Zavřeno" is the default and sends isClosed true, no hours, no worker', async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Důvod'), 'Školení');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException).toHaveBeenCalledWith('c1', {
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), isClosed: true, startTime: null, endTime: null, workerUserId: null, reason: 'Školení', isClosedToPublic: false,
    });
  });

  it('"Online objednávky vypnuty" sends only isClosedToPublic', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Online objednávky vypnuty');
    expect(within(dialog).getByText(/jen přes internet si termín nikdo nevezme/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException.mock.calls[0][1]).toMatchObject({ isClosed: false, isClosedToPublic: true, startTime: null, endTime: null, workerUserId: null });
  });

  it('"Jiný čas" opens with 08:00-16:00 and sends the hours as typed', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Jiný čas');
    expect(within(dialog).getByLabelText('Od')).toHaveValue('08:00');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('16:00');
    const to = within(dialog).getByLabelText('Do');
    await user.clear(to);
    await user.type(to, '13:30');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException.mock.calls[0][1]).toMatchObject({ isClosed: false, startTime: '08:00', endTime: '13:30' });
  });

  it('"Jiný čas" with an end before the start says so and cannot be saved', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Jiný čas');
    const to = within(dialog).getByLabelText('Do');
    await user.clear(to);
    await user.type(to, '07:00');
    expect(within(dialog).getByText('Konec musí být později než začátek.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('"Jiný čas" with a time cleared says both are needed and cannot be saved', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Jiný čas');
    await user.clear(within(dialog).getByLabelText('Od'));
    expect(within(dialog).getByText('Jiné hodiny potřebují začátek i konec.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('"Jiný pracovník" offers only the accounts ticked for this calendar and needs one', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Jiný pracovník');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: 'Pracovník' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['MUDr. Novák']);
    await user.click(screen.getByRole('option', { name: 'MUDr. Novák' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException.mock.calls[0][1]).toMatchObject({ workerUserId: 'u1', isClosed: false, startTime: null });
  });

  it('switching the kind starts the form over, so hours typed for one kind do not leak into another', async () => {
    const { user, dialog } = await open();
    await pickKind(user, dialog, 'Jiný čas');
    await user.clear(within(dialog).getByLabelText('Do'));
    await user.type(within(dialog).getByLabelText('Do'), '11:00');
    await pickKind(user, dialog, 'Zavřeno');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException.mock.calls[0][1]).toMatchObject({ isClosed: true, startTime: null, endTime: null });
  });

  it('keeps the date when the kind changes', async () => {
    const { user, dialog } = await open();
    const date = within(dialog).getByLabelText(/^Datum/);
    await user.clear(date);
    await user.type(date, '2026-12-24');
    await pickKind(user, dialog, 'Online objednávky vypnuty');
    expect(within(dialog).getByLabelText(/^Datum/)).toHaveValue('2026-12-24');
  });

  it('stops the reason at 300 characters, which is all the server keeps', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByLabelText('Důvod')).toHaveAttribute('maxlength', '300');
  });

  it('shows the server’s 409 for a day that already has an exception, inside the dialog, and keeps the form', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    createException.mockRejectedValue(new BookingApiError('conflict', 409, 'Na tento den už výjimka existuje.'));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Na tento den už výjimka existuje.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    createException.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, dialog } = await open();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(createException).toHaveBeenCalledTimes(1);
    finish(exception());
  });
});
