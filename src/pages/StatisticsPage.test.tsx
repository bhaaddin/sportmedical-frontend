/*
 * Statistiky, clicked through.
 *
 * The presets and the cell filtering are unit-tested in api/tracking.test.ts.
 * What only the screen can show: that the period goes to the server as the
 * preset means it, that the matrices are drawn from the server's groups and
 * cells with the server's names, that the rates are shown as a share and never
 * as "0 %" for nothing, and that a cell opens the list the server sent for it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const period = vi.fn();

vi.mock('../api/tracking', async () => {
  const actual = await vi.importActual<typeof import('../api/tracking')>('../api/tracking');
  return { ...actual, trackingApi: { day: vi.fn(), period } };
});

vi.mock('../api/calendars', () => ({
  calendarsApi: { list: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Ordinace 1', color: '#0D7377', isActive: true }]) },
}));

vi.mock('../api/activities', () => ({
  activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [{ id: 'a1', name: 'Základní prohlídka' }], warnings: [] }) },
}));

const { default: StatisticsPage } = await import('./StatisticsPage');

const counts = (over: Partial<Record<string, number>> = {}) => ({
  booked: 4,
  arrived: 2,
  noShow: 1,
  cancelled: 1,
  completed: 1,
  paid: 1,
  questionnaireMissing: 3,
  newPatients: 3,
  returningPatients: 0,
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
  questionnaireMissing: true,
  newPatient: true,
  ...over,
});

beforeEach(() => {
  period.mockReset().mockResolvedValue({
    from: '2026-09-01',
    to: '2026-09-30',
    groupBy: 0,
    totals: counts(),
    groups: [{ key: 's1', id: 's1', name: 'Sportovní prohlídky', counts: counts() }],
    workerByService: [{ rowId: 'u1', rowName: 'MUDr. Novák', columnId: 's1', columnName: 'Sportovní prohlídky', count: 4 }],
    heat: [
      { dayOfWeek: 4, hour: 9, count: 2 },
      { dayOfWeek: 4, hour: 10, count: 1 },
    ],
    payments: { paidCount: 1, paidAmount: 1815, openCount: 1, openAmount: 1210 },
    diagnosticSessions: 1,
    rows: [
      row('r1', 'Anna Nováková', 2, '2026-09-24T07:00:00Z', { paid: true, questionnaireMissing: false }),
      row('r2', 'Bedřich Dvořák', 3, '2026-09-24T08:00:00Z'),
      row('r3', 'Cyril Horák', 5, '2026-09-24T09:00:00Z'),
      row('r4', 'Anna Nováková', 4, '2026-09-24T10:00:00Z'),
      row('r5', 'Bedřich Dvořák', 3, '2026-09-10T07:00:00Z'),
    ],
    workers: [{ userId: 'u1', displayName: 'MUDr. Novák' }],
  });
});

const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StatisticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('statistiky', () => {
  it('asks for today first and for the week when the preset changes', async () => {
    mount();
    await screen.findByRole('button', { name: 'Objednáno' });

    const [from, to, groupBy] = period.mock.calls[0];
    expect(from).toBe(to);
    expect(groupBy).toBe('service');

    fireEvent.click(screen.getByRole('button', { name: 'Tento týden' }));
    await screen.findByRole('button', { name: 'Objednáno' });
    const last = period.mock.calls[period.mock.calls.length - 1];
    expect(last[0] <= last[1]).toBe(true);
    expect(new Date(last[0]).getDay()).toBe(1);
    expect(new Date(last[1]).getDay()).toBe(0);
  });

  it('draws the matrices from the server and shows shares, money and sessions', async () => {
    mount();
    await screen.findByRole('button', { name: 'Objednáno' });

    const byService = screen.getByRole('table', { name: 'Služba × stav' });
    expect(within(byService).getByText('Sportovní prohlídky')).toBeInTheDocument();
    expect(within(byService).getByRole('button', { name: 'Sportovní prohlídky · Nepřišli' })).toHaveTextContent('1');

    const bySomebody = screen.getByRole('table', { name: 'Zaměstnanec × služba' });
    expect(within(bySomebody).getByRole('button', { name: 'MUDr. Novák · Sportovní prohlídky' })).toHaveTextContent('4');

    const heat = screen.getByRole('table', { name: 'Den v týdnu × hodina' });
    expect(within(heat).getByRole('button', { name: 'Čt 9:00' })).toHaveTextContent('2');

    expect(within(screen.getByRole('button', { name: 'Podíl nepříchodů' })).getByText('25 %')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Vyplněné dotazníky' })).getByText('25 %')).toBeInTheDocument();
    expect(screen.getByText(/1 · 1\s?815/)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Diagnostická vyšetření')).getByText('1')).toBeInTheDocument();
  });

  it('never shows 0 % for a period with nothing in it', async () => {
    period.mockResolvedValue({
      from: '2026-09-01',
      to: '2026-09-01',
      groupBy: 0,
      totals: counts({ booked: 0, arrived: 0, noShow: 0, cancelled: 0, completed: 0, paid: 0, questionnaireMissing: 0, newPatients: 0, returningPatients: 0 }),
      groups: [],
      workerByService: [],
      heat: [],
      payments: { paidCount: 0, paidAmount: 0, openCount: 0, openAmount: 0 },
      diagnosticSessions: 0,
      rows: [],
      workers: [],
    });
    mount();
    await screen.findByRole('button', { name: 'Objednáno' });

    expect(within(screen.getByRole('button', { name: 'Podíl nepříchodů' })).getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('V tomto období nejsou žádné termíny.')).toHaveLength(3);
  });

  it('a cell opens the list it was counted from', async () => {
    mount();
    await screen.findByRole('button', { name: 'Objednáno' });

    fireEvent.click(screen.getByRole('button', { name: 'Sportovní prohlídky · Nepřišli' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 termínů')).toBeInTheDocument();
    expect(within(dialog).getByText('Cyril Horák')).toBeInTheDocument();
    expect(within(dialog).queryByText('Anna Nováková')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zavřít' }));
    /* The closed dialog is still fading out, and while it is the page behind
       it is aria-hidden; the cell is there, just not in the tree yet. */
    fireEvent.click(screen.getByRole('button', { name: 'Čt 9:00', hidden: true }));
    const heat = await screen.findByRole('dialog');
    expect(within(heat).getByText('2 termínů')).toBeInTheDocument();
    expect(within(heat).getByText('Anna Nováková')).toBeInTheDocument();
    expect(within(heat).getByText('Bedřich Dvořák')).toBeInTheDocument();
  });

  it('has the help panel', async () => {
    mount();
    await screen.findByRole('button', { name: 'Objednáno' });
    expect(screen.getByText('Co je sledování a co které číslo znamená')).toBeInTheDocument();
  });
});
