/*
 * Nastavení klubů (/nastaveni/kluby): the two numbers the clinic decides about
 * club blocks. What the screen has to get right: that "Uložit" is live only on a
 * change, that a refusal shows the server's own sentence under its field, that a
 * failed load says so and retries, and that it holds together at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import ClubSettingsPage, { validateClubSettings } from './ClubSettingsPage';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get, put } };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/kluby']}>
        <ClubSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null });
  put.mockReset().mockImplementation(async (settings) => settings);
});

describe('ClubSettingsPage', () => {
  it('shows the saved values - an empty minimum when none is set - with Uložit and Zahodit off until something changes', async () => {
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('14');
    const minimum = screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    expect(minimum).toHaveValue('');
    expect(minimum).not.toHaveAttribute('placeholder');
    expect(screen.getByText(/Prázdné pole = bez minima/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nastavení klubů' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();
  });

  it('saves what was typed, as numbers, and goes quiet again', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '21');
    await user.clear(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)'));
    await user.type(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)'), '25');

    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 21, minimumPlayers: 25 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
    expect(screen.getByLabelText('Platnost odkazu')).toHaveValue('21');
  });

  it('sends null when the minimum is left empty, and null again after clearing a saved one', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 20, minimumPlayers: null }));
  });

  it('clears a saved minimum to "no minimum"', async () => {
    get.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: 18 });
    const user = userEvent.setup();
    renderPage();
    const minimum = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    expect(minimum).toHaveValue('18');
    await user.clear(minimum);
    expect(screen.queryByText(/Zadejte celý počet sportovců/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 14, minimumPlayers: null }));
  });

  it('keeps the palette the server sent, so saving here cannot wipe it', async () => {
    get.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null, blockPalette: ['#112233'] });
    const user = userEvent.setup();
    renderPage();
    const minimum = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    await user.type(minimum, '12');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 14, minimumPlayers: 12, blockPalette: ['#112233'] }));
  });

  it('shows the server sentence under the minimum field', async () => {
    put.mockRejectedValue(refused(400, { message: 'Neplatné.', errors: { minimumPlayers: ['Minimum nesmí být větší než kapacita.'] } }));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)'), '500');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Minimum nesmí být větší než kapacita.')).toBeInTheDocument();
  });

  it('puts the saved values back with Zahodit, without a request', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '99');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(days).toHaveValue('14');
    expect(put).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('refuses a value the server would refuse, before the round trip', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '0');
    expect(await screen.findByText('Odkaz musí platit aspoň jeden den.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(put).not.toHaveBeenCalled();

    await user.clear(days);
    await user.type(days, 'abc');
    expect(await screen.findByText('Zadejte celý počet dní.')).toBeInTheDocument();
  });

  it('shows the server\'s sentence under the field it refused, and the message above', async () => {
    put.mockRejectedValue(refused(400, { message: 'Nastavení klubů je neplatné.', errors: { registrationLinkValidityDays: ['Odkaz smí platit nejvýše 365 dní.'] } }));
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '500');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Nastavení klubů je neplatné.')).toBeInTheDocument();
    expect(screen.getByText('Odkaz smí platit nejvýše 365 dní.')).toBeInTheDocument();
    /* Nothing is lost: the typed value stays and Uložit is still live. */
    expect(days).toHaveValue('500');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('says what failed when the settings cannot be read, and reads them again on request', async () => {
    get.mockRejectedValueOnce(new Error('503'));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Nastavení klubů se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nastavení klubů' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('14');
  });

  it('keeps a saved failure from emptying the form', async () => {
    put.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderPage();
    const players = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    await user.clear(players);
    await user.type(players, '40');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Nastavení se nepodařilo uložit/)).toBeInTheDocument();
    expect(players).toHaveValue('40');
  });
});

describe('ClubSettingsPage in three layouts', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('draws the form and the save buttons on %s', async (_device, width) => {
    setViewport(width);
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)')).toBeInTheDocument();
    /* On a phone the frame pins the pair to the bottom; either way each button exists once. */
    expect(screen.getAllByRole('button', { name: 'Uložit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Zahodit' })).toHaveLength(1);
  });
});

describe('validateClubSettings', () => {
  it('wants whole numbers and at least a day; the minimum may be empty, otherwise a whole number from 1', () => {
    expect(validateClubSettings({ registrationLinkValidityDays: '14', minimumPlayers: '' })).toEqual({});
    expect(validateClubSettings({ registrationLinkValidityDays: '14', minimumPlayers: '8' })).toEqual({});
    expect(validateClubSettings({ registrationLinkValidityDays: '', minimumPlayers: '0' })).toEqual({
      registrationLinkValidityDays: 'Zadejte celý počet dní.',
      minimumPlayers: 'Zadejte celý počet sportovců od 1, nebo pole nechte prázdné.',
    });
    expect(validateClubSettings({ registrationLinkValidityDays: '14', minimumPlayers: 'abc' }).minimumPlayers).toMatch(/celý počet sportovců/);
    expect(validateClubSettings({ registrationLinkValidityDays: '5000', minimumPlayers: '' }).registrationLinkValidityDays).toMatch(/překlep/);
  });
});
