/*
 * The screen that makes the Czech calendar the clinic's own.
 *
 * Before it, the thirteen statutory days were computed in the source and shown
 * nowhere: a clinic could not add a company day off, could not say it works on
 * 28. října, and could not see why a Monday in April was closed. Availability
 * simply offered no times and gave no reason.
 *
 * What is checked here is the part that cannot be checked by looking: that
 * "Pracujeme" sends isHoliday FALSE for a statutory day and the opposite for
 * one the clinic took, and that a reason always travels with the decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const year = vi.fn();
const save = vi.fn();
const reset = vi.fn();

vi.mock('../../api/holidays', () => ({
  holidaysApi: { year, save, reset },
}));

const { default: HolidaysPage } = await import('./HolidaysPage');

const day = (over: Record<string, unknown> = {}) => ({
  date: '2026-09-28',
  name: 'Den české státnosti',
  isHoliday: true,
  isStatutory: true,
  isAmended: false,
  ...over,
});

beforeEach(() => {
  year.mockReset().mockResolvedValue([day()]);
  save.mockReset().mockResolvedValue(day({ isHoliday: false, isAmended: true, name: 'Pracujeme' }));
  reset.mockReset().mockResolvedValue(undefined);
});

const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

describe('the clinic year', () => {
  it('shows a statutory day with its name, so an empty Monday explains itself', async () => {
    render(withQueries(<HolidaysPage />));

    expect(await screen.findByText('Den české státnosti')).toBeInTheDocument();
    expect(screen.getByText(/pondělí 28\. září/i)).toBeInTheDocument();
    expect(screen.getByText('Státní svátek')).toBeInTheDocument();
  });

  it('turns a statutory holiday into a working day, with a reason', async () => {
    render(withQueries(<HolidaysPage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Pracujeme' }));

    await waitFor(() => expect(save).toHaveBeenCalled());

    expect(save.mock.calls[0]).toEqual(['2026-09-28', false, 'Pracujeme']);
  });

  it('turns a day the clinic took back into a day off', async () => {
    year.mockResolvedValue([
      day({ isHoliday: false, isAmended: true, name: 'Pracujeme' }),
    ]);

    render(withQueries(<HolidaysPage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Máme volno' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1]).toBe(true);
    expect(save.mock.calls[0][2]).not.toBe('');
  });

  it('offers to undo only what the clinic changed', async () => {
    render(withQueries(<HolidaysPage />));
    await screen.findByText('Den české státnosti');

    expect(screen.queryByRole('button', { name: 'Vrátit' })).not.toBeInTheDocument();

    year.mockResolvedValue([day({ isAmended: true, name: 'Firemní volno' })]);
    render(withQueries(<HolidaysPage />));

    expect(await screen.findByRole('button', { name: 'Vrátit' })).toBeInTheDocument();
  });

  it('will not save a day with no name', async () => {
    render(withQueries(<HolidaysPage />));

    await userEvent.click(await screen.findByRole('button', { name: /Přidat vlastní volno/i }));
    await screen.findByLabelText('Datum');

    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Název'), 'Firemní volno');

    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });
});
