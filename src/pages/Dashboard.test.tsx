/*
 * The plocha (owner/admin home), built as shelves: Dnes (five figures), Vyžaduje pozornost, Najít pacienta, Objednaní,
 * Čekárna, Připnuté a nedávné, Nově v kartotéce. The behaviours worth pinning are the ones that were bugs before:
 *
 *  - "today" means today: the booking API is asked for a one-day range, because
 *    the old scheduling endpoint ignored its range and counted every appointment
 *    that ever existed.
 *  - cancelled and no-show rows are not today's work; a completed one is not in
 *    the waiting room.
 *  - a name, not an id, wherever the patient is known, and each fetched once.
 *  - the register's total, not the length of its first page.
 *  - nothing about patients is asked, or shown, without the permission to see
 *    them; "Nový pacient" only for somebody who may register one.
 *
 * and the new ones: the attention shelf counts what the figures count, every case on it is a link, and a source that
 * cannot be read is said rather than turned into an all-clear.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  getById.mockReset().mockImplementation((id: string) =>
    PEOPLE[id] ? Promise.resolve(PEOPLE[id]) : Promise.reject(new Error('404')));
  list.mockReset().mockResolvedValue({ items: [], totalCount: 137, page: 1, pageSize: 1 });
  search.mockReset().mockResolvedValue([]);
  range.mockReset().mockResolvedValue([]);
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'a1', name: 'Kontrola', priceCzk: 900 }] });
  listClubOrders.mockReset().mockResolvedValue([]);
  checkRequired.mockReset().mockResolvedValue({ allRequiredPresent: true, requirements: [] });
  getInvoices.mockReset().mockResolvedValue([]);
  fetchIntakeQueue.mockReset().mockResolvedValue([]);
  setViewport(VIEWPORTS.desktop);
});

const { default: Dashboard } = await import('./Dashboard');

/** Status codes as the contract numbers them: 0 Scheduled, 1 Confirmed, 2 CheckedIn, 3 Completed, 4 Cancelled, 5 NoShow. */
const at = (hourUtc: number, status: number, id: string, patientId = 'p1', paperworkReady = true) => ({
  id,
  calendarId: 'c1',
  patientId,
  activityId: 'a1',
  activityName: 'Kontrola',
  startUtc: `2026-09-29T${String(hourUtc).padStart(2, '0')}:00:00Z`,
  endUtc: `2026-09-29T${String(hourUtc).padStart(2, '0')}:30:00Z`,
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: { ready: paperworkReady, missing: paperworkReady ? [] : ['questionnaire_missing'] },
});

/** A shelf by its title (a `<section>` named by its heading). */
const shelf = async (title: string) => within(await screen.findByRole('region', { name: title }));

/** Czech figures use non-breaking spaces; compare what a person reads. */
const plain = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
const withText = (text: string) => (_: string, el: Element | null) => el !== null && el.children.length === 0 && plain(el.textContent) === text;

const metric = async (label: string) => {
  const heading = await screen.findByText(label, { selector: '[data-card="metric"] *' });
  return within(heading.closest('[data-card="metric"]') as HTMLElement);
};

const renderDashboard = (queryClient = new QueryClient()) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the patient register total', () => {
  it('shows the register\'s total in the header, not the length of one page', async () => {
    renderDashboard();
    expect(await screen.findByText(/137 pacientů v registru/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ pageSize: 1 });
  });

  it('asks nothing about patients, and shows no total, without the permission to see them', async () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();
    await screen.findByText('Najít pacienta');

    expect(screen.queryByText(/pacientů v registru/)).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Nově v kartotéce' })).not.toBeInTheDocument();
  });
});

