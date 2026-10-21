/*
 * The command palette: opens on Ctrl/Cmd+K, finds patients, clubs, orders, invoices, services, settings and actions, is
 * driven by the keyboard alone, hides what the person may not open, and never sends an identifier to a search endpoint.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { resetMemoryCacheForTests } from '../memory';

const search = vi.fn();
const getClubs = vi.fn();
const listOrders = vi.fn();
const getInvoices = vi.fn();
const listServices = vi.fn();
const getAppointments = vi.fn();

vi.mock('../../../api/patients', () => ({ patientsApi: { search: (...a: unknown[]) => search(...a) } }));
vi.mock('../../../api/clubs', () => ({ clubsApi: { getAll: () => getClubs() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubOrders')>()), clubOrdersApi: { list: () => listOrders() } }));
vi.mock('../../../api/billing', () => ({ billingApi: { getInvoices: () => getInvoices() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: () => listServices() } }));
vi.mock('../../../api/calendar', () => ({ calendarApi: { getAppointments: (...a: unknown[]) => getAppointments(...a) } }));

const { default: CommandPalette } = await import('./CommandPalette');

const Where = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}|{JSON.stringify(location.state)}</output>;
};

const Palette = ({ onClose }: { onClose: () => void }) => <CommandPalette open onClose={onClose} />;

const renderPalette = (onClose = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/prehled']}>
        <Palette onClose={onClose} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
};

const input = () => screen.getByRole('combobox', { name: 'Hledat' });
const options = () => screen.getAllByRole('option');
const optionNames = () => options().map((o) => o.textContent ?? '');
/** One row by its command id (a hint may mention the same name as another row). */
const command = (id: string) => document.querySelector(`[data-command="${id}"]`);

beforeEach(() => {
  localStorage.clear();
  resetMemoryCacheForTests();
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register', 'billing.manage', 'settings.clinic.manage']));
  search.mockReset().mockResolvedValue([{ id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-01-02' }]);
  getClubs.mockReset().mockResolvedValue([{ id: 'c1', name: 'FC Sparta', ico: '1', city: 'Praha', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' }]);
  listOrders.mockReset().mockResolvedValue([{ id: 'o1', clubId: 'c1', clubName: 'FC Sparta', serviceName: 'Sportovní prohlídky', status: 'Requested' }]);
  getInvoices.mockReset().mockResolvedValue([
    { id: 'i1', invoiceNumber: 'FA-2026-0014', patientName: 'Jana Marková', totalCzk: 1600, status: 'Issued' },
  ]);
  listServices.mockReset().mockResolvedValue([{ id: 's1', name: 'Sportovní prohlídky', activities: 3, calendars: 1, description: '', sortOrder: 0, isActive: true }]);
  getAppointments.mockReset().mockResolvedValue([]);
});

describe('the opening view', () => {
  it('offers the quick actions, then a few places to go, before anything is typed', () => {
    renderPalette();
    expect(screen.getByRole('group', { name: 'Rychlé akce' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Přejít na' })).toBeInTheDocument();
    expect(optionNames()[0]).toContain('Nová objednávka');
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('starts with the first row active and says so for assistive technology', () => {
    renderPalette();
    const first = options()[0];
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveAttribute('aria-activedescendant', first.id);
  });
});

describe('finding things', () => {
  it('finds a patient by what is typed, after a pause, and cancels the older search when the next keystroke comes', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(input(), 'mar');

    await waitFor(() => expect(command('patient-p1')).not.toBeNull(), { timeout: 3000 });
    expect(search).toHaveBeenCalled();
    const [text, options2] = search.mock.calls.at(-1) as [string, { signal: AbortSignal }];
    expect(text).toBe('mar');
    expect(options2.signal).toBeInstanceOf(AbortSignal);
    /* A search made stale by a newer keystroke was aborted; the last one stands. */
    const signals = search.mock.calls.map((c) => (c[1] as { signal: AbortSignal }).signal);
    expect(signals.at(-1)?.aborted).toBe(false);
    for (const earlier of signals.slice(0, -1)) expect(earlier.aborted).toBe(true);
  });

  it('finds a club, an order, an invoice and a service in one box, each in a group of its own', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(input(), 'sparta');
    await waitFor(() => expect(command('club-c1')).not.toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Kluby' })).toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Objednávky klubů' })).toBeInTheDocument();

    await user.clear(input());
    await user.type(input(), 'FA-2026');
    await waitFor(() => expect(command('invoice-i1')).not.toBeNull(), { timeout: 3000 });
    expect(screen.getByRole('group', { name: 'Faktury' })).toBeInTheDocument();

    await user.clear(input());
    await user.type(input(), 'prohl');
    expect(await screen.findByRole('group', { name: 'Služby' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('finds a settings screen with no diacritics, the way the settings search does', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'oteviraci');
    expect(await screen.findByRole('group', { name: 'Nastavení' }, { timeout: 3000 })).toBeInTheDocument();
    expect(optionNames().join(' ')).toMatch(/Otevírací doba/);
  });

  it('finds an action by what a receptionist calls it', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'nova obj');
    await waitFor(() => expect(optionNames()[0]).toContain('Nová objednávka'));
  });

  it('says there is nothing, and what to try, when nothing answers', async () => {
    search.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'xqzxqz');
    expect(await screen.findByRole('status', undefined, { timeout: 3000 })).toHaveTextContent('Nic jsme nenašli pro „xqzxqz“');
  });

  it('survives a source that fails: the others still answer', async () => {
    getClubs.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'mar');
    await waitFor(() => expect(command('patient-p1')).not.toBeNull(), { timeout: 3000 });
  });
});

describe('privacy', () => {
  it.each(['850101/1234', '8501011234', '123456789'])('does not send "%s" (it looks like an identifier) to any search', async (typed) => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), typed);
    expect(await screen.findByRole('status', undefined, { timeout: 3000 })).toHaveTextContent('Podle rodného ani pojišťovacího čísla se nehledá');
    expect(search).not.toHaveBeenCalled();
  });

  it('remembers what was opened as an id and a name, and nothing else', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'mar');
    await waitFor(() => expect(command('patient-p1')).not.toBeNull(), { timeout: 3000 });
    await user.click(command('patient-p1') as HTMLElement);

    const stored = localStorage.getItem('sm-shelf:u1') ?? '';
    expect(stored).toContain('Jana Marková');
    expect(stored).toContain('"p1"');
    expect(stored).not.toContain('1990');
  });
});

describe('permissions hide', () => {
  it('without billing.manage there are no invoices, no Fakturace, and invoices are never asked for', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    const user = userEvent.setup();
    renderPalette();

    await user.type(input(), 'faktur');
    await waitFor(() => expect(getClubs).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(getInvoices).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Faktury' })).toBeNull();
    expect(optionNames().join(' ')).not.toMatch(/Pokladna|Účetní export|FA-2026/);
  });

  it('without patients.view no patient is searched for', async () => {
    localStorage.setItem('permissions', JSON.stringify(['billing.manage']));
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'mar');
    await waitFor(() => expect(getClubs).toHaveBeenCalled());
    expect(search).not.toHaveBeenCalled();
    expect(command('patient-p1')).toBeNull();
  });

  it('without patients.register there is no "Nový pacient" among the actions', () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderPalette();
    expect(optionNames().join(' ')).not.toContain('Nový pacient');
    expect(optionNames().join(' ')).toContain('Nová objednávka');
  });

  it('hides a pinned or recent entity the person may not open', () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    localStorage.setItem('sm-shelf:u1', JSON.stringify({ v: 1, recents: [{ kind: 'patient', id: 'p9', label: 'Skrytá Pacientka', at: Date.now() }, { kind: 'club', id: 'c1', label: 'FC Sparta', at: Date.now() }], pinned: [] }));
    resetMemoryCacheForTests();
    renderPalette();
    expect(optionNames().join(' ')).not.toContain('Skrytá Pacientka');
    expect(optionNames().join(' ')).toContain('FC Sparta');
  });
});

