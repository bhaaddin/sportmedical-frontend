/*
 * Přehled (Stage 4, R18): four calm blocks - Dnes, Vyžaduje pozornost, Tento týden, Kluby k vyřízení - and nothing else.
 * What is pinned here:
 *
 *  - the screen is only those blocks: no figure cards, no lookup box, no today lists, no pinned/recent, no new patients,
 *    no "Otevřít kalendář", no icons, and at most 7 distinct elements (it has 5);
 *  - ONE request answers the day and the week (the Prague week, Monday to Sunday);
 *  - "today" means today: a cancellation and a no-show are not the day's work, the waiting room is CheckedIn only;
 *  - a name, not an id; nothing about patients is asked without the permission to see them;
 *  - a source that cannot be read is SAID (with a retry) - never drawn as zero bookings, "Vše vyřízeno" or "Žádná poptávka".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';

const range = vi.fn();
const getById = vi.fn();
const list = vi.fn();
const search = vi.fn();
const listActivities = vi.fn();
const listClubOrders = vi.fn();
const checkRequired = vi.fn();
const getInvoices = vi.fn();
const fetchIntakeQueue = vi.fn();

vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));
vi.mock('../api/patients', () => ({ patientsApi: { getById, list, search } }));
vi.mock('../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../api/clubOrders', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/clubOrders')>()), clubOrdersApi: { list: listClubOrders } }));
vi.mock('../api/documents', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/documents')>()), documentsApi: { checkRequired } }));
vi.mock('../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../api/intakeReview', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/intakeReview')>()), fetchIntakeQueue }));

const PEOPLE: Record<string, { id: string; firstName: string; lastName: string; dateOfBirth: string }> = {
  p1: { id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-01-02' },
  p2: { id: 'p2', firstName: 'Anna', lastName: 'Černá', dateOfBirth: '1985-06-07' },
  p3: { id: 'p3', firstName: 'Petr', lastName: 'Dvořák', dateOfBirth: '1992-11-03' },
};

/* Thursday 22. 10. 2026, 12:00 in Prague. Only `Date` is faked: timers and promises stay real. */
const NOW = '2026-10-22T10:00:00Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  getById.mockReset().mockImplementation((id: string) => (PEOPLE[id] ? Promise.resolve(PEOPLE[id]) : Promise.reject(new Error('404'))));
  list.mockReset().mockResolvedValue({ items: [], totalCount: 137, page: 1, pageSize: 1 });
  search.mockReset().mockResolvedValue([]);
  range.mockReset().mockResolvedValue([]);
  listActivities.mockReset().mockResolvedValue({ activities: [] });
  listClubOrders.mockReset().mockResolvedValue([]);
  checkRequired.mockReset().mockResolvedValue({ allRequiredPresent: true, requirements: [] });
  getInvoices.mockReset().mockResolvedValue([]);
  fetchIntakeQueue.mockReset().mockResolvedValue([]);
  setViewport(VIEWPORTS.desktop);
});

afterEach(() => {
  vi.useRealTimers();
});

const { default: Dashboard } = await import('./Dashboard');

/** Status codes as the contract numbers them: 0 Scheduled, 1 Confirmed, 2 CheckedIn, 3 Completed, 4 Cancelled, 5 NoShow. */
const at = (day: string, hourUtc: number, status: number, id: string, patientId = 'p1', patientName: string | null = PEOPLE[patientId] ? `${PEOPLE[patientId].firstName} ${PEOPLE[patientId].lastName}` : null) => ({
  id,
  calendarId: 'c1',
  patientId,
  activityId: 'a1',
  activityName: 'Kontrola',
  startUtc: `${day}T${String(hourUtc).padStart(2, '0')}:00:00Z`,
  endUtc: `${day}T${String(hourUtc).padStart(2, '0')}:30:00Z`,
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: { ready: true, missing: [] },
  patientName,
});
const TODAY = '2026-10-22';