describe('"today" on the shelves', () => {
  it('asks the booking API for today, and for one day only', async () => {
    renderDashboard();
    await screen.findByRole('region', { name: 'Objednaní' });

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    expect(range).toHaveBeenCalledWith(expected, expected);
  });

  it('lists in Objednaní only appointments that still stand', async () => {
    range.mockResolvedValue([
      at(8, 0, 'a', 'p1'), // Scheduled -> Objednaní
      at(9, 3, 'b', 'p2'), // Completed -> not
      at(1, 4, 'c', 'p2'), // Cancelled -> not
      at(3, 5, 'e', 'p2'), // NoShow -> not
    ]);

    renderDashboard();

    const card = await shelf('Objednaní');
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText('Anna Černá')).not.toBeInTheDocument();
  });

  it('puts only a checked-in patient in Čekárna, not a completed one', async () => {
    range.mockResolvedValue([
      at(8, 2, 'a', 'p1'), // CheckedIn -> Čekárna
      at(9, 3, 'b', 'p2'), // Completed -> not the waiting room
    ]);

    renderDashboard();

    const card = await shelf('Čekárna');
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText('Anna Černá')).not.toBeInTheDocument();
  });

  it('shows a name rather than an id when the patient is known, as a link to the card', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();

    const card = await shelf('Objednaní');
    const name = await card.findByText('Jana Marková');
    expect(name.closest('a')).toHaveAttribute('href', '/patients/p1');
    expect(card.queryByText(/^p1$/)).not.toBeInTheDocument();
    expect(getById).toHaveBeenCalledWith('p1');
  });

  it('opens the booking itself from the row', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();

    const card = await shelf('Objednaní');
    const open = await card.findByRole('link', { name: /Otevřít termín: Jana Marková/ });
    expect(open).toHaveAttribute('href', '/kalendar/c1/termin/a');
  });

  it('does not ask for the same patients again on coming back', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 0, 'b', 'p2')]);
    const queryClient = new QueryClient();

    const first = renderDashboard(queryClient);
    expect(await (await shelf('Objednaní')).findByText('Anna Černá')).toBeInTheDocument();
    first.unmount();

    renderDashboard(queryClient);
    expect(await (await shelf('Objednaní')).findByText('Jana Marková')).toBeInTheDocument();

    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state, with the next action, when nobody is booked for today', async () => {
    range.mockResolvedValue([at(8, 4, 'a'), at(9, 5, 'b')]);

    renderDashboard();

    const card = await shelf('Objednaní');
    expect(await card.findByText('Na dnešek nikdo objednaný.')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Objednat termín' })).toHaveAttribute('href', '/planovani');
  });
});

/*
 * The day's facts at the top: the figures count the same lists the shelves show, so the number and the list can never
 * disagree. Cancelled and no-show rows are not "objednáno"; a missing questionnaire is counted once per appointment that
 * still stands.
 */
describe('the figures', () => {
  it('count standing appointments, the waiting room and missing paperwork', async () => {
    range.mockResolvedValue([
      at(8, 0, 'a', 'p1', false), // Scheduled, paperwork missing
      at(9, 1, 'b', 'p2', true),  // Confirmed
      at(10, 2, 'c', 'p1', false), // CheckedIn -> waiting, paperwork missing
      at(11, 4, 'd', 'p2', false), // Cancelled -> counts nowhere
    ]);

    renderDashboard();

    expect((await metric('Dnes objednáno')).getByText('2')).toBeInTheDocument();
    expect((await metric('V čekárně')).getByText('1')).toBeInTheDocument();
    expect((await metric('Chybí podklady')).getByText('2')).toBeInTheDocument();
  });

  it('each one is a link to where it is worked on', async () => {
    renderDashboard();
    const booked = await screen.findByRole('link', { name: /^Dnes objednáno/ });
    expect(booked).toHaveAttribute('href', '/dnes');
    expect(await screen.findByRole('link', { name: /^Kartotéka/ })).toHaveAttribute('href', '/patients');
  });
});

