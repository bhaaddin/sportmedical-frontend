/*
 * Pacienti as shelves: the registrations waiting (only when there are any, only for those who may handle them), the
 * patients opened last (only when there are any), the register as the shelf that takes the rest of the window, a name
 * that is a connected chip, and an empty register that offers the ways to fill it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { rememberOpened, resetMemoryCacheForTests } from '../ui/shelf/memory';

const list = vi.fn();
const fetchAllAppointments = vi.fn();
const fetchUpcomingWindow = vi.fn();
const fetchIntakeQueue = vi.fn();

vi.mock('../api/patients', () => ({ patientsApi: { list }, PATIENT_PAGE_SIZE_MAX: 100 }));
vi.mock('../api/intakeReview', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/intakeReview')>()), fetchIntakeQueue }));
vi.mock('../components/patients/appointmentsSource', () => ({
  ALL_APPOINTMENTS_KEY: ['scheduling', 'appointments', 'all'],
  UPCOMING_WINDOW_KEY: ['day', 'upcoming-window'],
  fetchAllAppointments,
  fetchUpcomingWindow,
}));

const { default: PatientList } = await import('./PatientList');

const person = (n: number) => ({
  id: `p${n}`, firstName: `Jméno${n}`, lastName: `Příjmení${n}`, dateOfBirth: '1990-01-01', sex: 'Male', status: 'Active',
  createdAtUtc: '2026-09-01T10:00:00Z', updatedAtUtc: '2026-09-01T10:00:00Z',
});

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

beforeEach(() => {
  localStorage.clear();
  resetMemoryCacheForTests();
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));
  list.mockReset().mockResolvedValue({ items: [person(1), person(2)], totalCount: 2, page: 1, pageSize: 50 });
  fetchAllAppointments.mockReset().mockResolvedValue([]);
  fetchUpcomingWindow.mockReset().mockResolvedValue([]);
  fetchIntakeQueue.mockReset().mockResolvedValue([]);
});

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/patients']}>
        <Routes>
          <Route path="/patients" element={<PatientList />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the register shelf', () => {
  it('is a shelf with the count of everybody, the filters in its header and the search above the table', async () => {
    list.mockResolvedValue({ items: [person(1)], totalCount: 137, page: 1, pageSize: 50 });
    renderList();
    const shelf = await screen.findByRole('region', { name: 'Kartotéka' });
    expect(within(shelf).getByLabelText('Počet: 137')).toBeInTheDocument();
    expect(within(shelf).getByRole('group', { name: 'Filtr pacientů' })).toBeInTheDocument();
    expect(within(shelf).getByRole('textbox', { name: 'Hledat v kartotéce' })).toBeInTheDocument();
    expect(within(shelf).getByRole('table', { name: 'Pacienti' })).toBeInTheDocument();
  });

  it('takes the height the page has left, so the table scrolls inside it and the page does not', async () => {
    const { container } = renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    expect(container.querySelector('[data-fit-page]')).not.toBeNull();
    expect(container.querySelector('[data-shelf="register"]')).not.toBeNull();
  });

  it('draws a name as a connected chip: a link to the card, and the row opens it only once', async () => {
    const user = userEvent.setup();
    renderList();
    const name = await screen.findByRole('link', { name: 'Jméno1 Příjmení1' });
    expect(name).toHaveAttribute('href', '/patients/p1');
    await user.click(name);
    expect(screen.getByTestId('where')).toHaveTextContent('/patients/p1');
  });

  it('a click elsewhere on the row opens the card too', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('link', { name: 'Jméno2 Příjmení2' });
    await user.click(screen.getAllByRole('row')[2]);
    expect(screen.getByTestId('where')).toHaveTextContent('/patients/p2');
  });
});

describe('an empty register', () => {
  beforeEach(() => list.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 }));

  it('says so and offers the ways to fill it', async () => {
    renderList();
    const shelf = await screen.findByRole('region', { name: 'Kartotéka' });
    expect(within(shelf).getByText('Zatím žádní pacienti.')).toBeInTheDocument();
    expect(within(shelf).getByRole('link', { name: /Nový pacient/ })).toHaveAttribute('href', '/patients/register');
    expect(within(shelf).getByRole('link', { name: /Odkaz pro registraci/ })).toHaveAttribute('href', '/nastaveni/odkaz-registrace');
  });

  it('offers nothing to somebody who may not register patients, and still says it is empty', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderList();
    const shelf = await screen.findByRole('region', { name: 'Kartotéka' });
    expect(within(shelf).getByText('Zatím žádní pacienti.')).toBeInTheDocument();
    expect(within(shelf).queryByRole('link', { name: /Nový pacient/ })).toBeNull();
  });

  it('a search with no match is not an empty register: no "get started" cards', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    await user.type(screen.getByRole('textbox', { name: 'Hledat v kartotéce' }), 'Nikdo');
    expect(await screen.findByText('Nikdo takový v registru není.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Odkaz pro registraci/ })).toBeNull();
  });
});

describe('the registrations waiting for review', () => {
  const entry = { intakeId: 'x', referenceNumber: 'REG-1', givenName: 'Eva', familyName: 'Nová', submittedAtUtc: '2026-10-01T10:00:00Z' };

  it('shows a card above the register, linking to the queue, when there are some', async () => {
    fetchIntakeQueue.mockResolvedValue([entry, { ...entry, intakeId: 'y', givenName: 'Karel' }]);
    renderList();
    const shelf = await screen.findByRole('region', { name: 'Čeká na vás' });
    expect(within(shelf).getByLabelText('Počet: 2')).toBeInTheDocument();
    expect(within(shelf).getByRole('link', { name: /Eva Nová/ })).toHaveAttribute('href', '/intake-review');
    expect(within(shelf).getByRole('link', { name: 'Zkontrolovat registrace' })).toHaveAttribute('href', '/intake-review');
  });

  it('draws nothing when none wait', async () => {
    renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    await waitFor(() => expect(fetchIntakeQueue).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Čeká na vás' })).toBeNull();
  });

  it('is not asked for, and not shown, without patients.register', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    fetchIntakeQueue.mockResolvedValue([entry]);
    renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    expect(fetchIntakeQueue).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Čeká na vás' })).toBeNull();
  });

  it('is not claimed as "nothing waits" when the queue cannot be read', async () => {
    fetchIntakeQueue.mockRejectedValue(new Error('500'));
    renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    await waitFor(() => expect(fetchIntakeQueue).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Čeká na vás' })).toBeNull();
    expect(screen.queryByText(/Vše vyřízeno/)).toBeNull();
  });
});

describe('recent patients', () => {
  it('is not drawn at all while there is nothing to show (it is context here, not content)', async () => {
    renderList();
    await screen.findByRole('region', { name: 'Kartotéka' });
    expect(screen.queryByRole('region', { name: 'Naposledy otevření' })).toBeNull();
  });

  it('shows the patients this person opened last, one line each, and no other kind', async () => {
    rememberOpened({ kind: 'patient', id: 'p9', label: 'Jana Marková' });
    rememberOpened({ kind: 'club', id: 'c1', label: 'FC Sparta' });
    renderList();
    const shelf = await screen.findByRole('region', { name: 'Naposledy otevření' });
    expect(within(shelf).getByRole('link', { name: 'Pacient: Jana Marková' })).toHaveAttribute('href', '/patients/p9');
    expect(within(shelf).queryByText('FC Sparta')).toBeNull();
  });
});

describe('on a phone', () => {
  it('pins "Nový pacient" once, at the bottom, and keeps the cards', async () => {
    setViewport(VIEWPORTS.phone);
    renderList();
    const pinned = await screen.findByRole('region', { name: 'Hlavní akce' });
    expect(within(pinned).getByRole('link', { name: 'Nový pacient' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nový pacient' })).toHaveLength(1);
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
  });
});