const renderDashboard = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** A block by its heading (a `<section>` named by it). */
const block = async (name: string) => within(await screen.findByRole('region', { name }));

describe('the screen is four blocks and nothing else', () => {
  it('has Dnes, Vyžaduje pozornost, Tento týden and Kluby k vyřízení - and no more than 7 elements (it has 5)', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    renderDashboard();
    await block('Dnes');
    for (const name of ['Dnes', 'Tento týden']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vyžaduje pozornost' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kluby k vyřízení' })).toBeInTheDocument();
    const elements = document.querySelectorAll('[data-ov]');
    expect(elements.length).toBeLessThanOrEqual(7);
    expect(Array.from(elements).map((e) => e.getAttribute('data-ov')).sort()).toEqual(['block', 'chart', 'header', 'list', 'list']);
  });

  it('has none of what it used to carry', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    renderDashboard();
    await block('Dnes');
    for (const gone of ['Najít pacienta', 'Objednaní', 'Čekárna', 'Připnuté a nedávné', 'Nově v kartotéce', 'Kartotéka', 'Chybí podklady']) {
      expect(screen.queryByRole('region', { name: gone })).not.toBeInTheDocument();
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Otevřít kalendář' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/pacientů v registru/)).not.toBeInTheDocument();
  });

  it('has no quick-action buttons of its own: Nová objednávka, Nový pacient and Hledat are the top bar\'s', async () => {
    renderDashboard();
    await block('Dnes');
    for (const name of ['Nová objednávka', 'Nový pacient', 'Hledat']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('draws no icon: an icon only where it carries meaning, and nothing here needs one', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    listClubOrders.mockResolvedValue([{ id: 'o1', clubId: 'c', clubName: 'FK Slaný', status: 'Requested', totalSeats: 10, submittedAtUtc: '2026-10-20T08:00:00Z' }]);
    renderDashboard();
    await screen.findByText('FK Slaný');
    expect(document.querySelectorAll('[data-overview] svg')).toHaveLength(0);
  });

  it('greets the person by first name', async () => {
    localStorage.setItem('user', JSON.stringify({ firstName: 'Jana' }));
    renderDashboard();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Jana/);
  });
});

