/*
 * Settings audit (20. 10. 2026) - Nepřítomnost zaměstnanců (/nepritomnosti).
 *
 * Measured on the dev API (POST /api/employee-absences):
 *   toDate before fromDate            -> 422 scheduling.absence.range_invalid
 *   an unknown user                   -> 422 "Tento uživatel nebyl nalezen nebo není aktivní."
 *   reason over 300                   -> 422 scheduling.text.too_long
 *   an overlapping absence of the same person is ACCEPTED (two rows), a past one too
 *   DELETE of an id that is gone      -> 204
 * The list is refreshed after both writes, and so are the planner's day previews
 * (`grid-preview`) and the day overview (`day-summary`) that the absence changes.
 */
process.env.TZ = 'America/Los_Angeles';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const list = vi.fn();
const create = vi.fn();
const remove = vi.fn();
const getAccess = vi.fn();

vi.mock('../../api/employeeAbsences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/employeeAbsences')>()),
  employeeAbsencesApi: { list, create, remove },
}));
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null }]),
    getAccess,
  },
}));

const { default: EmployeeAbsencesPage } = await import('./EmployeeAbsencesPage');
const { absenceDraftProblem } = await vi.importActual<typeof import('../../api/employeeAbsences')>('../../api/employeeAbsences');

const absence = (over: Record<string, unknown> = {}) => ({ id: 'a1', userId: 'u1', workerDisplayName: 'MUDr. Jan Novák', fromDate: '2027-02-01', toDate: '2027-02-05', reason: 'Dovolená', ...over });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  list.mockReset().mockResolvedValue([absence()]);
  create.mockReset().mockResolvedValue(absence());
  remove.mockReset().mockResolvedValue(undefined);
  getAccess.mockReset().mockResolvedValue([
    { userId: 'u2', displayName: 'Žaneta Černá', role: 'Staff', hasAccess: false, lockedBy: null },
    { userId: 'u1', displayName: 'MUDr. Jan Novák', role: 'Owner', hasAccess: true, lockedBy: 'role' },
    { userId: 'u3', displayName: 'Adam Bílý', role: 'Staff', hasAccess: true, lockedBy: null },
  ]);
});

describe('absenceDraftProblem', () => {
  const ok = { userId: 'u1', fromDate: '2027-02-01', toDate: '2027-02-05' };
  it.each([
    ['fine', ok, null],
    ['one day', { ...ok, toDate: ok.fromDate }, null],
    ['no worker', { ...ok, userId: '' }, 'worker'],
    ['from empty', { ...ok, fromDate: '' }, 'dates'],
    ['to empty', { ...ok, toDate: '' }, 'dates'],
    ['a date in the wrong format', { ...ok, fromDate: '1.2.2027' }, 'dates'],
    ['end before start', { ...ok, toDate: '2027-01-31' }, 'order'],
    ['across a year', { userId: 'u1', fromDate: '2026-12-28', toDate: '2027-01-03' }, null],
  ] as const)('%s', (_label, draft, expected) => {
    expect(absenceDraftProblem(draft)).toBe(expected);
  });
});

