/*
 * The plocha (owner/admin home): a patient search at its centre and four panels
 * — Objednaní, Čekárna, Historie, Notifikace. The behaviours worth pinning are
 * the ones that were bugs before:
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

vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));
vi.mock('../api/patients', () => ({ patientsApi: { getById, list, search } }));

const PEOPLE: Record<string, { id: string; firstName: string; lastName: string; dateOfBirth: string }> = {
  p1: { id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-01-02' },
  p2: { id: 'p2', firstName: 'Anna', lastName: 'Černá', dateOfBirth: '1985-06-07' },
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  getById.mockReset().mockImplementation((id: string) =>
    PEOPLE[id] ? Promise.resolve(PEOPLE[id]) : Promise.reject(new Error('404')));
  list.mockReset().mockResolvedValue({ items: [], totalCount: 137, page: 1, pageSize: 1 });
  search.mockReset().mockResolvedValue([]);
  range.mockReset().mockResolvedValue([]);
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
  paperwork: { ready: paperworkReady, missing: [] },
});

/** The bordered card a panel's title sits in (the board's SoftCard is a Paper). */
const panel = async (title: string) => {
  const heading = await screen.findByText(title);
  return within(heading.closest('.MuiPaper-root') as HTMLElement);
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
    await screen.findByText('Vyhledání pacienta');

    expect(screen.queryByText(/pacientů v registru/)).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});

describe('"today" in the panels', () => {
  it('asks the booking API for today, and for one day only', async () => {
    renderDashboard();
    await screen.findByText('Objednaní');

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

    const card = await panel('Objednaní');
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText('Anna Černá')).not.toBeInTheDocument();
  });

  it('puts only a checked-in patient in Čekárna, not a completed one', async () => {
    range.mockResolvedValue([
      at(8, 2, 'a', 'p1'), // CheckedIn -> Čekárna
      at(9, 3, 'b', 'p2'), // Completed -> not the waiting room
    ]);

    renderDashboard();

    const card = await panel('Čekárna');
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText('Anna Černá')).not.toBeInTheDocument();
  });

  it('shows a name rather than an id when the patient is known', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();

    const card = await panel('Objednaní');
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText(/^p1$/)).not.toBeInTheDocument();
    expect(getById).toHaveBeenCalledWith('p1');
  });

  it('does not ask for the same patients again on coming back', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 0, 'b', 'p2')]);
    const queryClient = new QueryClient();

    const first = renderDashboard(queryClient);
    expect(await (await panel('Objednaní')).findByText('Anna Černá')).toBeInTheDocument();
    first.unmount();

    renderDashboard(queryClient);
    expect(await (await panel('Objednaní')).findByText('Jana Marková')).toBeInTheDocument();

    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when nobody is booked for today', async () => {
    range.mockResolvedValue([at(8, 4, 'a'), at(9, 5, 'b')]);

    renderDashboard();

    const card = await panel('Objednaní');
    expect(await card.findByText('Na dnešek nikdo objednaný.')).toBeInTheDocument();
  });
});

/*
 * The day's facts at the top (board restyle, 3. 10. 2026): the KPI cards count
 * the same lists the panels show, so the number and the list can never
 * disagree. Cancelled and no-show rows are not "objednáno"; a missing
 * questionnaire is counted once per appointment that still stands.
 */
describe('the KPI cards', () => {
  it('count standing appointments, the waiting room and missing paperwork', async () => {
    range.mockResolvedValue([
      at(8, 0, 'a', 'p1', false), // Scheduled, paperwork missing
      at(9, 1, 'b', 'p2', true),  // Confirmed
      at(10, 2, 'c', 'p1', false), // CheckedIn -> waiting, paperwork missing
      at(11, 4, 'd', 'p2', false), // Cancelled -> counts nowhere
    ]);

    renderDashboard();

    const kpi = async (label: string) =>
      within((await screen.findByText(label)).closest('.MuiPaper-root') as HTMLElement);

    expect((await kpi('Dnes objednáno')).getByText('2')).toBeInTheDocument();
    expect((await kpi('V čekárně')).getByText('1')).toBeInTheDocument();
    expect((await kpi('Chybí podklady')).getByText('2')).toBeInTheDocument();
  });
});

