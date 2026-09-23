/*
 * "Dnes v kalendáři" must count today, and must count only work that still
 * stands.
 *
 * Two separate faults lived in this tile, both measured against the running
 * API rather than reasoned about:
 *
 * 1. It read `/api/scheduling/appointments?fromUtc=&toUtc=`, and that endpoint
 *    ignores its own range - asking for the year 2020 returned the same four
 *    appointments from September 2026. So a tile labelled "Schůzek dnes" was a
 *    count of every appointment that has ever existed. On 11. 9. 2026 it showed
 *    2 for a day with none, and the two it counted were eleven and thirteen
 *    days away.
 *
 * 2. Before that, it counted cancelled rows as booked: 13 where the truth was
 *    5, eight of them cancelled.
 *
 * The screen now asks the booking API, which honours the range, and drops
 * terminal statuses through `isTerminalStatus` rather than repeating the code
 * table here.
 *
 * What would have to break for these to fail: asking for a range other than
 * today, counting terminal statuses again, dropping the sort, rendering a
 * patient id where a name was available, or counting the register's first
 * page instead of asking it for its total.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const range = vi.fn();
const getById = vi.fn();
const list = vi.fn();

vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));
vi.mock('../api/patients', () => ({ patientsApi: { getById, list } }));

const PEOPLE: Record<string, { id: string; firstName: string; lastName: string }> = {
  p1: { id: 'p1', firstName: 'Jana', lastName: 'Marková' },
  p2: { id: 'p2', firstName: 'Anna', lastName: 'Černá' },
};

/* rAF never fires in a hidden document, which is exactly the case the counter
   now has to survive, so it is stubbed to do nothing at all here: the numbers
   below must be right with no frames whatsoever. */
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  getById.mockReset().mockImplementation((id: string) =>
    PEOPLE[id] ? Promise.resolve(PEOPLE[id]) : Promise.reject(new Error('404')));
  list.mockReset().mockResolvedValue({ items: [], totalCount: 137, page: 1, pageSize: 1 });
  range.mockReset().mockResolvedValue([]);
});

const { default: Dashboard } = await import('./Dashboard');

/** Status codes as the contract numbers them: 0 Scheduled … 4 Cancelled, 5 NoShow. */
const at = (hourUtc: number, status: number, id: string, patientId = 'p1') => ({
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
  paperwork: { ready: true, missing: [] },
});

const tile = async (title: string) => {
  const label = await screen.findByText(title);
  return within(label.closest('.MuiCard-root') as HTMLElement);
};

/* Every assertion about the timeline is scoped to the timeline card rather
   than to the whole page. */
const timeline = async () => {
  const heading = await screen.findByText('Dnešní harmonogram');
  return within(heading.closest('.MuiCard-root') as HTMLElement);
};

