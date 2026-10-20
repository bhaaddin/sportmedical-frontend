/*
 * Settings audit (20. 10. 2026) - "Činnosti podle dnů" under Otevírací doba.
 *
 * It is a FULL REPLACEMENT (PUT …/periods/{pid}/day-activities { days: [...] }): a day left out
 * ends up with no činnost, so a save must never go out from a grid that did not load, must carry
 * every day, and must keep a činnost's time window (from/to) instead of widening it to the whole day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';

const listDayActivities = vi.fn();
const saveDayActivities = vi.fn();

vi.mock('../../api/workingHours', () => ({ workingHoursApi: { listDayActivities, saveDayActivities } }));

const activity = (id: string, name: string, sortOrder: number, extra: object = {}) => ({
  id, name, slug: id, durationMinutes: 30, color: '#22C55E', publicNote: '', isPubliclyBookable: true, sortOrder, isActive: true, clinicServiceId: 's1', ...extra,
});
vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [activity('a1', 'Prohlídka', 1), activity('a2', 'Diagnostika', 2), activity('a3', 'Cizí', 3, { clinicServiceId: 'x' }), activity('a4', 'Archivovaná', 4, { isActive: false })],
      warnings: [],
    }),
  },
}));

const { DayActivityGrid } = await import('./DayActivityGrid');

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const grid = (rows: Record<number, string[]> = {}, warnings: unknown[] = []) => ({
  rows: WEEK.map((dayOfWeek) => ({ dayOfWeek, activityIds: rows[dayOfWeek] ?? [] })), warnings,
});
const mount = (working = new Set([1, 2, 3, 4, 5])) =>
  renderScreen(<DayActivityGrid calendarId="c1" periodId="p1" workingDays={working} clinicServiceId="s1" />);
const cell = (day: string, name: string) => screen.getByRole('checkbox', { name: `${name} v ${day}` });
const body = () => saveDayActivities.mock.calls.at(-1)?.[2] as { dayOfWeek: number; activityIds: string[]; activities?: unknown[] }[];

beforeEach(() => {
  listDayActivities.mockReset().mockResolvedValue(grid());
  saveDayActivities.mockReset().mockResolvedValue(grid());
});

describe('reading the grid', () => {
  it('ticks exactly what the server holds', async () => {
    listDayActivities.mockResolvedValue(grid({ 1: ['a1'], 2: ['a1', 'a2'] }));
    mount();
    await screen.findByText('Prohlídka');
    expect(cell('Pondělí', 'Prohlídka')).toBeChecked();
    expect(cell('Pondělí', 'Diagnostika')).not.toBeChecked();
    expect(cell('Úterý', 'Diagnostika')).toBeChecked();
    expect(cell('Středa', 'Prohlídka')).not.toBeChecked();
  });

  it('lists only the active činnosti of the calendar’s service', async () => {
    mount();
    await screen.findByText('Prohlídka');
    expect(screen.queryByText('Cizí')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivovaná')).not.toBeInTheDocument();
  });

  it('keeps Uložit off until something is ticked', async () => {
    mount();
    await screen.findByText('Prohlídka');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('warns once, loudly, when nothing is ticked anywhere (the calendar offers nothing)', async () => {
    mount();
    expect(await screen.findByText(/V tomhle období není zaškrtnutá žádná činnost/)).toBeInTheDocument();
  });

  it('marks a working day that offers nothing, and a day that does not work', async () => {
    listDayActivities.mockResolvedValue(grid({ 1: ['a1'] }));
    mount();
    await screen.findByText('Prohlídka');
    const tuesday = screen.getByText('Úterý').closest('tr') as HTMLElement;
    expect(within(tuesday).getByText(/nenabídne nic/)).toBeInTheDocument();
    const sunday = screen.getByText('Neděle').closest('tr') as HTMLElement;
    expect(within(sunday).getByText('nepracovní den')).toBeInTheDocument();
  });

  it('shows the warnings the server sent with the grid and lets the owner click one away', async () => {
    listDayActivities.mockResolvedValue(grid({ 1: ['a1'] }, [{ code: 'day.offers_nothing', message: 'Úterý nenabízí žádnou činnost.', context: { affectedDays: [{ periodId: 'p1', periodName: 'x', dayOfWeek: 2 }] } }]));
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText('Úterý nenabízí žádnou činnost.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Close|Zavřít/i }));
    expect(screen.queryByText('Úterý nenabízí žádnou činnost.')).not.toBeInTheDocument();
  });
});

describe('saving (a full replacement)', () => {
  it('sends all seven days, the empty ones too, with the ids ticked', async () => {
    listDayActivities.mockResolvedValue(grid({ 1: ['a1'] }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Diagnostika v Úterý' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(saveDayActivities.mock.calls[0].slice(0, 2)).toEqual(['c1', 'p1']);
    expect(body().map((row) => row.dayOfWeek)).toEqual(WEEK);
    expect(body().map((row) => row.activityIds)).toEqual([['a1'], ['a2'], [], [], [], [], []]);
  });

  it('keeps the time window of a činnost on a day through the save', async () => {
    listDayActivities.mockResolvedValue({
      rows: WEEK.map((dayOfWeek) => (dayOfWeek === 1
        ? { dayOfWeek, activityIds: ['a1'], activities: [{ activityId: 'a1', from: '08:00:00', to: '10:00:00' }] }
        : { dayOfWeek, activityIds: [] })),
      warnings: [],
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Diagnostika v Pondělí' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(body()[0].activities).toEqual([
      { activityId: 'a1', from: '08:00:00', to: '10:00:00' },
      { activityId: 'a2', from: null, to: null },
    ]);
  });

  it('does not carry the window of a činnost that was unticked', async () => {
    listDayActivities.mockResolvedValue({
      rows: WEEK.map((dayOfWeek) => (dayOfWeek === 1
        ? { dayOfWeek, activityIds: ['a1'], activities: [{ activityId: 'a1', from: '08:00:00', to: '10:00:00' }] }
        : { dayOfWeek, activityIds: [] })),
      warnings: [],
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Prohlídka v Pondělí' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(body()[0].activityIds).toEqual([]);
    expect(body()[0].activities).toBeUndefined();
  });

  it('refreshes from the server after a save and goes quiet', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Prohlídka v Pondělí' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(listDayActivities.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
  });

  it('shows a refusal under the grid and keeps the ticks', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    saveDayActivities.mockRejectedValue(new BookingApiError('domainRule', 422, 'Čas, kdy se činnost nabízí, musí končit později, než začíná.'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Prohlídka v Pondělí' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Čas, kdy se činnost nabízí, musí končit později, než začíná.')).toBeInTheDocument();
    expect(cell('Pondělí', 'Prohlídka')).toBeChecked();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    saveDayActivities.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Prohlídka v Pondělí' }));
    await user.dblClick(screen.getByRole('button', { name: 'Uložit' }));
    expect(saveDayActivities).toHaveBeenCalledTimes(1);
    finish(grid());
  });

  it('never sends from a grid that did not load (that would erase every day)', async () => {
    listDayActivities.mockRejectedValue(new Error('down'));
    mount();
    await screen.findByText(/Zkusit znovu/);
    expect(screen.queryByRole('button', { name: 'Uložit' })).not.toBeInTheDocument();
    expect(saveDayActivities).not.toHaveBeenCalled();
  });
});

describe('the quick ways', () => {
  it('a column acts on the working days only, and on every day when the calendar works none yet', async () => {
    const user = userEvent.setup();
    mount(new Set([1, 3]));
    await user.click(await screen.findByRole('checkbox', { name: 'Vybrat celý sloupec: Prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(body().filter((row) => row.activityIds.length > 0).map((row) => row.dayOfWeek)).toEqual([1, 3]);
  });

  it('a row switches every činnost on for that day, and again off', async () => {
    const user = userEvent.setup();
    mount();
    const row = await screen.findByRole('checkbox', { name: 'Vybrat celý řádek: Pátek' });
    await user.click(row);
    expect(cell('Pátek', 'Prohlídka')).toBeChecked();
    expect(cell('Pátek', 'Diagnostika')).toBeChecked();
    await user.click(row);
    expect(cell('Pátek', 'Prohlídka')).not.toBeChecked();
  });

  it('copying a day brings its ticks and its windows, and leaves the source alone', async () => {
    listDayActivities.mockResolvedValue(grid({ 1: ['a1', 'a2'] }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Kopírovat z jiného dne: Středa' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pondělí' }));
    expect(cell('Středa', 'Prohlídka')).toBeChecked();
    expect(cell('Středa', 'Diagnostika')).toBeChecked();
    expect(cell('Pondělí', 'Prohlídka')).toBeChecked();
  });
});
