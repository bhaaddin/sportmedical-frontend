/*
 * Pacienti shows the whole register, not its first page.
 *
 * `GET /api/patients` answers twenty rows unless asked for more. The screen
 * used to take that page as the register: it printed "20 registrovaných
 * pacientů" and searched inside those twenty, so the twenty-first surname
 * could not be found from here at all.
 *
 * What would have to break for these to fail: counting the rows on screen
 * instead of `totalCount`, filtering in the browser instead of asking the
 * server, or losing the way to the next page.
 *
 * The STAV column and the filter chips are joined from the appointment list
 * (see `patientActivity`); the join is tested there, and here only that the
 * register draws what it was handed and filters the page on it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const list = vi.fn();
const fetchAllAppointments = vi.fn();
const fetchUpcomingWindow = vi.fn();

vi.mock('../api/patients', () => ({ patientsApi: { list }, PATIENT_PAGE_SIZE_MAX: 100 }));
vi.mock('../components/patients/appointmentsSource', () => ({
  ALL_APPOINTMENTS_KEY: ['scheduling', 'appointments', 'all'],
  UPCOMING_WINDOW_KEY: ['day', 'upcoming-window'],
  fetchAllAppointments,
  fetchUpcomingWindow,
}));

const { default: PatientList } = await import('./PatientList');

const person = (n: number) => ({
  id: `p${n}-0000-0000`,
  firstName: `Jméno${n}`,
  lastName: `Příjmení${n}`,
  dateOfBirth: '1990-01-01',
  sex: 'Male',
  status: 'Active',
  createdAtUtc: '2026-09-01T10:00:00Z',
  updatedAtUtc: '2026-09-01T10:00:00Z',
});

beforeEach(() => {
  list.mockReset().mockImplementation(
    ({ page = 1, pageSize = 20 }: { page?: number; pageSize?: number }) =>
      Promise.resolve({
        items: Array.from({ length: Math.min(pageSize, 3) }, (_, i) => person((page - 1) * pageSize + i + 1)),
        totalCount: 137,
        page,
        pageSize,
      }),
  );
  fetchAllAppointments.mockReset().mockResolvedValue([]);
  fetchUpcomingWindow.mockReset().mockResolvedValue([]);
});

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter>
        <PatientList />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the register', () => {
  it('counts every patient the server has, not the rows on this page', async () => {
    renderList();

    expect(await screen.findByText('Kartotéka kliniky · 137 záznamů')).toBeInTheDocument();
  });

  it('goes on to the next page', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Jméno1 Příjmení1');

    await user.click(screen.getByRole('button', { name: 'Další' }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ query: '', page: 2, pageSize: 50 }));
    expect(await screen.findByText('Jméno51 Příjmení51')).toBeInTheDocument();
  });

  /* The search debounce ran on mount as well, and when it fired it put the
     list back on its first page - undoing a click made in the meantime. */
  it('stays on the next page once the search box has settled', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Jméno1 Příjmení1');

    await user.click(screen.getByRole('button', { name: 'Další' }));
    expect(await screen.findByText('Jméno51 Příjmení51')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(list).toHaveBeenLastCalledWith({ query: '', page: 2, pageSize: 50 });
    expect(screen.getByText('Jméno51 Příjmení51')).toBeInTheDocument();
  });

  it('searches on the server, over everybody', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Jméno1 Příjmení1');

    await user.type(screen.getByPlaceholderText(/Jméno, příjmení/), 'Novák');

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ query: 'Novák', page: 1, pageSize: 50 }));
    expect(await screen.findByText('Nalezeno: 137')).toBeInTheDocument();
  });

  it('says it could not load rather than that there are no patients', async () => {
    list.mockRejectedValue(new Error('500'));
    renderList();

    expect(await screen.findByText('Seznam pacientů se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.queryByText('Zatím žádní pacienti.')).not.toBeInTheDocument();
  });
});

describe('the contact columns', () => {
  it('draws the phone in its column and the e-mail under the name', async () => {
    list.mockResolvedValue({
      items: [{ ...person(1), phone: '+420 777 123 456', email: 'jan@example.cz' }, { ...person(2), phone: null, email: null }],
      totalCount: 2, page: 1, pageSize: 50,
    });

    renderList();

    expect(await screen.findByText('+420 777 123 456')).toBeInTheDocument();
    expect(screen.getByText('jan@example.cz')).toBeInTheDocument();
  });
});

describe('the standing column and the filters', () => {
  it('draws where each patient stands, off the appointment list', async () => {
    fetchAllAppointments.mockResolvedValue([
      {
        id: 'a1', patientId: 'p1-0000-0000', eventName: 'Prohlídka', status: 'Completed',
        startTime: '2026-03-14T08:00:00Z', endTime: '2026-03-14T09:00:00Z', notes: '',
      },
      {
        id: 'a2', patientId: 'p2-0000-0000', eventName: 'Prohlídka', status: 'NoShow',
        startTime: '2026-03-14T08:00:00Z', endTime: '2026-03-14T09:00:00Z', notes: '',
      },
    ]);

    renderList();

    expect(await screen.findByText('Kompletní')).toBeInTheDocument();
    expect(screen.getByText('Nepřišel 1×')).toBeInTheDocument();
    expect(screen.getByText('Nový pacient')).toBeInTheDocument();
  });

  it('narrows the page to the patients who did not come', async () => {
    const user = userEvent.setup();
    fetchAllAppointments.mockResolvedValue([
      {
        id: 'a2', patientId: 'p2-0000-0000', eventName: 'Prohlídka', status: 'NoShow',
        startTime: '2026-03-14T08:00:00Z', endTime: '2026-03-14T09:00:00Z', notes: '',
      },
    ]);

    renderList();
    await screen.findByText('Nepřišel 1×');

    await user.click(screen.getByRole('button', { name: 'Nepřišli' }));

    expect(screen.getByText('Jméno2 Příjmení2')).toBeInTheDocument();
    expect(screen.queryByText('Jméno1 Příjmení1')).not.toBeInTheDocument();
    expect(screen.getByText(/Zobrazeno 1 z 137 pacientů/)).toBeInTheDocument();
  });
});
