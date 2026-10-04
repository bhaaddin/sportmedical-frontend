/*
 * "Pauza mezi vyšetřeními (min)": read from and saved to /api/v1/settings/booking-slots, range from the server,
 * the server's own refusal shown under the field.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get, put }, client: { get, put } }));

const { BookingSlotsCard } = await import('./BookingSlotsCard');

const body = (minutes: number) => ({ settings: { examinationPauseMinutes: minutes }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 });

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BookingSlotsCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: body(10) });
  put.mockReset();
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('pauza · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the stored value with the help text and saves a changed one', async () => {
    put.mockResolvedValue({ data: body(15) });
    const user = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Pauza mezi vyšetřeními (min)');
    expect(field).toHaveValue('10');
    expect(screen.getByText('Systém nabídne další termín po této pauze od konce předchozí rezervace')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/settings/booking-slots');
    const save = screen.getByRole('button', { name: 'Uložit pauzu' });
    expect(save).toBeDisabled();

    await user.clear(field);
    await user.type(field, '15');
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/settings/booking-slots', { examinationPauseMinutes: 15 }));
    expect(await screen.findByText(/Uloženo/)).toBeInTheDocument();
  });
});

describe('validation', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('refuses a number outside the range the server named and anything that is not a whole number', async () => {
    const user = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Pauza mezi vyšetřeními (min)');
    await user.clear(field);
    await user.type(field, '300');
    expect(await screen.findByText('Zadejte celé číslo od 0 do 240.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
    await user.clear(field);
    await user.type(field, '1,5');
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
    await user.clear(field);
    await user.type(field, '0');
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeEnabled();
  });

  it('puts the server refusal under the field', async () => {
    put.mockRejectedValue({ response: { status: 400, data: { code: 'settings.invalid', message: 'Neplatné.', errors: { examinationPauseMinutes: ['Pauza může být nejvýše 240 minut.'] } } } });
    const user = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Pauza mezi vyšetřeními (min)');
    await user.clear(field);
    await user.type(field, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit pauzu' }));
    expect(await screen.findByText('Pauza může být nejvýše 240 minut.')).toBeInTheDocument();
  });

  it('says so when the setting cannot be read', async () => {
    get.mockRejectedValue(new Error('500'));
    mount();
    expect(await screen.findByText('Nastavení pauzy se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pauza mezi vyšetřeními (min)')).toBeNull();
  });
});
