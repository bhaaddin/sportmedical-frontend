/*
 * Etapa 6: the club-order setup asks Služba first, the činnosti of THAT service only (hint until chosen), and counts
 * players with one number field and a single - / + (step 1) - no +-10.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const { getAllClubs, listActivities, listServices } = vi.hoisted(() => ({ getAllClubs: vi.fn(), listActivities: vi.fn(), listServices: vi.fn() }));

vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: listActivities };
});

const { PickOrderSetup } = await import('./PickOrderSetup');

const SERVICES = [
  { id: 's-1', name: 'Prohlídky', isActive: true, sortOrder: 0 },
  { id: 's-2', name: 'Fyzioterapie', isActive: true, sortOrder: 1 },
];

function mount(onStart = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PickOrderSetup open onClose={vi.fn()} onStart={onStart} defaultClubId="club-1" />
    </QueryClientProvider>,
  );
  return onStart;
}

beforeEach(() => {
  getAllClubs.mockReset().mockResolvedValue([{ id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' }]);
  listServices.mockReset().mockResolvedValue(SERVICES);
  listActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní', durationMinutes: 30, colorHex: '#111111', clinicServiceId: 's-1', parallelCapacity: 1 },
    { id: 'a-2', name: 'Komplexní', durationMinutes: 45, colorHex: '#222222', clinicServiceId: 's-1', parallelCapacity: 1 },
    { id: 'a-9', name: 'Masáž', durationMinutes: 30, colorHex: '#333333', clinicServiceId: 's-2', parallelCapacity: 1 },
  ]);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('service first · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('hides the činnosti behind a hint until a service is chosen, then lists only that service', async () => {
    const user = userEvent.setup();
    mount();
    const setup = await screen.findByTestId('pick-setup');
    expect(await within(setup).findByText('Nejdřív vyberte službu — nabídnou se její činnosti.')).toBeInTheDocument();
    expect(within(setup).queryByText('Základní')).toBeNull();

    await user.click(within(setup).getByRole('combobox', { name: 'Služba' }));
    await user.click(await screen.findByRole('option', { name: 'Prohlídky' }));
    expect(await within(setup).findByText('Základní')).toBeInTheDocument();
    expect(within(setup).getByText('Komplexní')).toBeInTheDocument();
    expect(within(setup).queryByText('Masáž')).toBeNull();

    await user.click(within(setup).getByRole('checkbox', { name: /Základní/ }));
    await user.click(within(setup).getByRole('combobox', { name: 'Služba' }));
    await user.click(await screen.findByRole('option', { name: 'Fyzioterapie' }));
    expect(await within(setup).findByText('Masáž')).toBeInTheDocument();
    expect(within(setup).queryByText('Základní')).toBeNull();
  });

  it('counts with one field and a single - / + (step 1), shows the breakdown, has no +-10', async () => {
    const user = userEvent.setup();
    mount();
    const setup = await screen.findByTestId('pick-setup');
    await user.click(within(setup).getByRole('combobox', { name: 'Služba' }));
    await user.click(await screen.findByRole('option', { name: 'Prohlídky' }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Základní/ }));
    await user.click(within(setup).getByRole('checkbox', { name: /Komplexní/ }));

    const base = within(setup).getByRole('textbox', { name: 'Počet hráčů, Základní' });
    const complex = within(setup).getByRole('textbox', { name: 'Počet hráčů, Komplexní' });
    expect(within(setup).queryByText('−10')).toBeNull();
    expect(within(setup).queryByText('+10')).toBeNull();
    expect(within(setup).getAllByRole('button', { name: /^Přidat hráče/ })).toHaveLength(2);

    for (let i = 0; i < 10; i += 1) await user.click(within(setup).getByRole('button', { name: 'Přidat hráče, Základní' }));
    await user.type(complex, '10');
    expect(base).toHaveValue('10');
    expect(complex).toHaveValue('10');
    await user.click(within(setup).getByRole('button', { name: 'Ubrat hráče, Základní' }));
    expect(base).toHaveValue('9');
    await user.click(within(setup).getByRole('button', { name: 'Přidat hráče, Základní' }));
    expect(within(setup).getByTestId('order-seats-breakdown')).toHaveTextContent('Základní 10 · Komplexní 10');
    expect(within(setup).getByTestId('order-total-seats')).toHaveTextContent('Celkem 20');
  });
});

describe('a single service is preselected', () => {
  beforeEach(() => {
    setViewport(VIEWPORTS.desktop);
    listServices.mockReset().mockResolvedValue([SERVICES[0]]);
  });
  it('shows its činnosti at once', async () => {
    mount();
    const setup = await screen.findByTestId('pick-setup');
    expect(await within(setup).findByText('Základní')).toBeInTheDocument();
  });
});