describe('the list', () => {
  it('shows the worker, the Czech dates and the reason; "-" for none', async () => {
    list.mockResolvedValue([absence(), absence({ id: 'a2', reason: '', fromDate: '2027-03-01', toDate: '2027-03-01' })]);
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(within(rows[0]).getByText('MUDr. Jan Novák')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/1\. ?2\. ?2027/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Dovolená')).toBeInTheDocument();
    expect(within(rows[1]).getAllByRole('cell')[3]).toHaveTextContent('-');
  });

  it('asks for everybody by default and for one person when opened with ?userId=', async () => {
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    await waitFor(() => expect(list).toHaveBeenCalledWith(undefined));
    list.mockClear();
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti?userId=u3');
    await waitFor(() => expect(list).toHaveBeenCalledWith('u3'));
  });

  it('lists the people alphabetically (Czech collation), whoever has access, for the filter and the form', async () => {
    const user = userEvent.setup();
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    await user.click(await screen.findByRole('combobox', { name: 'Zaměstnanec' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Všichni zaměstnanci', 'Adam Bílý', 'MUDr. Jan Novák', 'Žaneta Černá']);
  });

  it('names an absence of an account that can no longer be named', async () => {
    list.mockResolvedValue([absence({ workerDisplayName: null, userId: 'gone' })]);
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    expect(await screen.findByText('Neznámý zaměstnanec')).toBeInTheDocument();
  });

  it('says there is none when there is none', async () => {
    list.mockResolvedValue([]);
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    expect(await screen.findByText('Žádná zapsaná nepřítomnost.')).toBeInTheDocument();
  });
});

describe('a new absence', () => {
  const open = async (route = '/nepritomnosti') => {
    const user = userEvent.setup();
    const view = renderScreen(<EmployeeAbsencesPage />, route);
    await user.click(await screen.findByRole('button', { name: 'Zapsat nepřítomnost' }));
    return { user, dialog: await screen.findByRole('dialog'), view };
  };

  it('starts on today’s Prague date for both ends (the browser is set to Los Angeles)', async () => {
    const { dialog } = await open();
    const prague = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
    expect(within(dialog).getByLabelText(/^Od/)).toHaveValue(prague);
    expect(within(dialog).getByLabelText(/^Do/)).toHaveValue(prague);
  });

  it('is pre-filled with the person the screen was opened for', async () => {
    const { dialog } = await open('/nepritomnosti?userId=u3');
    expect(within(dialog).getByRole('combobox', { name: /^Zaměstnanec/ })).toHaveTextContent('Adam Bílý');
  });

  it('needs a worker', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('refuses an end before the start with the sentence at the field', async () => {
    const { user, dialog } = await open();
    const to = within(dialog).getByLabelText(/^Do/);
    await user.clear(to);
    await user.type(to, '2020-01-01');
    expect(within(dialog).getByText('Konec nemůže být před začátkem.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends the person, the date range and the trimmed reason; an empty reason is null', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('combobox', { name: /^Zaměstnanec/ }));
    await user.click(await screen.findByRole('option', { name: 'Adam Bílý' }));
    for (const [label, value] of [[/^Od/, '2027-04-01'], [/^Do/, '2027-04-09']] as const) {
      const field = within(dialog).getByLabelText(label);
      await user.clear(field);
      await user.type(field, value);
    }
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({ userId: 'u3', fromDate: '2027-04-01', toDate: '2027-04-09', reason: null });

    create.mockClear();
    await user.click(await screen.findByRole('button', { name: 'Zapsat nepřítomnost' }));
    const second = await screen.findByRole('dialog');
    await user.click(within(second).getByRole('combobox', { name: /^Zaměstnanec/ }));
    await user.click(await screen.findByRole('option', { name: 'Adam Bílý' }));
    await user.type(within(second).getByLabelText('Důvod'), '  Nemoc  ');
    await user.click(within(second).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].reason).toBe('Nemoc');
  });

  it('stops the reason at the 300 characters the server keeps', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByLabelText('Důvod')).toHaveAttribute('maxlength', '300');
  });

  it('refreshes the list, the planner day previews and the day overview after a save', async () => {
    const { user, dialog, view } = await open();
    const spy = vi.spyOn(view.queryClient, 'invalidateQueries');
    await user.click(within(dialog).getByRole('combobox', { name: /^Zaměstnanec/ }));
    await user.click(await screen.findByRole('option', { name: 'Adam Bílý' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() => {
      const keys = spy.mock.calls.map((call) => (call[0] as { queryKey: string[] }).queryKey[0]);
      expect(keys).toEqual(expect.arrayContaining(['employee-absences', 'grid-preview', 'day-summary']));
    });
  });

  it('shows the server sentence inside the dialog and keeps the form', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    create.mockRejectedValue(new BookingApiError('domainRule', 422, 'Tento uživatel nebyl nalezen nebo není aktivní.'));
    const { user, dialog } = await open('/nepritomnosti?userId=u3');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Tento uživatel nebyl nalezen nebo není aktivní.')).toBeInTheDocument();
  });

  it('warns when the people list could not be read', async () => {
    getAccess.mockRejectedValue(new Error('down'));
    const { dialog } = await open();
    expect(await within(dialog).findByText(/Seznam zaměstnanců se nepodařilo načíst/)).toBeInTheDocument();
  });
});

describe('removing an absence', () => {
  it('asks first, names the person and the range, and deletes by id', async () => {
    const user = userEvent.setup();
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    await user.click(await screen.findByRole('button', { name: 'Smazat nepřítomnost: MUDr. Jan Novák' }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('MUDr. Jan Novák');
    await user.click(within(dialog).getByRole('button', { name: 'Smazat' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a1'));
  });

  it('shows a refusal inside the dialog', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    remove.mockRejectedValue(new BookingApiError('server', 500));
    const user = userEvent.setup();
    renderScreen(<EmployeeAbsencesPage />, '/nepritomnosti');
    await user.click(await screen.findByRole('button', { name: /Smazat nepřítomnost/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Smazat' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument();
  });
});
