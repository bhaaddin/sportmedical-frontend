/*
 * R4 settings: "Pracovník dělá jen jednu věc najednou" + the exception list, against the booking-slots contract of stage 2.
 * An older server (no such fields) gets no card at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get, put }, client: { get, put } }));

const { SingleWorkerCard } = await import('./SingleWorkerCard');

const slots = (over: Record<string, unknown> = {}) => ({
  settings: { examinationPauseMinutes: 10, singleWorkerAtATime: false, workerExceptions: [], ...over },
  defaults: { examinationPauseMinutes: 0, singleWorkerAtATime: false, workerExceptions: [] },
  minMinutes: 0,
  maxMinutes: 240,
});
const users = [
  { userId: 'u1', email: 'a@x.cz', displayName: 'Anna Černá', role: 'Staff', isActive: true, mustChangePassword: false, createdAtUtc: '', lastLoginAtUtc: null },
  { userId: 'u2', email: 'p@x.cz', displayName: 'Petr Novák', role: 'Staff', isActive: true, mustChangePassword: false, createdAtUtc: '', lastLoginAtUtc: null },
  { userId: 'u3', email: 'o@x.cz', displayName: 'Odešlý', role: 'Staff', isActive: false, mustChangePassword: false, createdAtUtc: '', lastLoginAtUtc: null },
];

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SingleWorkerCard />
    </QueryClientProvider>,
  );
}
const route = (data: unknown) =>
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/settings/booking-slots') return { data };
    if (url === '/api/v1/users') return { data: users };
    throw new Error(`unexpected ${url}`);
  });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset();
  put.mockReset();
});

describe('Pracovník dělá jen jednu věc najednou', () => {
  it('shows the stored switch and the active people; saves ONLY the two new fields', async () => {
    route(slots());
    put.mockResolvedValue({ data: slots({ singleWorkerAtATime: true, workerExceptions: ['u2'] }) });
    const user = userEvent.setup();
    mount();
    const sw = await screen.findByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' });
    expect(sw).not.toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Anna Černá' })).toBeDisabled(); // exceptions only matter once the rule is on
    expect(screen.queryByRole('checkbox', { name: 'Odešlý' })).toBeNull(); // an inactive account is not offered
    const save = screen.getByRole('button', { name: 'Uložit pravidlo' });
    expect(save).toBeDisabled();

    await user.click(sw);
    await user.click(screen.getByRole('checkbox', { name: 'Petr Novák' }));
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/settings/booking-slots', { singleWorkerAtATime: true, workerExceptions: ['u2'] }));
    expect(await screen.findByText(/Pravidlo platí v celé ordinaci/)).toBeInTheDocument();
    /* examinationPauseMinutes is not in the body: a PUT that leaves a field out keeps it */
    expect(put.mock.calls[0]![1]).not.toHaveProperty('examinationPauseMinutes');
  });

  it('reads the stored exceptions, unticks one and discards', async () => {
    route(slots({ singleWorkerAtATime: true, workerExceptions: ['u1'] }));
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' })).toBeChecked();
    const anna = await screen.findByRole('checkbox', { name: 'Anna Černá' });
    expect(anna).toBeChecked();
    await user.click(anna);
    expect(anna).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByRole('checkbox', { name: 'Anna Černá' })).toBeChecked();
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the server\'s refusal', async () => {
    route(slots());
    put.mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 400, data: { code: 'settings.invalid', message: 'Neplatné nastavení.' } } }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' }));
    await user.click(screen.getByRole('button', { name: 'Uložit pravidlo' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('an older server (no such fields) gets no card: nothing is offered that cannot work', async () => {
    route({ settings: { examinationPauseMinutes: 10 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 });
    mount();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/settings/booking-slots'));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('single-worker-card')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(get).not.toHaveBeenCalledWith('/api/v1/users');
  });
});