describe('Vyžaduje pozornost', () => {
  it('flags an appointment whose paperwork is not ready, as a link to the place that fixes it', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1', false)]);

    renderDashboard();

    const card = await shelf('Vyžaduje pozornost');
    const group = (await card.findByText('Dnes bez podkladů')).closest('[data-attention]') as HTMLElement;
    expect(group).toHaveAttribute('data-attention', 'paperworkToday');
    const row = await within(group).findByRole('link', { name: /Jana Marková/ });
    expect(row).toHaveAttribute('href', '/kalendar/c1/termin/a');
    expect(row).toHaveTextContent(/chybí dotazník/);
  });

  it('says all is clear when every source answered and nothing waits', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1', true)]);

    renderDashboard();

    const card = await shelf('Vyžaduje pozornost');
    expect(await card.findByText(/Vše vyřízeno/)).toBeInTheDocument();
  });

  it('counts what other lists say: overdue invoices (with the permission), club inquiries and registrations waiting', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register', 'billing.manage']));
    getInvoices.mockResolvedValue([
      {
        id: 'i1', patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: 'FA-1', status: 'Issued', totalCzk: 1000, paidCzk: 0, remainingCzk: 1000,
        currency: 'CZK', issueDateUtc: '2020-01-01T10:00:00Z', dueDateUtc: '2020-01-15T10:00:00Z', items: [],
      },
    ]);
    listClubOrders.mockResolvedValue([{ id: 'o1', clubId: 'c1', clubName: 'FC Sparta', status: 'Requested', totalSeats: 12, submittedAtUtc: '2026-10-01T10:00:00Z' }]);
    fetchIntakeQueue.mockResolvedValue([{ intakeId: 'x', referenceNumber: 'REG-1', givenName: 'Eva', familyName: 'Nová', submittedAtUtc: '2026-10-02T10:00:00Z' }]);

    renderDashboard();

    const card = await shelf('Vyžaduje pozornost');
    expect(await card.findByText('Faktury po splatnosti')).toBeInTheDocument();
    expect(await card.findByText('Poptávky klubů')).toBeInTheDocument();
    expect(await card.findByText('Registrace ke kontrole')).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Faktura FA-1/ })).toHaveAttribute('href', '/billing');
    expect(card.getByRole('link', { name: /FC Sparta/ })).toHaveAttribute('href', '/clubs/objednavky');
    expect(card.getByRole('link', { name: /Eva Nová/ })).toHaveAttribute('href', '/intake-review');
  });

  it('does not ask for invoices, registrations or health without the permission', async () => {
    renderDashboard();
    await shelf('Vyžaduje pozornost');
    expect(getInvoices).not.toHaveBeenCalled();
    expect(fetchIntakeQueue).not.toHaveBeenCalled();
  });

  it('says it could not look instead of "all clear" when the only source fails', async () => {
    listClubOrders.mockRejectedValue(new Error('500'));

    renderDashboard();

    const card = await shelf('Vyžaduje pozornost');
    expect(await card.findByRole('alert')).toHaveTextContent(/nepodařilo načíst/);
    expect(card.queryByText(/Vše vyřízeno/)).not.toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

describe('Nový pacient', () => {
  it('is offered to somebody who may register a patient', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));

    renderDashboard();

    expect(await screen.findByRole('link', { name: 'Nový pacient' })).toHaveAttribute('href', '/patients/register');
  });

  it('is not offered to somebody who may not', async () => {
    renderDashboard();
    await screen.findByText('Najít pacienta');

    expect(screen.queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
  });
});

