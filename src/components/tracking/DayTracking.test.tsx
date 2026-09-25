/*
 * Sledování dne, clicked through.
 *
 * The arithmetic is the server's and is proved there. What only the screen can
 * show: that the nine numbers arrive under their Czech labels with the one
 * sentence of help, that the breakdowns come with the names the server sent,
 * and that clicking a number narrows the list to the rows the server sent for
 * it - never to something counted here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const day = vi.fn();

vi.mock('../../api/tracking', async () => {
  const actual = await vi.importActual<typeof import('../../api/tracking')>('../../api/tracking');
  return { ...actual, trackingApi: { day, period: vi.fn() } };
});

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [{ id: 'a1', name: 'Základní prohlídka' }],
      warnings: [],
    }),
  },
}));

vi.mock('../../hooks/useRealtimeSync', () => ({ useRealtimeSync: vi.fn() }));

const { DayTracking, TRACKING_DAY_QUERY_KEY } = await import('./DayTracking');

const counts = (over: Partial<Record<string, number>> = {}) => ({
  booked: 3,
  arrived: 2,
  noShow: 1,
  cancelled: 1,
  completed: 1,
  paid: 1,
  questionnaireMissing: 2,
  newPatients: 2,
  returningPatients: 1,
  ...over,
});

const row = (id: string, patient: string, status: number, startUtc: string, over: Record<string, unknown> = {}) => ({
  appointmentId: id,
  calendarId: 'c1',
  calendarName: 'Ordinace 1',
  patientId: `p-${id}`,
  patientName: patient,
  activityId: 'a1',
  activityName: 'Základní prohlídka',
  serviceId: 's1',
  serviceName: 'Sportovní prohlídky',
  workerUserId: 'u1',
  workerName: 'MUDr. Novák',
  startUtc,
  endUtc: startUtc,
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paid: false,
  questionnaireMissing: false,
  newPatient: false,
  ...over,
});

beforeEach(() => {
  day.mockReset().mockResolvedValue({
    date: '2026-09-24',
    counts: counts(),
    rows: [
      row('r1', 'Anna Nováková', 2, '2026-09-24T07:00:00Z', { paid: true, newPatient: true }),
      row('r2', 'Bedřich Dvořák', 3, '2026-09-24T08:00:00Z', { questionnaireMissing: true }),
      row('r3', 'Cyril Horák', 5, '2026-09-24T09:00:00Z', { questionnaireMissing: true, newPatient: true }),
      row('r4', 'Anna Nováková', 4, '2026-09-24T10:00:00Z'),
    ],
    byService: [{ key: 's1', id: 's1', name: 'Sportovní prohlídky', counts: counts() }],
    byActivity: [{ key: 'a1', id: 'a1', name: 'Základní prohlídka', counts: counts() }],
    byWorker: [{ key: 'u1', id: 'u1', name: 'MUDr. Novák', counts: counts() }],
    byStatus: [],
    workers: [{ userId: 'u1', displayName: 'MUDr. Novák' }],
  });
});

const mount = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const rendered = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
};

describe('sledování dne', () => {
  it('asks the server again when a screen invalidates the exported key, and promises only that', async () => {
    const { client } = mount(<DayTracking date="2026-09-24" calendarIds={['c1']} />);

    await screen.findByRole('button', { name: 'Objednáno' });
    expect(day).toHaveBeenCalledTimes(1);

    /* The server rings no bell on a status change; "Přišel" on /dnes and the
       booking detail invalidate this key instead, and the panel must react. */
    await client.invalidateQueries({ queryKey: TRACKING_DAY_QUERY_KEY });
    await waitFor(() => expect(day).toHaveBeenCalledTimes(2));

    expect(
      screen.getByText(
        'Aktualizuje se každou minutu, po každé nové, přesunuté nebo zrušené rezervaci a po změně stavu provedené v tomto okně.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the nine numbers under their labels, from the server', async () => {
    mount(<DayTracking date="2026-09-24" calendarIds={['c1']} />);

    const tile = (label: string) => screen.getByRole('button', { name: label });
    await screen.findByRole('button', { name: 'Objednáno' });
    expect(day).toHaveBeenCalledWith('2026-09-24', { calendarIds: ['c1'], activityIds: [], workerUserId: null });

    expect(within(tile('Objednáno')).getByText('3')).toBeInTheDocument();
    expect(within(tile('Nepřišli')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Chybí dotazník')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Noví pacienti')).getByText('2')).toBeInTheDocument();
  });

  it('lists the day with the flags the counts are made of', async () => {
    mount(<DayTracking date="2026-09-24" calendarIds={['c1']} />);

    const table = await screen.findByRole('table', { name: 'Termíny' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    const anna = within(table).getAllByText('Anna Nováková')[0].closest('tr') as HTMLElement;
    expect(within(anna).getByText('Zaplaceno')).toBeInTheDocument();
    expect(within(anna).getByText('Nový pacient')).toBeInTheDocument();
    expect(within(anna).getByText('Přišel')).toBeInTheDocument();
    /* Four rows and the employee breakdown's own line. */
    expect(screen.getAllByText('MUDr. Novák', { selector: 'td' })).toHaveLength(5);
  });

  it('clicking a number narrows the list to the rows behind it, and the chip takes it back', async () => {
    mount(<DayTracking date="2026-09-24" calendarIds={['c1']} />);

    await screen.findByRole('table', { name: 'Termíny' });
    fireEvent.click(screen.getByRole('button', { name: 'Chybí dotazník' }));

    const table = screen.getByRole('table', { name: 'Termíny' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Bedřich Dvořák')).toBeInTheDocument();
    expect(within(table).getByText('Cyril Horák')).toBeInTheDocument();

    /* A breakdown cell is the same idea: the service's no-shows. */
    fireEvent.click(screen.getByRole('button', { name: 'Podle služby: Sportovní prohlídky · Nepřišli' }));
    expect(within(screen.getByRole('table', { name: 'Termíny' })).getAllByRole('row')).toHaveLength(2);

    /* The chip names the cell; deleting it shows the whole day again. */
    fireEvent.click(within(screen.getByText('Podle služby: Sportovní prohlídky · Nepřišli').closest('.MuiChip-root') as HTMLElement).getByTestId('CancelIcon'));
    expect(within(screen.getByRole('table', { name: 'Termíny' })).getAllByRole('row')).toHaveLength(5);
  });

  it('explains every number in one sentence', async () => {
    mount(<DayTracking date="2026-09-24" calendarIds={['c1']} />);

    await screen.findByRole('button', { name: 'Objednáno' });
    fireEvent.click(screen.getByText('Co je sledování a co které číslo znamená'));
    expect(screen.getByText(/Termíny ručně označené „Nepřišel“/)).toBeInTheDocument();
    expect(screen.getByText(/Pacienti, jejichž vůbec první nezrušená návštěva/)).toBeInTheDocument();
  });

  it('asks nothing without a calendar and says so', async () => {
    mount(<DayTracking date="2026-09-24" calendarIds={[]} />);

    expect(await screen.findByText('Vyberte alespoň jeden kalendář.')).toBeInTheDocument();
    expect(day).not.toHaveBeenCalled();
  });
});