describe('the keyboard', () => {
  it('ArrowDown and ArrowUp move the selection and wrap round', async () => {
    const user = userEvent.setup();
    renderPalette();
    const count = options().length;

    await user.keyboard('{ArrowDown}');
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter opens the selected row: an action goes to the calendar with a timestamp the calendar reads, and the palette closes', async () => {
    const user = userEvent.setup();
    const onClose = renderPalette();
    await user.keyboard('{Enter}');
    const where = screen.getByTestId('where').textContent ?? '';
    expect(where.startsWith('/planovani|')).toBe(true);
    const state = JSON.parse(where.split('|')[1]) as { newAppointment: unknown };
    expect(typeof state.newAppointment).toBe('number');
    expect(onClose).toHaveBeenCalled();
  });

  it('typing, ArrowDown and Enter open an entity, with its id (not its name) as router state where a screen reads one', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(input(), 'FA-2026');
    await waitFor(() => expect(command('invoice-i1')).not.toBeNull(), { timeout: 3000 });
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/billing|{"invoiceId":"i1"}');
  });

  it('a click opens the row too', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByRole('option', { name: /Kalendář/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/planovani');
  });

  it('Escape asks to close', async () => {
    const user = userEvent.setup();
    const onClose = renderPalette();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('starts fresh every time it is opened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CommandPalette open onClose={onClose} /></MemoryRouter>
      </QueryClientProvider>,
    );
    await user.type(input(), 'abc');
    rerender(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CommandPalette open={false} onClose={onClose} /></MemoryRouter></QueryClientProvider>);
    rerender(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CommandPalette open onClose={onClose} /></MemoryRouter></QueryClientProvider>);
    expect(input()).toHaveValue('');
    expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(3);
  });

  it('has the field focused on every open, not only the first (Ctrl+K, Enter must work the second time too)', async () => {
    const onClose = vi.fn();
    const tree = (open: boolean) => (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CommandPalette open={open} onClose={onClose} /></MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    await waitFor(() => expect(input()).toHaveFocus());
    rerender(tree(false));
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    rerender(tree(true));
    await waitFor(() => expect(input()).toHaveFocus());
  });
});

describe('on a phone', () => {
  it('is a full-screen sheet without the keyboard hints', () => {
    setViewport(VIEWPORTS.phone);
    renderPalette();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('↑↓ vybrat')).toBeNull();
    expect(options()[0]).toBeInTheDocument();
  });
});
