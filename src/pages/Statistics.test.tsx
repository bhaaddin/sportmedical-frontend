/*
 * Statistiky, clicked through. `statistics/aggregate.test.ts` holds the
 * arithmetic; what only the screen can show is that the KPIs read the period
 * and compare it with the one before, that the appointments are fetched a
 * month at a time and never over the API's 62-day limit, that every chart has
 * its table and its CSV, that the area chips narrow the page, and that an
 * empty period says what will appear.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../test/viewport';
import type { ReactNode } from 'react';
import { addDaysToDateOnly, toDateOnly } from '../utils/time';
import { daysIn, monthOf, previousPeriod } from './statistics/aggregate';

const range = vi.fn();
const listPatients = vi.fn();
const getInvoices = vi.fn();

vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));
vi.mock('../api/patients', () => ({
  PATIENT_PAGE_SIZE_MAX: 100,
  patientsApi: { list: listPatients },
}));
vi.mock('../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null },
    ]),
  },
}));

const { default: StatisticsPage } = await import('./Statistics');

/* recharts measures its container with ResizeObserver, which jsdom lacks. */
beforeAll(() => {
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

const today = toDateOnly(new Date());
const thisMonth = monthOf(today);
const lastMonth = previousPeriod(thisMonth);
const at = (day: string, time = '10:00:00') => `${day}T${time}Z`;

const appt = (id: string, startUtc: string, status: number, activityName: string, patientId: string) => ({
  id, calendarId: 'c-1', patientId, activityId: 'a-1', activityName, startUtc, endUtc: startUtc,
  status, isRunningLate: false, checkedInUtc: null, paperwork: null, patientName: null,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/statistiky']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  range.mockReset().mockImplementation(async (from: string, to: string) => {
    const rows = [
      appt('1', at(thisMonth.from), 0, 'Základní prohlídka', 'p-1'),
      appt('2', at(addDaysToDateOnly(thisMonth.from, 1)), 3, 'Komplexní prohlídka', 'p-2'),
      appt('3', at(addDaysToDateOnly(thisMonth.from, 1), '11:00:00'), 4, 'Základní prohlídka', 'p-1'),
      appt('4', at(lastMonth.from), 3, 'Základní prohlídka', 'p-1'),
    ];
    return rows.filter((r) => r.startUtc.slice(0, 10) >= from && r.startUtc.slice(0, 10) <= to);
  });
  listPatients.mockReset().mockResolvedValue({
    items: [
      { id: 'p-1', firstName: 'Jan', lastName: 'Novák', dateOfBirth: '1990-01-01', sex: 'M', createdAtUtc: '2025-03-01T10:00:00Z', updatedAtUtc: '' },
      { id: 'p-2', firstName: 'Eva', lastName: 'Malá', dateOfBirth: '1992-01-01', sex: 'F', createdAtUtc: at(thisMonth.from), updatedAtUtc: '' },
    ],
    totalCount: 2,
    page: 1,
    pageSize: 100,
  });
  getInvoices.mockReset().mockResolvedValue([
    { id: 'i-1', patientId: 'p-1', patientName: 'Jan Novák', invoiceNumber: '2026-001', status: 'Paid', totalCzk: 1600, paidCzk: 1600, remainingCzk: 0, currency: 'CZK', issueDateUtc: at(thisMonth.from), dueDateUtc: at(thisMonth.to), items: [{ id: 'l1', description: 'Základní prohlídka', serviceCode: 'Z', quantity: 1, unitPriceCzk: 1600, amountCzk: 1600 }] },
    { id: 'i-2', patientId: 'p-2', patientName: 'Eva Malá', invoiceNumber: '2026-002', status: 'Issued', totalCzk: 2200, paidCzk: 0, remainingCzk: 2200, currency: 'CZK', issueDateUtc: at(addDaysToDateOnly(thisMonth.from, 1)), dueDateUtc: at(thisMonth.to), items: [{ id: 'l2', description: 'Komplexní prohlídka', serviceCode: 'K', quantity: 1, unitPriceCzk: 2200, amountCzk: 2200 }] },
    { id: 'i-3', patientId: 'p-1', patientName: 'Jan Novák', invoiceNumber: '2026-000', status: 'Paid', totalCzk: 1000, paidCzk: 1000, remainingCzk: 0, currency: 'CZK', issueDateUtc: at(lastMonth.from), dueDateUtc: at(lastMonth.to), items: [] },
  ]);
});

const kpi = (label: string) => screen.findByRole('group', { name: label });

