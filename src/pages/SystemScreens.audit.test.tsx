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
  const open = async (entries: unknown[]) => {
    get.mockResolvedValue({ data: entries });
    wrap(<AuditLog />, '/audit-log');
    await screen.findByText('Čas');
  };

  it('asks for the latest 100', async () => {
    await open([audit(1)]);
    expect(get).toHaveBeenCalledWith('/api/audit?take=100');
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

  it('counts the real actions, most frequent first', async () => {
    await open([audit(1), audit(2), audit(3, { action: 'account.session_created' })]);
    const top = screen.getByRole('region', { name: 'Nejčastější akce' });
    const labels = within(top).getAllByText(/^(settings\.changed|account\.session_created)$/).map((e) => e.textContent);
    expect(labels).toEqual(['settings.changed', 'account.session_created']);
  });

  it('searches the loaded entries by user, action, entity, id and notes', async () => {
    await open([audit(1), audit(2, { action: 'account.session_created', userEmail: 'jana@ordinace.cz', notes: null, entity: 'UserAccount' })]);
    await userEvent.type(screen.getByPlaceholderText(/Hledat v auditním logu/), 'jana');
    expect(screen.getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(screen.queryByText('admin@sportmedical.cz')).toBeNull();
  });

  it('says there are no records for a search with no match', async () => {
    await open([audit(1)]);
    await userEvent.type(screen.getByPlaceholderText(/Hledat v auditním logu/), 'zzzzzz');
    expect(screen.getByText('Žádné záznamy')).toBeInTheDocument();
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

  it('draws the events as a shelf with its count, and an empty search offers Zrušit hledání', async () => {
    await open([audit(1), audit(2)]);
    const events = screen.getByRole('region', { name: 'Události' });
    expect(within(events).getByLabelText('Počet: 2')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/Hledat v auditním logu/), 'zzzzzz');
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit hledání' }));
    expect(screen.getByPlaceholderText(/Hledat v auditním logu/)).toHaveValue('');
    expect(within(screen.getByRole('region', { name: 'Události' })).getByLabelText('Počet: 2')).toBeInTheDocument();
  });

  it('says the load failed and tries again on request', async () => {
    get.mockRejectedValueOnce(new Error('down'));
    wrap(<AuditLog />, '/audit-log');
    expect(await screen.findByText('Auditní log se nepodařilo načíst.')).toBeInTheDocument();
    get.mockResolvedValue({ data: [audit(1)] });
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