describe('1. Dnes', () => {
  it('asks for the Prague week in ONE request (Monday to Sunday) - it answers the day and the chart', async () => {
    renderDashboard();
    await block('Dnes');
    await waitFor(() => expect(range).toHaveBeenCalled());
    expect(range).toHaveBeenCalledTimes(1);
    expect(range).toHaveBeenCalledWith('2026-10-19', '2026-10-25');
  });

  it('shows how many today, who is next and who waits - not another day, not a cancellation, not a no-show', async () => {
    range.mockResolvedValue([
      at(TODAY, 6, 3, 'done', 'p1'),
      at(TODAY, 7, 2, 'wait', 'p2'),
      at(TODAY, 11, 1, 'next', 'p3'),
      at(TODAY, 13, 0, 'later', 'p1'),
      at(TODAY, 9, 4, 'cancelled', 'p2'),
      at(TODAY, 9, 5, 'noshow', 'p2'),
      at('2026-10-21', 9, 1, 'yesterday', 'p1'),
      at('2026-10-23', 9, 1, 'tomorrow', 'p1'),
    ]);
    renderDashboard();
    const day = await block('Dnes');
    await waitFor(() => expect(day.getByTestId('today-count')).toHaveTextContent('4'));
    expect(day.getByTestId('next-time')).toHaveTextContent('13:00');
    expect(await day.findByRole('link', { name: 'Petr Dvořák' })).toHaveAttribute('href', '/patients/p3');
    const waiting = within(day.getByTestId('waiting'));
    expect(await waiting.findByRole('link', { name: 'Anna Černá, 09:00' })).toHaveAttribute('href', '/patients/p2');
    expect(waiting.queryByText('Jana Marková')).not.toBeInTheDocument();
  });

  it('shows a name from the day rows, not an id; no patient is fetched one by one (speed-fe-2)', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'a', 'p1'), at(TODAY, 12, 1, 'b', 'p1'), at(TODAY, 13, 1, 'c', 'p2')]);
    renderDashboard();
    await block('Dnes');
    expect(getById).not.toHaveBeenCalled();
    expect(screen.queryByText('p1')).not.toBeInTheDocument();
  });

  it('says so when nobody is booked: zero, and no "next" line', async () => {
    renderDashboard();
    const day = await block('Dnes');
    await waitFor(() => expect(day.getByTestId('today-count')).toHaveTextContent('0'));
    expect(day.getByText('Na dnešek nikdo objednaný')).toBeInTheDocument();
    expect(day.queryByText('Další')).not.toBeInTheDocument();
  });

  it('says nobody else is coming once the booked visits are over', async () => {
    range.mockResolvedValue([at(TODAY, 6, 3, 'done', 'p1')]);
    renderDashboard();
    const day = await block('Dnes');
    expect(await day.findByText('Dnes už nikdo další')).toBeInTheDocument();
  });

  it('shows a slot with no register entry by the name it was taken under, not as a link', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'walk', '', 'Host bez karty')]);
    renderDashboard();
    const day = await block('Dnes');
    expect(await day.findByText('Host bez karty')).toBeInTheDocument();
    expect(day.queryByRole('link', { name: 'Host bez karty' })).not.toBeInTheDocument();
  });

  it('links "Dnešní přehled" - the lists live one click away, not on this screen', async () => {
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    renderDashboard();
    const day = await block('Dnes');
    expect(await day.findByRole('link', { name: 'Dnešní přehled' })).toHaveAttribute('href', '/dnes');
  });

  it('asks nothing about patients, and links none, without the permission to see them', async () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    range.mockResolvedValue([at(TODAY, 11, 1, 'a', 'p3', 'Petr D.')]);
    renderDashboard();
    const day = await block('Dnes');
    expect(await day.findByText('Petr D.')).toBeInTheDocument();
    expect(day.queryByRole('link', { name: 'Petr D.' })).not.toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(checkRequired).not.toHaveBeenCalled();
  });

  it('a failed week is SAID, with a retry - never zero bookings', async () => {
    range.mockRejectedValue(new Error('500'));
    renderDashboard();
    const day = await block('Dnes');
    expect(await day.findByText('Dnešní termíny se nepodařilo načíst.')).toBeInTheDocument();
    expect(day.queryByTestId('today-count')).not.toBeInTheDocument();
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    await userEvent.setup().click(day.getByRole('button', { name: 'Zkusit znovu' }));
    await waitFor(() => expect(day.getByTestId('today-count')).toHaveTextContent('1'));
  });
});

describe('3. Tento týden', () => {
  it('is ONE chart of seven bars with today marked, each bar saying its day and count', async () => {
    range.mockResolvedValue([at('2026-10-19', 8, 3, 'm1'), at('2026-10-19', 9, 3, 'm2'), at(TODAY, 11, 1, 't1'), at('2026-10-24', 9, 0, 's1')]);
    renderDashboard();
    const week = await block('Tento týden');
    const bars = await week.findAllByRole('listitem');
    expect(bars).toHaveLength(7);
    expect(week.getByRole('list')).toHaveAccessibleName('Termíny po dnech tohoto týdne');
    await waitFor(() => expect(bars[0]).toHaveAccessibleName(/^Po .*: 2$/));
    expect(bars[3]).toHaveAccessibleName(/^Čt .*: 1$/);
    expect(bars.filter((b) => b.getAttribute('aria-current') === 'date')).toEqual([bars[3]]);
    expect(week.getByText('4 termíny')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-ov="chart"]')).toHaveLength(1);
  });

  it('shows the count of a day in a tooltip on hover', async () => {
    range.mockResolvedValue([at('2026-10-20', 8, 3, 'x'), at('2026-10-20', 9, 3, 'y'), at('2026-10-20', 10, 3, 'z')]);
    renderDashboard();
    const week = await block('Tento týden');
    await waitFor(() => expect(week.getAllByRole('listitem')[1]).toHaveAccessibleName(/: 3$/));
    await userEvent.setup().hover(week.getAllByRole('listitem')[1]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Út .*: 3 termíny/);
  });

  it('a failed week is said, not drawn as seven empty bars', async () => {
    range.mockRejectedValue(new Error('500'));
    renderDashboard();
    const week = await block('Tento týden');
    expect(await week.findByText('Vytížení týdne se nepodařilo načíst.')).toBeInTheDocument();
    expect(week.queryByRole('listitem')).not.toBeInTheDocument();
  });
});