describe('Najít pacienta', () => {
  it('searches the register as the person types and links each result to its card', async () => {
    search.mockResolvedValue([{ id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-01-02' }]);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderDashboard();
    await user.type(await screen.findByLabelText('Vyhledání pacienta'), 'Mark');

    expect(await screen.findByText('Marková Jana')).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith('Mark');
  });
});

/*
 * Three layouts: the same plocha at 390 / 834 / 1440. Phone: rows are cards in a list, the figures swipe, the main action
 * is pinned at the bottom. Tablet and desktop: the shelves, no tables, the action in the header.
 */
describe('three layouts', () => {
  it('phone: rows are a list of cards, the figures are a swipeable row and "Otevřít kalendář" is pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 1, 'b', 'p2')]);

    const { container } = renderDashboard();

    const objednani = await shelf('Objednaní');
    const rows = await objednani.findByRole('list', { name: 'Objednaní' });
    expect(within(rows).getAllByRole('listitem')).toHaveLength(2);
    expect(await objednani.findByText('Jana Marková')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();

    expect(container.querySelector('[data-shelf="today-figures"]')).not.toBeNull();

    const pinned = screen.getByRole('region', { name: 'Hlavní akce' });
    expect(pinned).toHaveAttribute('data-pinned', 'true');
    expect(within(pinned).getByRole('link', { name: 'Otevřít kalendář' })).toBeInTheDocument();
    /* The header no longer carries the same button: it is never drawn twice up there. */
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
    expect(within(header).queryByRole('link', { name: 'Otevřít kalendář' })).toBeNull();
  });

  it('phone: the search field and "Nový pacient" are 44px targets', async () => {
    setViewport(VIEWPORTS.phone);
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));
    renderDashboard();

    const button = await screen.findByRole('link', { name: 'Nový pacient' });
    expect(getComputedStyle(button).minHeight).toBe('44px');
  });

  it.each([['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    '%s: shelves, no tables, the action in the header and the search button beside it',
    async (_name, width) => {
      setViewport(width);
      range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

      const { container } = renderDashboard();

      expect(await (await shelf('Objednaní')).findByText('Jana Marková')).toBeInTheDocument();
      expect(container.querySelector('table')).toBeNull();
      for (const id of ['today-figures', 'attention', 'find-patient', 'booked', 'waiting', 'recents']) {
        expect(container.querySelector(`[data-shelf="${id}"]`), id).not.toBeNull();
      }
      expect(screen.queryByRole('region', { name: 'Hlavní akce' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Otevřít kalendář' })).toHaveAttribute('href', '/planovani');
      expect(screen.getByRole('button', { name: 'Hledat' })).toBeInTheDocument();
    },
  );

  it('every shelf is a labelled region with its own heading', async () => {
    renderDashboard();
    await shelf('Objednaní');
    for (const name of ['Dnes', 'Vyžaduje pozornost', 'Najít pacienta', 'Objednaní', 'Čekárna', 'Připnuté a nedávné']) {
      expect(screen.getByRole('region', { name }), name).toBeInTheDocument();
    }
  });
});

/*
 * Etapa 12, "ceny všude": the plocha says what the day earns and what each
 * visit costs - the agreed price first, the row's list price next, the
 * catalogue last. A cancellation and a no-show earn nothing.
 */
describe('the prices on the plocha', () => {
  it('sums today\'s standing visits into a "Dnes" figure, agreed prices included', async () => {
    range.mockResolvedValue([
      { ...at(8, 0, 'a', 'p1'), agreedPriceCzk: null, listPriceCzk: 1600 },  // the list stands
      { ...at(9, 2, 'b', 'p2'), agreedPriceCzk: 1200, listPriceCzk: 1600 },  // agreed, checked in
      at(10, 0, 'c', 'p1'),                                                  // no price on the row: the catalogue's 900
      { ...at(11, 4, 'd', 'p2'), agreedPriceCzk: null, listPriceCzk: 1600 }, // cancelled: nothing
      { ...at(12, 5, 'e', 'p2'), agreedPriceCzk: null, listPriceCzk: 1600 }, // no-show: nothing
    ]);

    renderDashboard();

    /* 1 600 + 1 200 + the catalogue's 900, once the catalogue has answered. */
    expect(await (await metric('Dnes')).findByText(withText('3 700 Kč'))).toBeInTheDocument();
    expect(listActivities).toHaveBeenCalledTimes(1);
  });

  it('asks for the catalogue only when some row carries no price', async () => {
    range.mockResolvedValue([{ ...at(8, 0, 'a', 'p1'), agreedPriceCzk: null, listPriceCzk: 1600 }]);
    renderDashboard();
    expect((await metric('Dnes')).getByText(withText('1 600 Kč'))).toBeInTheDocument();
    expect(listActivities).not.toHaveBeenCalled();
  });

  it.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet], ['phone', VIEWPORTS.phone]])(
    '%s: every row in Objednaní and Čekárna carries its price under the činnost',
    async (_n, width) => {
      setViewport(width);
      range.mockResolvedValue([
        { ...at(8, 0, 'a', 'p1'), agreedPriceCzk: 1200, listPriceCzk: 1600 },
        { ...at(9, 2, 'b', 'p2'), agreedPriceCzk: null, listPriceCzk: 1600 },
      ]);

      renderDashboard();

      expect(await (await shelf('Objednaní')).findByText(withText('Kontrola · 1 200 Kč (upraveno)'))).toBeInTheDocument();
      expect(await (await shelf('Čekárna')).findByText(withText('Kontrola · 1 600 Kč'))).toBeInTheDocument();
    },
  );
});
