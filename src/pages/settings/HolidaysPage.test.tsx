/*
 * The screen that makes the Czech calendar the clinic's own.
 *
 * Before it, the thirteen statutory days were computed in the source and shown
 * nowhere: a clinic could not add a company day off, could not say it works on
 * 28. října, and could not see why a Monday in April was closed. Availability
 * simply offered no times and gave no reason.
 *
 * What is checked here is the part that cannot be checked by looking: that
 * "Pracujeme v tento den" sends isHoliday FALSE for a statutory day and gives
 * the day back to the law when switched off, that a reason always travels with
 * the decision, and that "online objednávky vypnuty" lands on the calendars.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const year = vi.fn();
const save = vi.fn();
const reset = vi.fn();
const listExceptions = vi.fn();
const createException = vi.fn();
const deleteException = vi.fn();

vi.mock('../../api/holidays', () => ({
  holidaysApi: { year, save, reset },
}));

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'c1', name: 'Sportovní diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15,
        isActive: true, sortOrder: 0, clinicServiceId: null,
        publicMinimumNoticeMinutes: null, publicHorizonDays: null,
      },
    ]),
  },
}));

vi.mock('../../api/workingHours', () => ({
  workingHoursApi: { listExceptions, createException, deleteException },
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

const onlineOff = {
  id: 'e1', date: '2026-09-28', isClosed: false, startTime: null, endTime: null,
  workerUserId: null, reason: 'Online objednávky vypnuty', isClosedToPublic: true,
};

beforeEach(() => {
  year.mockReset().mockResolvedValue([day()]);
  save.mockReset().mockResolvedValue(day({ isHoliday: false, isAmended: true }));
  reset.mockReset().mockResolvedValue(undefined);
  listExceptions.mockReset().mockResolvedValue([]);
  createException.mockReset().mockResolvedValue(onlineOff);
  deleteException.mockReset().mockResolvedValue(undefined);
});

const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

describe('the clinic year', () => {
  it('shows a statutory day with its name, closed by default', async () => {
    render(withQueries(<HolidaysPage />));

    expect(await screen.findByText('Den české státnosti')).toBeInTheDocument();
    expect(screen.getByText(/pondělí 28\. září/i)).toBeInTheDocument();
    expect(screen.getByText('Státní svátek – zavřeno')).toBeInTheDocument();
    expect(screen.getByText('Zavřeno – nikdo se nemůže objednat.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Pracujeme v tento den' })).not.toBeChecked();
  });

  it('turns a statutory holiday into a working day, keeping its name as the reason', async () => {
    render(withQueries(<HolidaysPage />));

    await userEvent.click(await screen.findByRole('switch', { name: 'Pracujeme v tento den' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]).toEqual(['2026-09-28', false, 'Den české státnosti']);
  });

  it('closes a statutory day again by giving it back to the law', async () => {
    year.mockResolvedValue([day({ isHoliday: false, isAmended: true })]);

    render(withQueries(<HolidaysPage />));

    const working = await screen.findByRole('switch', { name: 'Pracujeme v tento den' });
    await waitFor(() => expect(working).toBeEnabled());
    await userEvent.click(working);

    await waitFor(() => expect(reset).toHaveBeenCalledWith('2026-09-28'));
    expect(save).not.toHaveBeenCalled();
  });

  it('closes the clinic’s own working day with a reason', async () => {
    year.mockResolvedValue([day({ isStatutory: false, isHoliday: false, isAmended: true, name: 'Firemní akce' })]);

    render(withQueries(<HolidaysPage />));

    const working = await screen.findByRole('switch', { name: 'Pracujeme v tento den' });
    await waitFor(() => expect(working).toBeEnabled());
    await userEvent.click(working);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]).toEqual(['2026-09-28', true, 'Firemní akce']);
  });

  it('switches online booking off on a working holiday, on every calendar', async () => {
    year.mockResolvedValue([day({ isHoliday: false, isAmended: true })]);

    render(withQueries(<HolidaysPage />));

    const online = await screen.findByRole('switch', { name: 'Online objednávky vypnuty' });
    await waitFor(() => expect(online).toBeEnabled());
    await userEvent.click(online);

    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(createException).toHaveBeenCalledWith('c1', expect.objectContaining({
      date: '2026-09-28',
      isClosed: false,
      isClosedToPublic: true,
    }));
  });

  it('closing the holiday again removes the online-only exception, which would otherwise reopen it', async () => {
    year.mockResolvedValue([day({ isHoliday: false, isAmended: true })]);
    listExceptions.mockResolvedValue([onlineOff]);

    render(withQueries(<HolidaysPage />));

    expect(await screen.findByRole('switch', { name: 'Online objednávky vypnuty' })).toBeChecked();
    const working = screen.getByRole('switch', { name: 'Pracujeme v tento den' });
    await waitFor(() => expect(working).toBeEnabled());
    await userEvent.click(working);

    await waitFor(() => expect(reset).toHaveBeenCalled());
    expect(deleteException).toHaveBeenCalledWith('c1', 'e1');
    expect(deleteException.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
  });

  it('offers no online switch on a closed day', async () => {
    render(withQueries(<HolidaysPage />));
    await screen.findByText('Den české státnosti');

    expect(screen.queryByRole('switch', { name: 'Online objednávky vypnuty' })).not.toBeInTheDocument();
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
