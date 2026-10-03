/*
 * The činnosti grid: the board's plain header with a colour dot, a tri-state
 * checkbox over every column and row, and "Kopírovat z jiného dne".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listDayActivities = vi.fn();
const saveDayActivities = vi.fn();

vi.mock('../../api/workingHours', () => ({
  workingHoursApi: { listDayActivities, saveDayActivities },
}));

const activity = (id: string, name: string, sortOrder: number, extra: object = {}) => ({
  id, name, slug: id, durationMinutes: 30, color: '#22C55E', publicNote: '', isPubliclyBookable: true,
  sortOrder, isActive: true, clinicServiceId: 's1', ...extra,
});

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [activity('a1', 'Prohlídka', 1), activity('a2', 'Diagnostika', 2), activity('a3', 'Cizí', 3, { clinicServiceId: 'x' })],
      warnings: [],
    }),
  },
}));

const { DayActivityGrid } = await import('./DayActivityGrid');

const WORKING = new Set([1, 2, 3, 4, 5]);

const renderGrid = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <DayActivityGrid calendarId="c1" periodId="p1" workingDays={WORKING} clinicServiceId="s1" />
    </QueryClientProvider>,
  );
};

const emptyGrid = { rows: [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({ dayOfWeek, activityIds: [] as string[] })), warnings: [] };

beforeEach(() => {
  listDayActivities.mockReset().mockResolvedValue(emptyGrid);
  saveDayActivities.mockReset().mockResolvedValue(emptyGrid);
});

const lastBody = () => saveDayActivities.mock.calls.at(-1)?.[2] as { dayOfWeek: number; activityIds: string[] }[];

describe('DayActivityGrid', () => {
  it('shows only the činnosti of the calendar\'s service, the colour as a dot, in normal case', async () => {
    renderGrid();

    const header = (await screen.findByText('Prohlídka')).closest('th') as HTMLElement;
    expect(screen.queryByText('Cizí')).not.toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(header.querySelector('div[aria-hidden="true"]')).toHaveStyle({ backgroundColor: '#22C55E' });
    expect(screen.getByText('Prohlídka').textContent).toBe('Prohlídka');
  });

  it('a column checkbox switches one činnost on for every working day, and off again', async () => {
    const user = userEvent.setup();
    renderGrid();

    const column = await screen.findByRole('checkbox', { name: 'Vybrat celý sloupec: Prohlídka' });
    expect(column).not.toBeChecked();

    await user.click(column);
    expect(column).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Pondělí.*Prohlídka|Prohlídka.*Pondělí/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Pátek.*Prohlídka|Prohlídka.*Pátek/ })).toBeChecked();

    // and off again, then on for the save
    await user.click(column);
    expect(column).not.toBeChecked();
    await user.click(column);

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    const body = lastBody();
    expect(body.find((d) => d.dayOfWeek === 3)?.activityIds).toEqual(['a1']);
    // Saturday and Sunday do not work: the column leaves them alone
    expect(body.find((d) => d.dayOfWeek === 6)?.activityIds).toEqual([]);
    expect(body.find((d) => d.dayOfWeek === 0)?.activityIds).toEqual([]);
  });

  it('is indeterminate when only some days have the činnost', async () => {
    const user = userEvent.setup();
    renderGrid();

    const column = await screen.findByRole('checkbox', { name: 'Vybrat celý sloupec: Prohlídka' });
    await user.click(screen.getByRole('checkbox', { name: /Středa.*Prohlídka|Prohlídka.*Středa/ }));

    expect(column).toHaveAttribute('data-indeterminate', 'true');
    // a click on a partly ticked column fills it
    await user.click(column);
    expect(column).toBeChecked();
  });

  it('a row checkbox switches every činnost on for that day', async () => {
    const user = userEvent.setup();
    renderGrid();

    const row = await screen.findByRole('checkbox', { name: 'Vybrat celý řádek: Úterý' });
    await user.click(row);
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(lastBody().find((d) => d.dayOfWeek === 2)?.activityIds.sort()).toEqual(['a1', 'a2']);
    expect(lastBody().find((d) => d.dayOfWeek === 1)?.activityIds).toEqual([]);
  });

  it('copies another day onto this one', async () => {
    const user = userEvent.setup();
    listDayActivities.mockResolvedValue({
      rows: emptyGrid.rows.map((r) => (r.dayOfWeek === 1 ? { ...r, activityIds: ['a1', 'a2'] } : r)),
      warnings: [],
    });
    renderGrid();

    await user.click(await screen.findByRole('button', { name: 'Kopírovat z jiného dne: Čtvrtek' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Čtvrtek' })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Pondělí' }));

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    expect(lastBody().find((d) => d.dayOfWeek === 4)?.activityIds.sort()).toEqual(['a1', 'a2']);
  });

  it('carries a činnost\'s time window through a save instead of widening it to the whole day', async () => {
    const user = userEvent.setup();
    listDayActivities.mockResolvedValue({
      rows: emptyGrid.rows.map((r) =>
        r.dayOfWeek === 1
          ? { ...r, activityIds: ['a1'], activities: [{ activityId: 'a1', from: '08:00:00', to: '12:00:00' }] }
          : r,
      ),
      warnings: [],
    });
    renderGrid();

    await user.click(await screen.findByRole('checkbox', { name: /Úterý.*Prohlídka|Prohlídka.*Úterý/ }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(saveDayActivities).toHaveBeenCalled());
    const monday = saveDayActivities.mock.calls.at(-1)?.[2].find((d: { dayOfWeek: number }) => d.dayOfWeek === 1);
    expect(monday.activities).toEqual([{ activityId: 'a1', from: '08:00:00', to: '12:00:00' }]);
  });
});