describe('2. Vyžaduje pozornost', () => {
  const overdue = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `i${i}`, patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: `FA-${i}`, status: 'Issued', totalCzk: 1000, paidCzk: 0, remainingCzk: 1000,
    currency: 'CZK', issueDateUtc: '2026-09-01T10:00:00Z', dueDateUtc: '2026-10-01T10:00:00Z', items: [],
  }));

  it('lists what needs a person - one row per area with its count, a link to where it is fixed', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage']));
    getInvoices.mockResolvedValue(overdue(2));
    renderDashboard();
    const attention = await block('Vyžaduje pozornost');
    const row = await attention.findByRole('link', { name: /Faktury po splatnosti/ });
    expect(row).toHaveAttribute('href', '/billing');
    expect(row).toHaveTextContent('2');
  });

  it('collapses to one quiet line - "Vše vyřízeno" - when every source answered and nothing waits', async () => {
    renderDashboard();
    const line = await screen.findByText('Vše vyřízeno');
    const section = line.closest('section') as HTMLElement;
    expect(section).toHaveAttribute('data-ov-state', 'clear');
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('NEVER says "Vše vyřízeno" when the week could not be read: that is a failure with a retry', async () => {
    range.mockRejectedValue(new Error('500'));
    renderDashboard();
    const attention = await block('Vyžaduje pozornost');
    expect(await attention.findByText('Co vyžaduje pozornost se nepodařilo načíst.')).toBeInTheDocument();
    expect(attention.queryByText('Vše vyřízeno')).not.toBeInTheDocument();
    expect(attention.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('NEVER says "Vše vyřízeno" when a source failed and found nothing', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage']));
    getInvoices.mockRejectedValue(new Error('500'));
    renderDashboard();
    const attention = await block('Vyžaduje pozornost');
    expect(await attention.findByText('Co vyžaduje pozornost se nepodařilo načíst.')).toBeInTheDocument();
    expect(attention.queryByText('Vše vyřízeno')).not.toBeInTheDocument();
  });

  it('keeps what it found and says that a part could not be read when one source failed', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage', 'patients.register']));
    getInvoices.mockResolvedValue(overdue(1));
    fetchIntakeQueue.mockRejectedValue(new Error('500'));
    renderDashboard();
    const attention = await block('Vyžaduje pozornost');
    expect(await attention.findByRole('link', { name: /Faktury po splatnosti/ })).toBeInTheDocument();
    expect(await attention.findByText(/Část údajů se nenačetla/)).toBeInTheDocument();
  });

  it('does not repeat the clubs: their requests are the other block', async () => {
    listClubOrders.mockResolvedValue([{ id: 'o1', clubId: 'c', clubName: 'FK Slaný', status: 'Requested', totalSeats: 10, submittedAtUtc: '2026-10-20T08:00:00Z' }]);
    renderDashboard();
    await screen.findByText('Vše vyřízeno');
    expect(screen.getByRole('region', { name: 'Vyžaduje pozornost' })).not.toHaveTextContent(/Poptávky klubů/);
  });

  it('shows at most three rows; the rest is behind "Zobrazit vše" in a pop-out', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage', 'patients.register', 'settings.clinic.manage']));
    getInvoices.mockResolvedValue(overdue(1));
    fetchIntakeQueue.mockResolvedValue([{ intakeId: 'x', referenceNumber: 'R1', givenName: 'Eva', familyName: 'Nová', submittedAtUtc: '2026-10-20T08:00:00Z' }]);
    /* paperwork not ready today -> a third group; the day list has one such booking */
    range.mockResolvedValue([{ ...at(TODAY, 11, 1, 'a'), paperwork: { ready: false, missing: ['questionnaire_missing'] } }]);
    renderDashboard();
    const attention = await block('Vyžaduje pozornost');
    await waitFor(() => expect(attention.getAllByRole('link')).toHaveLength(3));
    /* Three rows only - with three groups there is nothing to fold away. */
    expect(attention.queryByRole('button', { name: 'Zobrazit vše' })).not.toBeInTheDocument();
  });
});

