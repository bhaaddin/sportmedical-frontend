/*
 * Slevy a cenové hladiny - the board's editor.
 *
 * The rows are the server's, the names are places ("Hladina 1") because the
 * API has none, the preview prices what is on screen, and Zahodit puts the
 * server's rows back without a request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupDiscountsPage from './GroupDiscountsPage';

const { readGroupDiscounts, saveGroupDiscounts, listActivities } = vi.hoisted(() => ({
  readGroupDiscounts: vi.fn(),
  saveGroupDiscounts: vi.fn(),
  listActivities: vi.fn(),
}));

vi.mock('../../api/groupDiscounts', () => ({
  GROUP_DISCOUNTS_QUERY_KEY: ['settings', 'group-discounts'],
  readGroupDiscounts,
  saveGroupDiscounts,
}));

vi.mock('../../api/activities', () => ({
  activitiesApi: { list: listActivities },
}));

const TIERS = [
  { minHeadcount: 5, maxHeadcount: 9, percent: 5 },
  { minHeadcount: 10, maxHeadcount: 19, percent: 10 },
  { minHeadcount: 20, maxHeadcount: null, percent: 20 },
];

beforeEach(() => {
  readGroupDiscounts.mockReset();
  saveGroupDiscounts.mockReset();
  listActivities.mockReset();
  readGroupDiscounts.mockResolvedValue({
    settings: { tiers: TIERS },
    defaults: { tiers: TIERS.slice(0, 1) },
    maxTiers: 5,
  });
  listActivities.mockResolvedValue({
    activities: [
      { id: 'a', name: 'Základní prohlídka', priceCzk: 1600, isActive: true },
      { id: 'b', name: 'Komplexní prohlídka', priceCzk: 2200, isActive: true },
    ],
    warnings: [],
  });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/skupinove-slevy']}>
        <GroupDiscountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the tier editor', () => {
  it('draws the board\'s table with a tier per row, named by its place', async () => {
    renderPage();

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Název hladiny', 'Od', 'Do', 'Sleva', 'Akce']);

    expect(within(table).getByText('Hladina 1')).toBeInTheDocument();
    expect(within(table).getByText('Hladina 3')).toBeInTheDocument();
    expect(within(table).queryByText(/Malá skupina|Celý tým/)).not.toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Odebrat' })).toHaveLength(3);
    expect(screen.getByLabelText('Hladina 2 od')).toHaveValue(10);
    expect(screen.getByLabelText('Hladina 3 do')).toHaveValue(null);
  });

  it('prices the sample order on the dearest činnost, with the tier taken off', async () => {
    renderPage();

    expect(await screen.findByText('12 × Komplexní prohlídka')).toBeInTheDocument();
    expect(screen.getByText('26 400 Kč')).toBeInTheDocument();
    expect(screen.getByText('Hladina 2 −10 %')).toBeInTheDocument();
    expect(screen.getByText('−2 640 Kč')).toBeInTheDocument();
    expect(screen.getByText('23 760 Kč')).toBeInTheDocument();
  });

  it('lets a row go, and Zahodit brings the server\'s rows back without saving', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Hladina 3');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Odebrat' })[2]);
    expect(screen.queryByText('Hladina 3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(await screen.findByText('Hladina 3')).toBeInTheDocument();
    expect(saveGroupDiscounts).not.toHaveBeenCalled();
  });

  it('adds a tier and saves what is on screen', async () => {
    const user = userEvent.setup();
    saveGroupDiscounts.mockImplementation(async (settings) => ({
      settings,
      defaults: { tiers: TIERS.slice(0, 1) },
      maxTiers: 5,
    }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Přidat hladinu/ }));
    expect(screen.getByText('Hladina 4')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Hladina 4 od'), '30');
    await user.type(screen.getByLabelText('Hladina 4 sleva'), '25');

    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
    expect(saveGroupDiscounts).toHaveBeenCalledWith({
      tiers: [...TIERS, { minHeadcount: 30, maxHeadcount: null, percent: 25 }],
    });
  });

  it('points at the price list and the clubs', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Otevřít ceník' })).toHaveAttribute('href', '/nastaveni/cenik');
    expect(screen.getByRole('link', { name: 'Kluby' })).toHaveAttribute('href', '/clubs');
  });

  it('says the tiers are recommendations - the club discount is the administrator choice', async () => {
    renderPage();
    expect(await screen.findByText(/slevu klubu určuje administrátor na kartě klubu/)).toBeInTheDocument();
    expect(screen.getByText('Doporučené hladiny slev')).toBeInTheDocument();
    expect(screen.getByText('Příklad')).toBeInTheDocument();
    expect(screen.queryByText('Náhled')).not.toBeInTheDocument();
  });
});
