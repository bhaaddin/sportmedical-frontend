/*
 * Pacienti in its three layouts (Etapa 2, brief rule 3).
 *
 *   390   a card per patient - name, next appointment, status - and the main
 *         action pinned at the bottom
 *   834   a table with three columns: Pacient, Příští termín, Stav
 *   1440  the full table: birth, phone, last visit, next visit, standing
 *
 * What would have to break for these to fail: the list drawing a table on a
 * phone (the page scrolls sideways), losing the standing chip on the card, or
 * the tablet keeping every column.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';

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

const FUTURE = new Date(Date.now() + 5 * 86_400_000).toISOString();
const FUTURE_END = new Date(Date.now() + 5 * 86_400_000 + 3_600_000).toISOString();

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['patients.register', 'patients.view']));
  list.mockReset().mockResolvedValue({
    items: [
      {
        id: 'p1', firstName: 'Petra', lastName: 'Dvořáková', dateOfBirth: '1990-01-01', sex: 'Female',
        status: 'Active', phone: '+420 602 118 440', email: 'petra@example.cz',
        createdAtUtc: '2026-09-01T10:00:00Z', updatedAtUtc: '2026-09-01T10:00:00Z',
      },
    ],
    totalCount: 1, page: 1, pageSize: 50,
  });
  fetchAllAppointments.mockReset().mockResolvedValue([
    {
      id: 'a1', patientId: 'p1', eventName: 'Prohlídka', status: 'Scheduled',
      startTime: FUTURE, endTime: FUTURE_END, notes: '',
    },
  ]);
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

describe('Pacienti at 390 (phone)', () => {
  it('draws a card per patient and no table', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderList();

    const card = await screen.findByRole('listitem');
    expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(within(card).getByText('Petra Dvořáková')).toBeInTheDocument();
    expect(within(card).getByText(/Příští termín:/)).toBeInTheDocument();
  });

  it('puts the status on the card once the visits are known', async () => {
    setViewport(VIEWPORTS.phone);
    renderList();
    const card = await screen.findByRole('listitem');

    expect(await within(card).findByText('Nový pacient')).toBeInTheDocument();
  });

  it('pins "Nový pacient" at the bottom, once, and scrolls the filters sideways', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderList();
    await screen.findByRole('listitem');

    const pinned = container.querySelector('[data-pinned="true"]');
    expect(pinned).not.toBeNull();
    expect(within(pinned as HTMLElement).getByRole('button', { name: 'Nový pacient' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nový pacient' })).toHaveLength(1);
    expect(container.querySelector('[data-filters="scroll"]')).not.toBeNull();
  });
});

describe('Pacienti at 834 (iPad)', () => {
  it('draws a table with exactly three columns', async () => {
    setViewport(VIEWPORTS.tablet);
    const { container } = renderList();

    await screen.findByText('Petra Dvořáková');
    expect(container.querySelector('[data-layout="table-3"]')).not.toBeNull();
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Pacient', 'Příští termín', 'Stav']);
    expect(container.querySelector('[data-pinned="true"]')).toBeNull();
  });
});

describe('Pacienti at 1440 (desktop)', () => {
  it('draws the full table with phone, last and next visit', async () => {
    setViewport(VIEWPORTS.desktop);
    const { container } = renderList();

    await screen.findByText('Petra Dvořáková');
    expect(container.querySelector('[data-layout="table"]')).not.toBeNull();
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(expect.arrayContaining(['Pacient', 'Narození', 'Telefon', 'Poslední návštěva', 'Příští termín', 'Stav']));
    expect(screen.getByText('+420 602 118 440')).toBeInTheDocument();
    expect(screen.getByText('petra@example.cz')).toBeInTheDocument();
    /* The button stands in the header, not in a pinned bar. */
    expect(container.querySelector('[data-pinned="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nový pacient' })).toBeInTheDocument();
  });
});