describe('Notifikace', () => {
  it('flags an appointment whose paperwork is not ready', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1', false)]);

    renderDashboard();

    const card = await panel('Notifikace');
    expect(await card.findByText(/Chybí podklady/)).toBeInTheDocument();
  });

  it('says all is clear when every appointment has its paperwork', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1', true)]);

    renderDashboard();

    const card = await panel('Notifikace');
    expect(await card.findByText(/žádné notifikace/i)).toBeInTheDocument();
  });
});

describe('Nový pacient', () => {
  it('is offered to somebody who may register a patient', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Nový pacient' })).toBeInTheDocument();
  });

  it('is not offered to somebody who may not', async () => {
    renderDashboard();
    await screen.findByText('Vyhledání pacienta');

    expect(screen.queryByRole('button', { name: 'Nový pacient' })).not.toBeInTheDocument();
  });
});

/*
 * Three layouts (Etapa 2, rule 3): the same plocha at 390 / 834 / 1440.
 * Phone: every row a card, the main action pinned at the bottom. Tablet: the
 * lists are tables of three columns. Desktop: four compact panels, the action
 * in the header.
 */
describe('three layouts', () => {
  const panelAt = async (title: string) => {
    const heading = await screen.findByText(title, { selector: '.MuiTypography-overline' });
    return within(heading.closest('[data-panel]') as HTMLElement);
  };

  it('phone: rows are cards, KPIs sit two-up and "Otevřít kalendář" is pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 1, 'b', 'p2')]);

    const { container } = renderDashboard();

    const objednani = await panelAt('Objednaní');
    const list = await objednani.findByRole('list', { name: 'Objednaní' });
    expect(list).toHaveAttribute('data-layout', 'cards');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(await objednani.findByText('Jana Marková')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();

    expect(container.querySelector('[data-layout="kpi-2up"]')).not.toBeNull();
    expect(container.querySelector('[data-layout="stack"]')).not.toBeNull();

    const pinned = screen.getByRole('region', { name: 'Hlavní akce' });
    expect(pinned).toHaveAttribute('data-pinned', 'true');
    expect(within(pinned).getByRole('button', { name: 'Otevřít kalendář' })).toBeInTheDocument();
    /* The header no longer carries the same button: it is never drawn twice up there. */
    const header = screen.getByRole('heading', { level: 1 }).closest('.MuiStack-root')!.parentElement!;
    expect(within(header).queryByRole('button', { name: 'Otevřít kalendář' })).toBeNull();
  });

  it('phone: the search and "Nový pacient" are 44px targets', async () => {
    setViewport(VIEWPORTS.phone);
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));
    renderDashboard();

    const button = await screen.findByRole('button', { name: 'Nový pacient' });
    expect(getComputedStyle(button).minHeight).toBe('44px');
  });

  it('tablet: the lists are tables of three columns, and nothing is pinned', async () => {
    setViewport(VIEWPORTS.tablet);
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    const { container } = renderDashboard();

    const objednani = await panelAt('Objednaní');
    const table = await objednani.findByRole('table', { name: 'Objednaní' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Čas', 'Pacient', 'Stav']);
    expect(await objednani.findByText('Jana Marková')).toBeInTheDocument();

    expect(container.querySelector('[data-layout="tablet"]')).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Hlavní akce' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Otevřít kalendář' }).length).toBeGreaterThan(0);
  });

  it('desktop: four compact panels, no tables, the action in the header', async () => {
    setViewport(VIEWPORTS.desktop);
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    const { container } = renderDashboard();

    expect(await (await panelAt('Objednaní')).findByText('Jana Marková')).toBeInTheDocument();
    expect(container.querySelector('[data-layout="four"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-panel]')).toHaveLength(4);
    expect(container.querySelector('table')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Hlavní akce' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Otevřít kalendář' }).length).toBeGreaterThan(0);
  });

  it('phone: an empty list says so in a card instead of a blank gap', async () => {
    setViewport(VIEWPORTS.phone);
    renderDashboard();

    const card = await panelAt('Čekárna');
    expect(await card.findByText('Čekárna je prázdná.')).toBeInTheDocument();
  });
});
