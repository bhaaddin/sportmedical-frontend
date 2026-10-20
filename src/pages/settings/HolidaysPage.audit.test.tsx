/*
 * Settings audit (20. 10. 2026) - Svátky a dovolené (/svatky).
 *
 * Measured on the dev API:
 *   PUT /api/holidays/2027-06-17 with a name of 500 characters  -> 500 (not 400)
 *   PUT /api/holidays/…        with an empty name               -> 500
 *   GET /api/holidays/1999 or /2200                             -> 400 "Rok musí být mezi 2000 a 2100."
 *   the longest name it keeps                                    -> 300 characters
 * so the screen stops the typing at 300, never sends an empty name and does not
 * walk off the years the server knows. A day that is already on the list is
 * renamed, never moved: its date field used to be editable, and changing it
 * quietly wrote a SECOND amendment on the new date and left the first in place.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { HOLIDAY_YEAR_MAX, HOLIDAY_YEAR_MIN } from '../../api/fieldLimits';

const year = vi.fn();
const save = vi.fn();
const reset = vi.fn();
const listExceptions = vi.fn();
const createException = vi.fn();
const deleteException = vi.fn();

vi.mock('../../api/holidays', () => ({ holidaysApi: { year, save, reset } }));
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null, publicMinimumNoticeMinutes: null, publicHorizonDays: null },
      { id: 'c2', name: 'InBody', color: '#2563EB', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: null, publicMinimumNoticeMinutes: null, publicHorizonDays: null },
    ]),
  },
}));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { listExceptions, createException, deleteException } }));

const { default: HolidaysPage } = await import('./HolidaysPage');
const { onlinePlan, onlineState, workingSwitchAction, isOnlineOnlyClosure } = await import('./holidayDay');

const day = (over: Record<string, unknown> = {}) => ({
  date: '2026-09-28', name: 'Den české státnosti', isHoliday: true, isStatutory: true, isAmended: false, ...over,
});

const exception = (over: Record<string, unknown> = {}) => ({
  id: 'e1', date: '2026-09-28', isClosed: false, startTime: null, endTime: null, workerUserId: null, reason: '', isClosedToPublic: true, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  year.mockReset().mockResolvedValue([day()]);
  save.mockReset().mockResolvedValue(day({ isHoliday: false, isAmended: true }));
  reset.mockReset().mockResolvedValue(undefined);
  listExceptions.mockReset().mockResolvedValue([]);
  createException.mockReset().mockResolvedValue(exception());
  deleteException.mockReset().mockResolvedValue(undefined);
});

describe('adding the clinic’s own day off', () => {
  it('opens on 1 January of the year shown, with the name empty and the date free to change', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: /Přidat vlastní volno/ }));
    const dialog = screen.getByRole('dialog', { name: 'Přidat vlastní volno' });
    expect(within(dialog).getByLabelText('Datum')).toHaveValue(`${year.mock.calls[0][0]}-01-01`);
    expect(within(dialog).getByLabelText('Datum')).toBeEnabled();
    expect(within(dialog).getByLabelText('Název')).toHaveValue('');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends the typed date, the trimmed name and isHoliday true', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: /Přidat vlastní volno/ }));
    const dialog = screen.getByRole('dialog');
    const date = within(dialog).getByLabelText('Datum');
    await user.clear(date);
    await user.type(date, '2026-12-23');
    await user.type(within(dialog).getByLabelText('Název'), '  Firemní volno  ');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('2026-12-23', true, 'Firemní volno'));
  });

  it('refuses a name made of spaces', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: /Přidat vlastní volno/ }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Název'), '    ');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('stops the name at the 300 characters the server keeps (more is a bare 500)', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: /Přidat vlastní volno/ }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Název')).toHaveAttribute('maxlength', '300');
  });

  it('will not save with the date cleared', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: /Přidat vlastní volno/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Název'), 'Volno');
    await user.clear(within(dialog).getByLabelText('Datum'));
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });
});

describe('renaming a day that is already on the list', () => {
  it('keeps its date fixed and says so', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: 'Upravit' }));
    const dialog = screen.getByRole('dialog', { name: 'Upravit den' });
    expect(within(dialog).getByLabelText('Datum')).toBeDisabled();
    expect(within(dialog).getByText(/Datum dne se nemění/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Název')).toHaveValue('Den české státnosti');
  });

  it('a renamed closed day stays closed', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: 'Upravit' }));
    const name = within(screen.getByRole('dialog')).getByLabelText('Název');
    await user.clear(name);
    await user.type(name, 'Státní svátek');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('2026-09-28', true, 'Státní svátek'));
  });

  it('a renamed working day stays a working day', async () => {
    year.mockResolvedValue([day({ isHoliday: false, isAmended: true, name: 'Pracujeme' })]);
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: 'Upravit' }));
    const name = within(screen.getByRole('dialog')).getByLabelText('Název');
    await user.type(name, ' (výjimka)');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('2026-09-28', false, 'Pracujeme (výjimka)'));
  });

  it('shows a refusal of the save instead of closing as if it had worked', async () => {
    save.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await user.click(await screen.findByRole('button', { name: 'Upravit' }));
    const name = within(screen.getByRole('dialog')).getByLabelText('Název');
    await user.type(name, '!');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uložit' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument();
  });
});

describe('the year', () => {
  it('asks for the neighbouring year when its button is clicked, and shows the new year', async () => {
    const user = userEvent.setup();
    renderScreen(<HolidaysPage />);
    await screen.findByText('Den české státnosti');
    const current = year.mock.calls[0][0] as number;
    await user.click(screen.getByRole('button', { name: String(current + 1) }));
    await waitFor(() => expect(year).toHaveBeenCalledWith(current + 1));
    expect(await screen.findByText(String(current + 1), { selector: 'p' })).toBeInTheDocument();
  });

  it('does not offer a year the server refuses', async () => {
    renderScreen(<HolidaysPage />);
    await screen.findByText('Den české státnosti');
    const current = year.mock.calls[0][0] as number;
    expect(current).toBeGreaterThan(HOLIDAY_YEAR_MIN);
    expect(current).toBeLessThan(HOLIDAY_YEAR_MAX);
    for (let y = current; y < HOLIDAY_YEAR_MAX; y += 1) {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: String(y + 1) })); });
    }
    await waitFor(() => expect(year).toHaveBeenCalledWith(HOLIDAY_YEAR_MAX));
    expect(screen.queryByRole('button', { name: String(HOLIDAY_YEAR_MAX + 1) })).toBeDisabled();
    expect(year).not.toHaveBeenCalledWith(HOLIDAY_YEAR_MAX + 1);
  }, 60_000);

  it('says so when the server answers nothing for a year', async () => {
    year.mockResolvedValue([]);
    renderScreen(<HolidaysPage />);
    expect(await screen.findByText(/nedostali žádné dny/)).toBeInTheDocument();
  });

  it('shows the refusal when the year cannot be read', async () => {
    year.mockRejectedValue(new Error('down'));
    renderScreen(<HolidaysPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('what the two switches send (holidayDay.ts)', () => {
  it.each([
    ['a statutory day made a working day', day(), true, { kind: 'save', isHoliday: false, name: 'Den české státnosti' }],
    ['a nameless day made a working day', day({ name: '   ' }), true, { kind: 'save', isHoliday: false, name: 'Pracujeme' }],
    ['a statutory day closed again goes back to the law', day({ isHoliday: false, isAmended: true }), false, { kind: 'reset' }],
    ['the clinic’s own day closed again is a holiday amendment', day({ isStatutory: false, isHoliday: false, isAmended: true, name: 'Firemní volno' }), false, { kind: 'save', isHoliday: true, name: 'Firemní volno' }],
    ['a nameless own day closed again keeps a reason', day({ isStatutory: false, name: '' }), false, { kind: 'save', isHoliday: true, name: 'Volno' }],
  ])('%s', (_label, holiday, working, expected) => {
    expect(workingSwitchAction(holiday, working)).toEqual(expected);
  });

  it('knows an online-only closure from a real exception', () => {
    expect(isOnlineOnlyClosure(exception())).toBe(true);
    expect(isOnlineOnlyClosure(exception({ isClosed: true }))).toBe(false);
    expect(isOnlineOnlyClosure(exception({ startTime: '10:00:00', endTime: '12:00:00' }))).toBe(false);
    expect(isOnlineOnlyClosure(exception({ workerUserId: 'u1' }))).toBe(false);
  });

  const calendar = (id: string, over: Record<string, unknown> = {}) => ({
    id, name: id.toUpperCase(), isActive: true, color: '#000000', location: '', displayStepMinutes: 15, sortOrder: 0, clinicServiceId: null,
    publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null, ...over,
  });

  it('online state: open when nothing is off, partly when some calendars are, closed when all active ones are', () => {
    const a = calendar('a');
    const b = calendar('b');
    const gone = calendar('x', { isActive: false });
    expect(onlineState('2026-09-28', [{ calendar: a, exceptions: [] }, { calendar: b, exceptions: [] }])).toBe('open');
    expect(onlineState('2026-09-28', [{ calendar: a, exceptions: [exception()] }, { calendar: b, exceptions: [] }])).toBe('partly');
    expect(onlineState('2026-09-28', [{ calendar: a, exceptions: [exception()] }, { calendar: b, exceptions: [exception({ id: 'e2' })] }, { calendar: gone, exceptions: [] }])).toBe('closed');
    expect(onlineState('2026-09-28', [])).toBe('open');
  });

  it('closing online writes one exception per active calendar and names a calendar that already has another exception that day', () => {
    const a = calendar('a');
    const b = calendar('b');
    const c = calendar('c');
    const inactive = calendar('d', { isActive: false });
    const plan = onlinePlan('2026-09-28', 'Den české státnosti', [
      { calendar: a, exceptions: [] },
      { calendar: b, exceptions: [exception({ id: 'other', isClosedToPublic: false, startTime: '10:00:00', endTime: '12:00:00' })] },
      { calendar: c, exceptions: [exception({ id: 'already' })] },
      { calendar: inactive, exceptions: [] },
    ], true);
    expect(plan.create.map((entry) => entry.calendarId)).toEqual(['a']);
    expect(plan.create[0].input).toMatchObject({ date: '2026-09-28', isClosed: false, isClosedToPublic: true, startTime: null, endTime: null, workerUserId: null });
    expect(plan.create[0].input.reason).toContain('Den české státnosti');
    expect(plan.blocked).toEqual(['B']);
    expect(plan.remove).toEqual([]);
  });

  it('opening online removes only the online-only exceptions of that date', () => {
    const a = calendar('a');
    const plan = onlinePlan('2026-09-28', 'x', [{
      calendar: a,
      exceptions: [exception({ id: 'keep-closed', isClosed: true }), exception({ id: 'drop' }), exception({ id: 'other-day', date: '2026-09-29' })],
    }], false);
    expect(plan.remove).toEqual([{ calendarId: 'a', id: 'drop' }]);
    expect(plan.create).toEqual([]);
  });
});