describe('4. Kluby k vyřízení', () => {
  const order = (n: number, club: string, seats: number, day: number) => ({
    id: `o${n}`, clubId: `c${n}`, clubName: club, status: 'Requested', totalSeats: seats, submittedAtUtc: `2026-10-${String(day).padStart(2, '0')}T08:00:00Z`,
  });

  it('shows the count and the three oldest requests, each a link to the order, the rest behind "Zobrazit vše"', async () => {
    listClubOrders.mockResolvedValue([order(3, 'SK Třetí', 9, 21), order(1, 'FK První', 14, 18), order(4, 'FC Čtvrtý', 12, 22), order(2, 'TJ Druhý', 22, 20)]);
    renderDashboard();
    const clubs = await block('Kluby k vyřízení');
    expect(await clubs.findByText('FK První')).toBeInTheDocument();
    expect(clubs.getAllByRole('link').slice(0, 3).map((a) => a.textContent)).toEqual(['FK První14 míst', 'TJ Druhý22 míst', 'SK Třetí9 míst']);
    expect(clubs.queryByText('FC Čtvrtý')).not.toBeInTheDocument();
    expect(clubs.getByRole('link', { name: 'Zobrazit vše (4)' })).toHaveAttribute('href', '/clubs/objednavky');
    expect(clubs.getByText('4')).toBeInTheDocument();
  });

  it('asks for the unanswered requests only', async () => {
    renderDashboard();
    await block('Kluby k vyřízení');
    await waitFor(() => expect(listClubOrders).toHaveBeenCalledWith({ status: 'Requested' }));
  });

  it('collapses to one quiet line - "Žádná poptávka" - when the source answered and nothing waits', async () => {
    renderDashboard();
    const line = await screen.findByText('Žádná poptávka');
    const section = line.closest('section') as HTMLElement;
    expect(section).toHaveAttribute('data-ov-state', 'clear');
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('NEVER says "Žádná poptávka" when the list could not be read', async () => {
    listClubOrders.mockRejectedValue(new Error('500'));
    renderDashboard();
    const clubs = await block('Kluby k vyřízení');
    expect(await clubs.findByText('Poptávky klubů se nepodařilo načíst.')).toBeInTheDocument();
    expect(clubs.queryByText('Žádná poptávka')).not.toBeInTheDocument();
  });
});

describe('at the other two widths', () => {
  it.each([['tablet', VIEWPORTS.tablet], ['phone', VIEWPORTS.phone]] as const)('%s: the same four blocks and the same five elements', async (_name, width) => {
    setViewport(width);
    range.mockResolvedValue([at(TODAY, 11, 1, 'a')]);
    renderDashboard();
    await block('Dnes');
    expect(document.querySelectorAll('[data-ov]')).toHaveLength(5);
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label') ?? r.getAttribute('aria-labelledby') !== null)).toHaveLength(4);
  });
});
