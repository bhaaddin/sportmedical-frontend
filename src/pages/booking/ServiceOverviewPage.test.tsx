/*
 * Přehled podle služeb, clicked through.
 *
 * The unit tests hold the arithmetic. What only the screen can show: that the
 * rows arrive under their service heading with the rota's name beside them,
 * that the employee filter offers exactly the people the rota names in the
 * range and narrows the table when one is picked, that free capacity comes
 * from the availability endpoint and is worded as starts and days, and that a
 * cancelled appointment is listed rather than dropped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const range = vi.fn();
const getAvailability = vi.fn();
const preview = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'c1', name: 'Prohlídky', color: '#0D7377', location: '', displayStepMinutes: 15,
        isActive: true, sortOrder: 0, clinicServiceId: 's-exam',
        publicMinimumNoticeMinutes: null, publicHorizonDays: null,
        publicHoldMinutes: null, publicCancellationHours: null,
      },
    ]),
  },
}));

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [
        {
          id: 'a-basic', name: 'Základní prohlídka', slug: 'zakladni', durationMinutes: 30, color: '#0D7377',
          publicNote: '', isPubliclyBookable: true, requiresReportByEmail: false, requiresClubSharing: false,
          questionnaireRequirement: 'NotAsked', sortOrder: 0, isActive: true, serviceItemId: null,
          priceCzk: null, clinicServiceId: 's-exam',
        },
      ],
      warnings: [],
    }),
  },
}));

vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's-exam', name: 'Sportovní prohlídky', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1 },
    ]),
  },
}));

vi.mock('../../api/appointments', () => ({
  appointmentsApi: { range, getAvailability },
}));

vi.mock('../../api/workingHours', () => ({
  workingHoursApi: { preview },
}));

const { default: ServiceOverviewPage } = await import('./ServiceOverviewPage');

const day = (date: string, worker: [string, string] | null) => ({
  date,
  isOpen: true,
  closedBecause: null,
  startTime: '08:00:00',
  endTime: '16:00:00',
  breakStart: null,
  breakEnd: null,
  workerUserId: worker?.[0] ?? null,
  workerDisplayName: worker?.[1] ?? null,
  isChangedByOverride: false,
  offeredActivityIds: ['a-basic'],
});

const appointment = (id: string, startUtc: string, status: number) => ({
  id,
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'a-basic',
  activityName: 'Základní prohlídka',
  startUtc,
  endUtc: startUtc.replace('T07', 'T08').replace('T09', 'T10'),
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
});

beforeEach(() => {
  preview.mockReset().mockResolvedValue([
    day('2026-10-06', ['u-novak', 'MUDr. Novák']),
    day('2026-10-07', ['u-dvorakova', 'MUDr. Dvořáková']),
  ]);
  range.mockReset().mockResolvedValue([
    appointment('t1', '2026-10-06T07:00:00Z', 0),
    appointment('t2', '2026-10-06T09:00:00Z', 2),
    appointment('t3', '2026-10-07T07:00:00Z', 0),
    appointment('t4', '2026-10-07T09:00:00Z', 4),
  ]);
  getAvailability.mockReset().mockResolvedValue([
    { startUtc: '2026-10-06T10:00:00Z', endUtc: '2026-10-06T10:30:00Z' },
    { startUtc: '2026-10-07T10:00:00Z', endUtc: '2026-10-07T10:30:00Z' },
    { startUtc: '2026-10-07T10:15:00Z', endUtc: '2026-10-07T10:45:00Z' },
  ]);
});

const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

const rowOf = async (activity: string) => {
  const cell = await screen.findByText(activity, { selector: 'p' });
  return cell.closest('tr') as HTMLTableRowElement;
};

describe('the overview by service', () => {
  it('lists each činnost under its service with the count, the weekdays and the rota’s names', async () => {
    render(withQueries(<ServiceOverviewPage />));

    expect(await screen.findByText('Sportovní prohlídky')).toBeInTheDocument();
    const row = await rowOf('Základní prohlídka');

    /* Three will happen; the cancelled one is counted apart. */
    await waitFor(() => expect(within(row).getByText('3')).toBeInTheDocument());
    expect(within(row).getByText('1 zrušeno')).toBeInTheDocument();
    expect(within(row).getByText('Út 2 · St 1')).toBeInTheDocument();
    expect(within(row).getByText('MUDr. Novák (2), MUDr. Dvořáková (1)')).toBeInTheDocument();
  });

  it('asks availability once per calendar and činnost the rota offers, and words it as starts and days', async () => {
    render(withQueries(<ServiceOverviewPage />));
    const row = await rowOf('Základní prohlídka');

    await waitFor(() => expect(within(row).getByText('3 začátky ve 2 dnech')).toBeInTheDocument());
    expect(getAvailability).toHaveBeenCalledTimes(1);
    expect(getAvailability.mock.calls[0].slice(0, 2)).toEqual(['c1', 'a-basic']);
  });

  it('offers the people the rota names in the range, and narrows everything to the one picked', async () => {
    render(withQueries(<ServiceOverviewPage />));
    await rowOf('Základní prohlídka');

    await userEvent.click(await screen.findByRole('combobox', { name: 'Pracovník' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Všichni pracovníci', 'MUDr. Dvořáková', 'MUDr. Novák']);

    await userEvent.click(screen.getByRole('option', { name: 'MUDr. Dvořáková' }));

    const row = await rowOf('Základní prohlídka');
    await waitFor(() => expect(within(row).getByText('MUDr. Dvořáková (1)')).toBeInTheDocument());
    expect(within(row).getByText('1')).toBeInTheDocument();
    /* Her Wednesday has two of the three offered starts; Novák's Tuesday one is gone. */
    expect(within(row).getByText('2 začátky v 1 dni')).toBeInTheDocument();
  });

  it('lists the appointments on request, the cancelled one included', async () => {
    render(withQueries(<ServiceOverviewPage />));
    const row = await rowOf('Základní prohlídka');
    await waitFor(() => expect(within(row).getByText('3')).toBeInTheDocument());

    await userEvent.click(
      screen.getByRole('button', { name: 'Zobrazit termíny: Základní prohlídka' }),
    );

    expect(await screen.findAllByText('Objednán')).toHaveLength(2);
    expect(screen.getByText('Přišel')).toBeInTheDocument();
    expect(screen.getByText('Zrušeno')).toBeInTheDocument();
    expect(screen.getAllByText('MUDr. Dvořáková')).not.toHaveLength(0);
  });

  it('refuses a range the day endpoint would refuse, before asking', async () => {
    render(withQueries(<ServiceOverviewPage />));
    await rowOf('Základní prohlídka');
    range.mockClear();

    fireEvent.change(screen.getByLabelText('Do'), { target: { value: '2030-01-01' } });

    expect(await screen.findByText('Nejvýše 62 dní najednou.')).toBeInTheDocument();
    expect(range).not.toHaveBeenCalled();
  });
});