describe('Statistiky', () => {
  it('reads this month against last month and fetches the appointments a month at a time', async () => {
    render(<Wrap><StatisticsPage /></Wrap>);

    expect(screen.getByRole('heading', { name: 'Statistiky' })).toBeInTheDocument();

    const bookings = await kpi('Objednávky');
    await waitFor(() => expect(within(bookings).getByText('2')).toBeInTheDocument());
    expect(within(bookings).getByText('+100 % oproti minulému období')).toBeInTheDocument();

    const newPatients = await kpi('Noví pacienti');
    await waitFor(() => expect(within(newPatients).getByText('1')).toBeInTheDocument());

    const invoiced = await kpi('Vyfakturováno');
    await waitFor(() => expect(within(invoiced).getByText(/3.800 Kč/)).toBeInTheDocument());
    expect(within(invoiced).getByText('+280 % oproti minulému období')).toBeInTheDocument();

    const unpaid = await kpi('Nezaplaceno');
    expect(within(unpaid).getByText(/2.200 Kč/)).toBeInTheDocument();

    /* The previous month and this one: two bounded requests, never more than 62 days each. */
    expect(range).toHaveBeenCalledTimes(2);
    for (const [from, to] of range.mock.calls as [string, string][]) {
      expect(daysIn({ from, to })).toBeLessThanOrEqual(62);
    }
    expect(range).toHaveBeenCalledWith(lastMonth.from, lastMonth.to);
    expect(range).toHaveBeenCalledWith(thisMonth.from, thisMonth.to);
    expect(listPatients).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('shows the numbers behind a chart as a table and exports them as CSV', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:statistiky');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<Wrap><StatisticsPage /></Wrap>);
    const card = await screen.findByRole('article', { name: 'Podle činnosti' });
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Export CSV' })).toBeEnabled());

    await user.click(within(card).getByRole('button', { name: 'Tabulka' }));
    const table = within(card).getByRole('table', { name: 'Tabulka: Podle činnosti' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['Komplexní prohlídka1', 'Základní prohlídka1']);

    await user.click(within(card).getByRole('button', { name: 'Export CSV' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    /* `Blob.text()` decodes the BOM away; the bytes keep it, which is what Excel reads. */
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('Činnost;Objednávky\r\nKomplexní prohlídka;1\r\nZákladní prohlídka;1\r\n');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:statistiky');
    click.mockRestore();
  });

  it('narrows the page to one area and says what an empty period will show', async () => {
    getInvoices.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Wrap><StatisticsPage /></Wrap>);
    await screen.findByRole('article', { name: 'Podle činnosti' });

    await user.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.queryByRole('article', { name: 'Podle činnosti' })).not.toBeInTheDocument();
    expect(screen.queryByText('Noví pacienti')).not.toBeInTheDocument();
    expect(await screen.findByText('Průměr na návštěvu')).toBeInTheDocument();
    expect(screen.getAllByText('Zatím žádné doklady v tomto období.')).toHaveLength(2);
    const unpaid = await kpi('Nezaplaceno');
    expect(within(unpaid).getByText('minulé období bez dat')).toBeInTheDocument();
  });

  it('keeps the other numbers when one source fails and offers a retry', async () => {
    getInvoices.mockRejectedValue(new Error('500'));
    render(<Wrap><StatisticsPage /></Wrap>);

    const bookings = await kpi('Objednávky');
    await waitFor(() => expect(within(bookings).getByText('2')).toBeInTheDocument());
    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent('Nepodařilo se načíst doklady. Ostatní čísla platí.');
    expect(within(note).getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

/*
 * Three layouts (Etapa 2, rule 3): the same screen at 390 / 834 / 1440.
 * Phone: the areas are tabs and the charts stack one per row. Desktop: all
 * three groups, chart cards in a grid, "Vše" among the chips.
 */
describe('Statistiky at three widths', () => {
  it('phone: three tabs, one area at a time, charts stacked, export pinned', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = render(<Wrap><StatisticsPage /></Wrap>);

    const tabs = await screen.findByRole('tablist', { name: 'Oblast' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Objednávky', 'Pacienti', 'Finance']);
    expect(within(tabs).getByRole('tab', { name: 'Objednávky' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Vše' })).toBeNull();

    /* Only the selected group is on the page, and its cards sit one per row. */
    expect(await screen.findByRole('article', { name: 'Podle činnosti' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Nové registrace' })).toBeNull();
    const grid = container.querySelector('section[aria-label="Objednávky"] [data-layout]')!;
    expect(grid).toHaveAttribute('data-layout', 'stack');
    expect(getComputedStyle(grid).gridTemplateColumns).toBe('minmax(0, 1fr)');

    /* The tab hands over to another group. */
    const user = userEvent.setup();
    await user.click(within(tabs).getByRole('tab', { name: 'Finance' }));
    expect(await screen.findByRole('article', { name: 'Vyfakturováno a zaplaceno' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Podle činnosti' })).toBeNull();

    const pinned = screen.getByRole('region', { name: 'Hlavní akce' });
    expect(within(pinned).getByRole('button', { name: 'Exportovat zobrazené (CSV)' })).toBeInTheDocument();
    expect(getComputedStyle(within(tabs).getAllByRole('tab')[0]).minHeight).toBe('44px');
  });

  it('desktop: no tabs, every group on the page, charts in a grid, "Vše" offered', async () => {
    setViewport(VIEWPORTS.desktop);
    const { container } = render(<Wrap><StatisticsPage /></Wrap>);

    expect(await screen.findByRole('article', { name: 'Vyfakturováno a zaplaceno' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    for (const name of ['Objednávky', 'Pacienti', 'Finance']) {
      expect(container.querySelector(`section[aria-label="${name}"]`)).not.toBeNull();
    }
    expect(container.querySelector('section[aria-label="Objednávky"] [data-layout]')).toHaveAttribute('data-layout', 'grid');
    expect(screen.getByRole('button', { name: 'Vše' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hlavní akce' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Exportovat zobrazené (CSV)' })).toBeInTheDocument();
  });

  it('tablet: no tabs, every group, cards in a grid that fits', async () => {
    setViewport(VIEWPORTS.tablet);
    const { container } = render(<Wrap><StatisticsPage /></Wrap>);

    expect(await screen.findByRole('article', { name: 'Nové registrace' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(container.querySelector('section[aria-label="Pacienti"] [data-layout]')).toHaveAttribute('data-layout', 'grid');
  });
});

describe('the page-level CSV', () => {
  it('exports every chart on screen, Czech headers, no personal identifiers', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:vse');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<Wrap><StatisticsPage /></Wrap>);
    const button = await screen.findByRole('button', { name: 'Exportovat zobrazené (CSV)' });
    await waitFor(() => expect(button).toBeEnabled());
    await waitFor(() => expect(screen.getByRole('article', { name: 'Vyfakturováno a zaplaceno' })).toHaveAttribute('data-state', 'ready'));

    await user.click(button);
    const text = await createObjectURL.mock.calls[0][0].text();
    const lines = text.split('\r\n');
    expect(lines[0]).toBe(`Statistiky;Období ${thisMonth.from} až ${thisMonth.to}`);
    expect(lines).toContain('Podle činnosti');
    expect(lines).toContain('Činnost;Objednávky');
    expect(lines).toContain('Komplexní prohlídka;1');
    expect(lines).toContain('Období;Vyfakturováno (Kč);Zaplaceno (Kč)');
    expect(lines).toContain('Nové registrace');
    /* Patients' names are in the fixtures; none may reach the file. */
    expect(text).not.toMatch(/Novák|Malá/);
    click.mockRestore();
  });

  it('exports only the group the phone is looking at', async () => {
    setViewport(VIEWPORTS.phone);
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:obj');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<Wrap><StatisticsPage /></Wrap>);
    const button = await screen.findByRole('button', { name: 'Exportovat zobrazené (CSV)' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    const text = await createObjectURL.mock.calls[0][0].text();
    expect(text).toContain('Podle činnosti');
    expect(text).not.toContain('Nové registrace');
    expect(text).not.toContain('Vyfakturováno (Kč)');
    click.mockRestore();
  });
});

describe('every chart states its state', () => {
  it('says what is missing for an empty period, with the same card height', async () => {
    setViewport(VIEWPORTS.desktop);
    range.mockResolvedValue([]);
    render(<Wrap><StatisticsPage /></Wrap>);

    const card = await screen.findByRole('article', { name: 'Podle činnosti' });
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'empty'));
    expect(within(card).getByText(/Za zvolené období zatím nic/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('shows a failed chart with its own "Zkusit znovu" that asks again', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    getInvoices.mockRejectedValueOnce(new Error('500'));
    render(<Wrap><StatisticsPage /></Wrap>);

    const card = await screen.findByRole('article', { name: 'Tržby podle činnosti' });
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'error'));
    await user.click(within(card).getByRole('button', { name: 'Zkusit znovu' }));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'ready'));
  });

  it('holds a placeholder while loading', async () => {
    setViewport(VIEWPORTS.desktop);
    range.mockImplementation(() => new Promise(() => undefined));
    render(<Wrap><StatisticsPage /></Wrap>);

    const card = await screen.findByRole('article', { name: 'Podle činnosti' });
    expect(card).toHaveAttribute('data-state', 'loading');
    expect(within(card).getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });
});

