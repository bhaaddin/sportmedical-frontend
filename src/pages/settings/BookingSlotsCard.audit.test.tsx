/*
 * Settings audit (20. 10. 2026) - "Pauza mezi vyšetřeními" on Kalendář a mřížka.
 * Server facts (dev API): GET {settings:{examinationPauseMinutes:10}, minMinutes:0, maxMinutes:240}.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { invalidSettings, renderScreen, unreachable } from '../../test/auditHarness';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get, put }, client: { get, put } }));

const { BookingSlotsCard } = await import('./BookingSlotsCard');

const body = (minutes: number, min = 0, max = 240) => ({ settings: { examinationPauseMinutes: minutes }, defaults: { examinationPauseMinutes: 0 }, minMinutes: min, maxMinutes: max });
const mount = () => renderScreen(<BookingSlotsCard />);
const field = () => screen.findByLabelText('Pauza mezi vyšetřeními (min)');
const URL_ = '/api/v1/settings/booking-slots';

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue({ data: body(10) });
  put.mockReset().mockImplementation(async (_url: string, sent: { examinationPauseMinutes: number }) => ({ data: body(sent.examinationPauseMinutes) }));
});

describe('the pause card', () => {
  it.each([['0', 0], ['5', 5], ['240', 240], [' 45 ', 45]])('saves "%s" as the number %s', async (typed, expected) => {
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, typed);
    await user.click(screen.getByRole('button', { name: 'Uložit pauzu' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(URL_, { examinationPauseMinutes: expected }));
  });

  it.each(['241', '-5', '1,5', 'abc', '', '99999'])('refuses "%s" before the round trip', async (typed) => {
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    if (typed !== '') await user.type(input, typed);
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
    expect(screen.getByText('Zadejte celé číslo od 0 do 240.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('takes its range from the server, not from a number in code', async () => {
    get.mockResolvedValue({ data: body(10, 5, 60) });
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '61');
    expect(screen.getByText('Zadejte celé číslo od 5 do 60.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '4');
    expect(screen.getByText('Zadejte celé číslo od 5 do 60.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '60');
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeEnabled();
  });

  it('is not "changed" when the value typed equals the stored one', async () => {
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '10');
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
  });

  it('puts the stored value back with Zahodit', async () => {
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(input).toHaveValue('10');
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the server sentence under the field when it refuses', async () => {
    put.mockRejectedValue(invalidSettings({ examinationPauseMinutes: ['Pauza může být nejvýše 240 minut.'] }));
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit pauzu' }));
    expect(await screen.findByText('Pauza může být nejvýše 240 minut.')).toBeInTheDocument();
  });

  it('shows a banner, not a blank card, when the request never got an answer', async () => {
    put.mockRejectedValue(unreachable());
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit pauzu' }));
    expect(await screen.findByText('Nastavení se nepodařilo uložit.')).toBeInTheDocument();
  });

  it('says it could not read the setting and reads again on request', async () => {
    get.mockRejectedValueOnce(unreachable()).mockResolvedValue({ data: body(10) });
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText('Nastavení pauzy se nepodařilo načíst.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await field()).toHaveValue('10');
  });

  it('shows the saved number again after the save', async () => {
    const user = userEvent.setup();
    mount();
    const input = await field();
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: 'Uložit pauzu' }));
    expect(await screen.findByText(/Uloženo\. Pauza platí/)).toBeInTheDocument();
    expect(input).toHaveValue('25');
    expect(screen.getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
  });
});
