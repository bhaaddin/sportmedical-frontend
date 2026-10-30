/*
 * Historie změn, Auditní log, Zdraví systému and Hodnocení pacientů - the read-only screens of Systém. Each was
 * written against a shape the server does not send; these tests use the shapes the dev API really answered with
 * on 2026-10-20.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

import ChangeHistoryPage from './settings/ChangeHistoryPage';
import AuditLog from './AuditLog';
import SystemHealth from './SystemHealth';
import FeedbackReviewPage from './FeedbackReviewPage';
import { SETTINGS_SECTIONS, scopeOf } from './settings/catalogue';

const wrap = (node: React.ReactNode, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  get.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
});

/* ───────────────────────── Historie změn ───────────────────────── */

describe('Historie změn: the "Oblast" filter', () => {
  const open = async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    wrap(<ChangeHistoryPage />, '/nastaveni/historie-zmen');
    await screen.findByText('Žádné změny');
    await userEvent.click(screen.getByLabelText('Oblast'));
    return screen.findAllByRole('option');
  };

  it('offers only screens whose saves are written to this history', async () => {
    const options = (await open()).map((o) => o.textContent ?? '');
    const offered = SETTINGS_SECTIONS.flatMap((s) => s.items).filter((i) => scopeOf(i) !== null);
    expect(options).toHaveLength(offered.length + 1);
    for (const gone of ['SMS a e-maily', 'Uživatelé a práva', 'Pravidla dokumentů', 'Média a texty', 'Auditní log', 'Zdraví systému']) {
      expect(options.some((o) => o.endsWith(gone))).toBe(false);
    }
  });

  it('offers Zprávy (it holds the reminder) and sends the key the history files it under', async () => {
    await open();
    await userEvent.click(screen.getByRole('option', { name: /Zprávy/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Filtrovat' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 0, scope: 'booking.reminderHoursBefore' } }));
  });

  it.each([
    ['Souhlasy a GDPR', 'consent'],
    ['Úložiště médií', 'media'],
    ['Údaje pacienta', 'patients'],
    ['Rychlá registrace', 'registration.quick'],
    ['Firma a faktury', 'company'],
    ['Integrace', 'integrations'],
  ])('%s is filtered as %s', async (label, scope) => {
    await open();
    await userEvent.click(screen.getByRole('option', { name: new RegExp(label) }));
    await userEvent.click(screen.getByRole('button', { name: 'Filtrovat' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 0, scope } }));
  });
});

describe('Historie změn: the dates', () => {
  const open = async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    wrap(<ChangeHistoryPage />, '/nastaveni/historie-zmen');
    await screen.findByText('Žádné změny');
  };

  it('the "to" day is included to its last millisecond, the "from" day from its first', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Od data'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Do data'), { target: { value: '2026-10-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Filtrovat' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', {
      params: { take: 25, skip: 0, from: new Date(2026, 9, 20, 0, 0, 0, 0).toISOString(), to: new Date(2026, 9, 20, 23, 59, 59, 999).toISOString() },
    }));
  });

  it('an end before the start is said at the field and cannot be applied', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Od data'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Do data'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('Konec je dřív než začátek.')).toBeInTheDocument();
    const callsBefore = get.mock.calls.length;
    expect(screen.getByRole('button', { name: 'Filtrovat' })).toBeDisabled();
    expect(get.mock.calls.length).toBe(callsBefore);
  });

  it('Zrušit filtr empties every field and asks for the unfiltered first page', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Od data'), { target: { value: '2026-10-01' } });
    await userEvent.type(screen.getByLabelText('Uživatel'), 'jana');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrovat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit filtr' }));
    expect(screen.getByLabelText('Od data')).toHaveValue('');
    expect(screen.getByLabelText('Uživatel')).toHaveValue('');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 0 } }));
  });

  it('shows a refused load with Zkusit znovu', async () => {
    get.mockRejectedValue(new Error('down'));
    wrap(<ChangeHistoryPage />, '/nastaveni/historie-zmen');
    expect(await screen.findByText('Historii změn se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

/* ───────────────────────── Auditní log ───────────────────────── */

/** An entry exactly as GET /api/audit sends it. */
const audit = (i: number, over: Record<string, unknown> = {}) => ({
  id: `id-${i}`, userId: 'u', userEmail: 'admin@sportmedical.cz', action: 'settings.changed', entity: 'SystemSetting', entityId: `0d3f7c2a-${i}`,
  timestamp: '2026-10-20T08:57:42Z', oldValue: '{"key":"booking.reminderHoursBefore","value":"24"}', newValue: '{"key":"booking.reminderHoursBefore","value":"36"}',
  ipAddress: null, notes: 'booking.reminderHoursBefore', ...over,
});

describe('Auditní log', () => {
  /** The routes as the server answers them: the search is paged, the catalogue may be missing (older server). */
  const serve = (entries: unknown[], total = entries.length, catalogue?: unknown) =>
    get.mockImplementation((url: string) => {
      if (url === '/api/audit/search') return Promise.resolve({ data: { items: entries, totalCount: total, page: 1, pageSize: 25 } });
      if (url === '/api/audit/catalogue') return catalogue === undefined ? Promise.reject({ response: { status: 404 } }) : Promise.resolve({ data: catalogue });
      if (url === '/api/v1/exports/policy') return Promise.resolve({ data: { allowed: true } });
      if (url === '/api/audit/sensitive-access') return Promise.resolve({ data: entries });
      return Promise.reject(new Error(url));
    });
  const open = async (entries: unknown[], total?: number, catalogue?: unknown, path = '/audit-log') => {
    serve(entries, total, catalogue);
    wrap(<AuditLog />, path);
    await screen.findByText('Čas');
  };
  const lastSearch = () => [...get.mock.calls].reverse().find((c) => c[0] === '/api/audit/search')?.[1] as { params: Record<string, unknown> };

  it('asks the server for the first page of 25, not the latest 100 to filter in the browser', async () => {
    await open([audit(1)]);
    expect(lastSearch().params).toEqual({ page: 1, pageSize: 25 });
    expect(get).not.toHaveBeenCalledWith('/api/audit?take=100');
  });

  it('expands an entry to show the value before and after, read from oldValue / newValue', async () => {
    await open([audit(1)]);
    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit změnu' }));
    expect(screen.getByText('Před')).toBeInTheDocument();
    expect(screen.getByText('Po')).toBeInTheDocument();
    expect(screen.getByText(/"value": "24"/)).toBeInTheDocument();
    expect(screen.getByText(/"value": "36"/)).toBeInTheDocument();
  });

  it('an entry with no values has nothing to expand', async () => {
    await open([audit(1, { oldValue: null, newValue: null, action: 'account.session_created' })]);
    expect(screen.queryByRole('button', { name: 'Zobrazit změnu' })).toBeNull();
  });

  it('counts the real actions of the page, most frequent first', async () => {
    await open([audit(1), audit(2), audit(3, { action: 'account.session_created' })]);
    const top = screen.getByRole('region', { name: 'Nejčastější akce' });
    const labels = within(top).getAllByText(/^(settings\.changed|account\.session_created)$/).map((e) => e.textContent);
    expect(labels).toEqual(['settings.changed', 'account.session_created']);
  });

  it('sends the typed text to the server search, after a short pause', async () => {
    await open([audit(1)]);
    await userEvent.type(screen.getByPlaceholderText(/Hledat v auditním logu/), 'jana');
    await waitFor(() => expect(lastSearch().params).toMatchObject({ search: 'jana', page: 1 }));
  });

  it('sends the action, entity, user and the picked days as the server filters', async () => {
    await open([audit(1)]);
    await userEvent.click(screen.getByRole('button', { name: 'Filtry' }));
    await userEvent.type(screen.getByLabelText('Akce'), 'settings.changed');
    await userEvent.type(screen.getByLabelText('Entita'), 'Patient');
    await userEvent.type(screen.getByLabelText('Uživatel'), 'jana@');
    fireEvent.change(screen.getByLabelText('Od data'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Do data'), { target: { value: '2026-10-02' } });
    await waitFor(() => expect(lastSearch().params).toMatchObject({
      action: 'settings.changed', entity: 'Patient', user: 'jana@',
      from: '2026-09-30T22:00:00.000Z', to: '2026-10-02T22:00:00.000Z',
    }));
  });

  it('offers the catalogue as suggestions when the server has one, and plain typing when it has not', async () => {
    await open([audit(1)], 1, { actions: ['settings.changed'], entities: ['Patient'], users: ['jana@ordinace.cz'] });
    await userEvent.click(screen.getByRole('button', { name: 'Filtry' }));
    await userEvent.click(screen.getByLabelText('Akce'));
    expect(await screen.findByRole('option', { name: 'settings.changed' })).toBeInTheDocument();
  });

  it('says there are no records for a search with no match, and Zrušit hledání empties the filters', async () => {
    await open([audit(1)]);
    await userEvent.type(screen.getByPlaceholderText(/Hledat v auditním logu/), 'zzzzzz');
    serve([], 0);
    expect(await screen.findByText('Žádné záznamy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit hledání' }));
    expect(screen.getByPlaceholderText(/Hledat v auditním logu/)).toHaveValue('');
  });

  it('pages by the server total: Strana 1 z 3, Další asks for page 2', async () => {
    await open([audit(1)], 60);
    expect(screen.getByText('Strana 1 z 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Předchozí' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Další' }));
    await waitFor(() => expect(lastSearch().params).toMatchObject({ page: 2 }));
  });

  it('shows the whole id of nothing: only its first eight characters', async () => {
    await open([audit(1, { entityId: '0d3f7c2a-5c1e-4b8e-9a44-2f5e1c9b0a03' })]);
    expect(screen.getByText('0d3f7c2a')).toBeInTheDocument();
    expect(screen.queryByText('0d3f7c2a-5c1e-4b8e-9a44-2f5e1c9b0a03')).toBeNull();
  });

  it('names an entry about a patient with a connected chip, and keeps a setting plain', async () => {
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'patients.view']));
    await open([audit(1, { entity: 'Patient', entityId: 'aa11bb22-0000-4000-8000-000000000001' }), audit(2, { entityId: 'cc33dd44-1' })]);
    expect(screen.getByRole('link', { name: /aa11bb22/ })).toHaveAttribute('href', '/patients/aa11bb22-0000-4000-8000-000000000001');
    expect(screen.queryByRole('link', { name: /cc33dd44/ })).toBeNull();
    expect(screen.getByText('cc33dd44')).toBeInTheDocument();
  });

  it('draws the events as a shelf with the server total as its count', async () => {
    await open([audit(1), audit(2)], 57);
    const events = screen.getByRole('region', { name: 'Události' });
    expect(within(events).getByLabelText('Počet: 57')).toBeInTheDocument();
  });

  it('the sensitive-access tab reads its own route', async () => {
    await open([audit(1)]);
    await userEvent.click(screen.getByRole('tab', { name: 'Přístupy k citlivým údajům' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/audit/sensitive-access', { params: { page: 1, pageSize: 25 } }));
  });

  it('one patient’s records (?entity=Patient&entityId=…) come from the entity route, with a way back', async () => {
    const id = 'aa11bb22-0000-4000-8000-000000000001';
    get.mockImplementation((url: string) => {
      if (url === `/api/audit/entity/Patient/${id}`) return Promise.resolve({ data: [audit(1, { entity: 'Patient', entityId: id })] });
      if (url === '/api/audit/catalogue') return Promise.reject({ response: { status: 404 } });
      if (url === '/api/v1/exports/policy') return Promise.resolve({ data: { allowed: true } });
      return Promise.reject(new Error(url));
    });
    wrap(<AuditLog />, `/audit-log?entity=Patient&entityId=${id}`);
    expect(await screen.findByText('Záznamy o pacientovi:')).toBeInTheDocument();
    expect(await screen.findByText('admin@sportmedical.cz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zobrazit vše' })).toBeInTheDocument();
  });

  it('Export CSV asks the server for the picked days as a file', async () => {
    await open([audit(1)]);
    await userEvent.click(screen.getByRole('button', { name: 'Filtry' }));
    fireEvent.change(screen.getByLabelText('Od data'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(lastSearch().params).toMatchObject({ from: '2026-09-30T22:00:00.000Z' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    const search = get.getMockImplementation()!;
    get.mockImplementation((url: string, ...rest: unknown[]) => (url === '/api/audit/export' ? Promise.resolve({ data: new Blob(['a;b']) }) : search(url, ...rest)));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/audit/export', { params: { from: '2026-09-30T22:00:00.000Z', format: 'csv' }, responseType: 'blob' }));
  });

  it('says the load failed and tries again on request', async () => {
    get.mockRejectedValue(new Error('down'));
    wrap(<AuditLog />, '/audit-log');
    expect(await screen.findByText('Auditní log se nepodařilo načíst.')).toBeInTheDocument();
    serve([audit(1)]);
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('admin@sportmedical.cz')).toBeInTheDocument();
  });
});

/* ───────────────────────── Zdraví systému ───────────────────────── */

const HEALTH = {
  status: 'warning',
  database: { reachable: true, latencyMs: 4, appliedMigrations: 76, pendingMigrations: 0, error: null },
  outbox: { pending: 164, failed: 0, oldestPendingCreatedAtUtc: '2026-10-04T06:01:49Z', oldestPendingAgeMinutes: 23217 },
  smtp: { configured: false },
  storage: { root: 'C:\\docs', writable: true, freeBytes: 27483680768, totalBytes: 370952630272, problem: null },
  application: { version: '1.0.0+3b01e19', startedAtUtc: '2026-10-18T16:50:58Z', environment: 'Development' },
  activeSessions: 40,
  timestamp: '2026-10-20T08:59:26Z',
};
const serveHealth = (health: unknown = HEALTH, sessions: unknown = { items: [] }, errors: unknown = []) =>
  get.mockImplementation((url: string) =>
    url === '/api/system/health' ? (health instanceof Error ? Promise.reject(health) : Promise.resolve({ data: health }))
      : url === '/api/system/sessions' ? Promise.resolve({ data: sessions })
        : url === '/api/system/errors' ? Promise.resolve({ data: errors })
          : Promise.reject(new Error(url)));

describe('Zdraví systému', () => {
  const open = async () => {
    wrap(<SystemHealth />, '/system-health');
    await screen.findByText('Odezva databáze');
  };
  /* A figure is a MetricCard on the "Stav" shelf. */
  const card = (label: string) => within(screen.getByRole('region', { name: 'Stav' })).getByText(label).closest('[data-card="metric"]') as HTMLElement;

  it('shows the database latency from database.latencyMs, not "undefined ms"', async () => {
    serveHealth();
    await open();
    expect(card('Odezva databáze')).toHaveTextContent('4 ms');
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('shows the active sessions and the time of the measurement', async () => {
    serveHealth();
    await open();
    expect(card('Aktivní relace')).toHaveTextContent('40');
    expect(screen.getByText(/Změřeno/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it('shows what an owner opens this screen for: the status, the queue, the mail server and the free room', async () => {
    serveHealth();
    await open();
    expect(card('Stav systému')).toHaveTextContent('Pozor');
    expect(card('Stav systému')).toHaveTextContent('1.0.0+3b01e19');
    expect(card('Fronta zpráv')).toHaveTextContent('164');
    expect(card('Fronta zpráv')).toHaveTextContent('Nejstarší čeká 16 dní 2 h');
    expect(card('E-mailový server')).toHaveTextContent('Nenastaven');
    expect(card('E-mailový server')).toHaveTextContent('Zprávy se nikam neodesílají');
    expect(card('Úložiště dokumentů')).toHaveTextContent('25,6 GB');
  });

  it('says an empty queue is empty, and a failed one is failed', async () => {
    serveHealth({ ...HEALTH, status: 'ok', outbox: { pending: 0, failed: 0, oldestPendingAgeMinutes: null }, smtp: { configured: true } });
    await open();
    expect(card('Fronta zpráv')).toHaveTextContent('Nic nečeká na odeslání');
    expect(card('E-mailový server')).toHaveTextContent('Nastaven');
    expect(card('Stav systému')).toHaveTextContent('V pořádku');
  });

  it('mentions the failed messages in the queue card', async () => {
    serveHealth({ ...HEALTH, outbox: { pending: 3, failed: 2, oldestPendingAgeMinutes: 30 } });
    await open();
    expect(card('Fronta zpráv')).toHaveTextContent('selhalo 2');
  });

  it('still shows the latency when an older server sends it flat', async () => {
    serveHealth({ dbLatencyMs: 9, activeSessions: 2, timestamp: '2026-10-20T08:59:26Z' });
    await open();
    expect(card('Odezva databáze')).toHaveTextContent('9 ms');
  });

  it('lists the sessions and the latest failed operations', async () => {
    serveHealth(HEALTH, { items: [{ id: 's1', email: 'jana@ordinace.cz', displayName: 'Jana Nová', createdAt: '2026-10-20T08:00:00Z', expiresAt: '2026-10-20T16:00:00Z' }] },
      [{ id: 'e1', action: 'account.authentication_failed', entity: 'UserAccount', timestamp: '2026-10-17T23:30:26Z' }]);
    await open();
    expect(screen.getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(screen.getByText('account.authentication_failed')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Relace' })).getByLabelText('Počet: 1')).toBeInTheDocument();
  });

  it('says "Žádné chyby" and "Žádné aktivní relace" when there are none', async () => {
    serveHealth();
    await open();
    expect(screen.getByText('Žádné chyby')).toBeInTheDocument();
    expect(screen.getByText('Žádné aktivní relace')).toBeInTheDocument();
  });

  it('a failed health call does not hide the other two sections', async () => {
    serveHealth(new Error('down'), { items: [{ id: 's1', email: 'jana@ordinace.cz', displayName: 'Jana', createdAt: '2026-10-20T08:00:00Z', expiresAt: '2026-10-20T16:00:00Z' }] });
    wrap(<SystemHealth />, '/system-health');
    expect(await screen.findByText('Stav systému se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByText('jana@ordinace.cz')).toBeInTheDocument();
  });

  it('shows the shelves: Stav, Relace, Poslední chyby, and no attention card when nothing is wrong', async () => {
    serveHealth({ ...HEALTH, status: 'ok', outbox: { pending: 0, failed: 0, oldestPendingAgeMinutes: null }, smtp: { configured: true } });
    await open();
    for (const name of ['Stav', 'Relace', 'Poslední chyby']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Vyžaduje pozornost' })).toBeNull();
  });

  it('Vyžaduje pozornost lists what the answer says is wrong, each a link to its fix', async () => {
    serveHealth({ ...HEALTH, outbox: { pending: 3, failed: 2, oldestPendingAgeMinutes: 30 }, storage: { writable: false, freeBytes: 1 } });
    await open();
    const shelf = screen.getByRole('region', { name: 'Vyžaduje pozornost' });
    expect(within(shelf).getByRole('link', { name: /Neodeslané zprávy: 2/ })).toHaveAttribute('href', '/nastaveni/email');
    expect(within(shelf).getByRole('link', { name: /E-mailový server není nastaven/ })).toHaveAttribute('href', '/nastaveni/email');
    expect(within(shelf).getByRole('link', { name: /Do úložiště nejde zapisovat/ })).toHaveAttribute('href', '/nastaveni/uloziste-medii');
  });

  it('a failed health call draws no attention card (never an all-clear, never a guess)', async () => {
    serveHealth(new Error('down'));
    wrap(<SystemHealth />, '/system-health');
    expect(await screen.findByText('Stav systému se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Vyžaduje pozornost' })).toBeNull();
  });

  it('an empty errors shelf offers the audit log as the next step', async () => {
    serveHealth();
    await open();
    expect(within(screen.getByRole('region', { name: 'Poslední chyby' })).getByRole('link', { name: 'Auditní log' })).toHaveAttribute('href', '/audit-log');
  });

  it('on a phone the sessions are cards, not a table', async () => {
    setViewport(VIEWPORTS.phone);
    serveHealth(HEALTH, { items: [{ id: 's1', email: 'jana@ordinace.cz', displayName: 'Jana Nová', createdAt: '2026-10-20T08:00:00Z', expiresAt: '2026-10-20T16:00:00Z' }] });
    await open();
    const shelf = screen.getByRole('region', { name: 'Relace' });
    expect(within(shelf).queryByRole('table')).toBeNull();
    expect(within(shelf).getByRole('listitem')).toHaveTextContent('Jana Nová');
  });

  it('the refresh button asks all three again', async () => {
    serveHealth();
    await open();
    const before = get.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Obnovit data' }));
    await waitFor(() => expect(get.mock.calls.length).toBe(before + 3));
  });
});

/* ───────────────────────── Hodnocení pacientů ───────────────────────── */

describe('Hodnocení pacientů', () => {
  /* The link to a card is drawn only for whoever may open patients (the card route asks for patients.view). */
  beforeEach(() => localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'patients.view'])));
  const entry = (i: number, over: Record<string, unknown> = {}) => ({
    id: `f${i}`, appointmentId: `a${i}`, patientId: `p${i}`, rating: 5, comment: `Komentář ${i}`, invitedAtUtc: '2026-10-01T10:00:00Z', submittedAtUtc: '2026-10-02T10:00:00Z', ...over,
  });
  const open = async (entries: unknown[]) => {
    get.mockResolvedValue({ data: entries });
    wrap(<FeedbackReviewPage />, '/hodnoceni-pacientu');
  };

  it('says the average and the count, with a decimal comma', async () => {
    await open([entry(1, { rating: 5 }), entry(2, { rating: 4 })]);
    expect(await screen.findByText('4,5 / 5')).toBeInTheDocument();
    expect(screen.getByText('odpovědí celkem')).toBeInTheDocument();
  });

  it('does not count an answer without stars as a zero', async () => {
    await open([entry(1, { rating: 5 }), entry(2, { rating: null, comment: 'jen text' })]);
    expect(await screen.findByText('5,0 / 5')).toBeInTheDocument();
  });

  it('says "Bez komentáře." for an empty comment', async () => {
    await open([entry(1, { comment: null })]);
    expect(await screen.findByText('Bez komentáře.')).toBeInTheDocument();
  });

  it('says what an empty list means, with no counters', async () => {
    await open([]);
    expect(await screen.findByText(/Zatím žádné hodnocení/)).toBeInTheDocument();
    expect(screen.queryByText('odpovědí celkem')).toBeNull();
  });

  it('links each answer to the patient\'s card', async () => {
    await open([entry(1)]);
    const links = await screen.findAllByRole('link', { name: 'Karta pacienta' });
    expect(links[0]).toHaveAttribute('href', '/patients/p1');
  });

  it('says the load failed', async () => {
    get.mockRejectedValue(new Error('down'));
    wrap(<FeedbackReviewPage />, '/hodnoceni-pacientu');
    expect(await screen.findByText(/nepodařilo načíst/i)).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px)', async (_name, width) => {
    setViewport(width);
    await open([entry(1)]);
    expect(await screen.findByText('Komentář 1')).toBeInTheDocument();
    /* The tablet table leaves the link column out (the row itself opens the card); phone cards and desktop rows carry it. */
    expect(within(document.body).queryAllByText('Karta pacienta').length > 0).toBe(width !== VIEWPORTS.tablet);
  });
});