const renderDashboard = (queryClient = new QueryClient()) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the stat tiles', () => {
  /*
   * The counter animates on requestAnimationFrame, and a browser does not fire
   * it for a document it is not painting. The display started at 0 and only
   * moved inside the frame callback, so a backgrounded tab showed every tile
   * as zero while the lists beside them held data. Seen twice for real before
   * it was fixed.
   */
  it('shows the number even when no animation frame ever arrives', async () => {
    range.mockResolvedValue([at(8, 0, 'a'), at(9, 0, 'b'), at(10, 3, 'c')]);

    renderDashboard();

    const card = await tile('Dnes v kalendáři');
    expect(await card.findByText('3', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

/*
 * The register answers a page - twenty rows unless asked for more - and the
 * tile used to count that page: "Celkem registrovaných" never passed 20.
 */
describe('"Pacienti"', () => {
  it('shows the register\'s total, not the length of one page', async () => {
    renderDashboard();

    const card = await tile('Pacienti');
    expect(await card.findByText('137', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ pageSize: 1 });
  });

  it('no longer lists five alphabetical patients as "Naposledy pacienti"', async () => {
    renderDashboard();
    await screen.findByText('Dnešní harmonogram');

    expect(screen.queryByText('Naposledy pacienti')).not.toBeInTheDocument();
  });

  it('is not shown, and asks nothing, without the permission to see patients', async () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();
    await screen.findByText('Dnešní harmonogram');

    expect(screen.queryByText('Pacienti')).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });
});

describe('"Dnes v kalendari"', () => {
  it('asks for today, and for one day only', async () => {
    renderDashboard();
    await screen.findByText('Dnes v kalendáři');

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    expect(range).toHaveBeenCalledWith(expected, expected);
  });

  it('counts only the appointments that still stand', async () => {
    range.mockResolvedValue([
      at(8, 0, 'a'), // Scheduled
      at(9, 3, 'b'), // Completed
      at(1, 4, 'c'), // Cancelled
      at(2, 4, 'd'),
      at(3, 5, 'e'), // NoShow
    ]);

    renderDashboard();

    /* The counter settles a beat after the animation would have ended, so the
       wait is longer than the default second. */
    const card = await tile('Dnes v kalendáři');
    expect(await card.findByText('2', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(card.queryByText('5')).not.toBeInTheDocument();
  });

  it('does not list a cancelled appointment in the day timeline either', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 4, 'gone', 'p2')]);

    renderDashboard();

    const card = await timeline();
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText('Anna Černá')).not.toBeInTheDocument();
  });

  /*
   * The timeline used to call `.sort()` straight on the state array, which
   * reorders in place. That is fixed by sorting a copy, but there is no test
   * asserting the mutation itself and the reason is worth recording: one was
   * written and it was worthless. The rows are filtered into a new array
   * before they reach state, so the in-place sort only ever reordered an
   * internal copy nothing could observe, and putting `.sort()` back left every
   * test green. What is left is the behaviour that can actually break.
   */
  it('draws the day in time order whatever order it arrived in', async () => {
    range.mockResolvedValue([at(9, 0, 'late', 'p2'), at(8, 0, 'early', 'p1')]);

    renderDashboard();

    const card = await timeline();
    await card.findByText('Jana Marková');
    const text = (await timeline()).getByText('Jana Marková').closest('.MuiCard-root')?.textContent ?? '';
    expect(text.indexOf('Jana Marková')).toBeLessThan(text.indexOf('Anna Černá'));
  });

  it('shows a name rather than an id when the patient is known', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1')]);

    renderDashboard();

    const card = await timeline();
    expect(await card.findByText('Jana Marková')).toBeInTheDocument();
    expect(card.queryByText(/^p1$/)).not.toBeInTheDocument();
  });

  /* The names used to come from the register's first page, so a patient past
     the twentieth surname showed as an id. Each is now fetched by id. */
  it('names a patient however far down the register they are', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p2')]);

    renderDashboard();

    const card = await timeline();
    expect(await card.findByText('Anna Černá')).toBeInTheDocument();
    expect(getById).toHaveBeenCalledWith('p2');
  });

  /* One request per patient per visit was forty on a full day, every time the
     screen mounted. Coming back asks again only for what has gone stale. */
  it('does not ask for the same patients again on coming back', async () => {
    range.mockResolvedValue([at(8, 0, 'a', 'p1'), at(9, 0, 'b', 'p2'), at(10, 0, 'c', 'p1')]);
    const queryClient = new QueryClient();

    const first = renderDashboard(queryClient);
    expect(await (await timeline()).findByText('Anna Černá')).toBeInTheDocument();
    first.unmount();

    renderDashboard(queryClient);
    expect(await (await timeline()).findAllByText('Jana Marková')).toHaveLength(2);

    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when every appointment of the day was cancelled', async () => {
    range.mockResolvedValue([at(8, 4, 'a'), at(9, 5, 'b')]);

    renderDashboard();

    expect(await screen.findByText('Žádné schůzky na dnešek')).toBeInTheDocument();
  });
});

describe('the quick actions', () => {
  it('offer registering a patient to somebody who may register one', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Registrace pacienta' })).toBeInTheDocument();
  });

  it('do not offer it to somebody who may not', async () => {
    renderDashboard();
    await screen.findByText('Rychlé akce');

    expect(screen.queryByRole('button', { name: 'Registrace pacienta' })).not.toBeInTheDocument();
  });
});
