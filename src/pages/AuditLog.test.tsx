/*
 * Auditní log asks the server, page by page, with the filters the reader set.
 *
 * What would have to break for these to fail: filtering the hundred rows in
 * the browser again, a code shown without its Czech sentence, or a detail
 * that hides the values the trail recorded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const search = vi.fn();
const catalogue = vi.fn();

vi.mock('../api/audit', async () => {
  const actual = await vi.importActual<typeof import('../api/audit')>('../api/audit');
  return { ...actual, auditApi: { search, catalogue } };
});

const { default: AuditLog } = await import('./AuditLog');

const entry = (over: Record<string, unknown>) => ({
  id: 'e1',
  userId: 'u1',
  userEmail: 'jana@ordinace.cz',
  action: 'appointment.moved',
  entity: 'Appointment',
  entityId: 'a1',
  timestamp: '2026-09-25T09:00:00Z',
  oldValue: '{"startUtc":"2026-10-05T08:00:00Z"}',
  newValue: '{"startUtc":"2026-10-06T09:00:00Z"}',
  ipAddress: '10.0.0.7',
  notes: null,
  ...over,
});

beforeEach(() => {
  search.mockReset().mockResolvedValue({ items: [entry({})], totalCount: 1, page: 1, pageSize: 25 });
  catalogue.mockReset().mockResolvedValue({
    actions: ['appointment.moved', 'settings.changed'],
    entities: ['Appointment', 'SystemSetting'],
    users: ['jana@ordinace.cz'],
  });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuditLog />
    </QueryClientProvider>,
  );

describe('the audit screen', () => {
  it('asks the server for the first page and shows the row in Czech', async () => {
    renderPage();

    expect(await screen.findByText('Rezervace přesunuta')).toBeInTheDocument();
    expect(screen.getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(screen.getByText('Rezervace')).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ user: '', action: '' }), 1, 25);
  });

  it('opens the values before and after', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText('Zobrazit podrobnosti'));

    expect(await screen.findByText('2026-10-05T08:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('2026-10-06T09:00:00Z')).toBeInTheDocument();
    expect(screen.getByText(/adresa: 10.0.0.7/)).toBeInTheDocument();
  });

  it('sends the filters to the server instead of filtering in the browser', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Rezervace přesunuta');

    await user.type(screen.getByLabelText('Hledat v záznamech'), 'lunch');
    await user.click(screen.getByRole('button', { name: 'Filtrovat' }));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'lunch' }), 1, 25),
    );
  });

  it('says so when nothing matches', async () => {
    search.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    renderPage();

    expect(await screen.findByText('Filtru neodpovídá žádný záznam.')).toBeInTheDocument();
  });
});
